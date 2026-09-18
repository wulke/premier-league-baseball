import { Op } from 'sequelize';
import db from '../client';
import { DomainError } from './errors';
import { GameWorldFactory } from './game-world';
import { resolveKnockoutGameCompletion } from './knockout-advancement';
import { resolveRoundRobinGameCompletion } from './season-result';
import { resolveCrossStageAdvancement } from './stage-advancement';
import { resolveSimulationEngine, SimulateOptions } from './simulation/engine';
import { NotificationFactory } from './notifications/notification';
import { GAME_RESULT, GameResultPayload } from './notifications/game-result-notification';
import { persistPlayerGameStats, PlayerGameStatsWriter } from './player-game-stats-writer';
import { persistGameEvents } from './event-chain-writer';
import { TeamFactory } from './team';
import { resolveMatchRules } from './lineup';
import { SyntheticLineup } from './simulation/synthetic-lineup';

type AuthoredSimulationContext = {
  lineups: { home: SyntheticLineup; away: SyntheticLineup };
  matchRules: ReturnType<typeof resolveMatchRules>;
};

// @spec SIM-021,SIM-022 — bridge persisted, frozen authored lineups into the pure
// AttributeDrivenSimulationEngine context. Legacy games without usable lineups deliberately
// return undefined so the resolver selects RandomSimulationEngine's baseline behavior.
const loadAuthoredSimulationContext = async (
  gameId: number,
  homeTeamId: number,
  awayTeamId: number,
): Promise<AuthoredSimulationContext | undefined> => {
  try {
    await TeamFactory(homeTeamId).snapshotForGame(gameId);
    await TeamFactory(awayTeamId).snapshotForGame(gameId);
    const [homeLineup, awayLineup, homeTeam] = await Promise.all([
      TeamFactory(homeTeamId).getLineup({ gameId }),
      TeamFactory(awayTeamId).getLineup({ gameId }),
      db.models.Team.findByPk(homeTeamId),
    ]);
    if (!homeTeam || homeLineup.startingPitcherId == null || awayLineup.startingPitcherId == null) return undefined;

    const toSynthetic = async (teamId: number, lineup: typeof homeLineup): Promise<SyntheticLineup | undefined> => {
      const starters = lineup.starters.filter((entry) => entry.battingOrder != null);
      if (starters.length !== 9 || starters.some((entry) => !entry.valid)) return undefined;
      const playerIds = lineup.starters.map((entry) => entry.playerId);
      const players = await db.models.Player.findAll({ where: { id: { [Op.in]: playerIds }, teamId } })
        .then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
      if (players.length !== new Set(playerIds).size) return undefined;
      const playerById = new Map(players.map((player: any) => [player.id, player]));
      const startingPitcher = lineup.starters.find((entry) => entry.playerId === lineup.startingPitcherId)!;
      const toEntry = (entry: typeof starters[number]) => ({
        playerId: entry.playerId,
        battingOrder: entry.battingOrder!,
        fieldingPosition: entry.fieldingPosition,
        attributes: playerById.get(entry.playerId)!.attributes,
      });
      return {
        teamId,
        startingPitcherId: lineup.startingPitcherId!,
        battingOrder: starters.map(toEntry),
        ...(startingPitcher.battingOrder == null ? { startingPitcher: toEntry(startingPitcher) } : {}),
      };
    };

    const [home, away] = await Promise.all([
      toSynthetic(homeTeamId, homeLineup),
      toSynthetic(awayTeamId, awayLineup),
    ]);
    if (!home || !away) return undefined;
    const league = await db.models.League.findByPk(homeTeam.dataValues.homeLeagueId);
    return { lineups: { home, away }, matchRules: resolveMatchRules(league?.dataValues.config) };
  } catch (error) {
    if (error instanceof DomainError) return undefined;
    throw error;
  }
};

const toDateStr = (d: any): string => new Date(d).toISOString().slice(0, 10);

// Same ancestor walk as simulate()'s scheduledDate guard, run unconditionally so a
// GAME_RESULT notification can be scoped to the right GameWorld regardless of whether
// the game had a scheduledDate. Returns null (never throws) when any link is missing —
// a game unreachable from a GameWorld simply fires no notification.
const resolveGameWorldId = async (gameId: number): Promise<number | null> => {
  const dsg = await db.models.DivisionSeasonGame.findOne({ where: { gameId } });
  if (!dsg) return null;
  const ds = await db.models.DivisionSeason.findByPk(dsg.dataValues.divisionSeasonId);
  if (!ds) return null;
  const division = await db.models.Division.findByPk(ds.dataValues.divisionId);
  if (!division) return null;
  const league = await db.models.League.findByPk(division.dataValues.leagueId);
  if (!league) return null;
  return league.dataValues.gameWorldId ?? null;
};

// Same League -> Division -> DivisionSeason -> DivisionSeasonGame -> Game reachability
// walk that simulateBatch performs; returns the raw Game dataValues reachable from
// gwId. Shared by rapidSimulateSeason so the "next scheduled date" query reuses the
// exact candidate game set rather than introducing a new join.
const loadReachableGames = async (gwId: number): Promise<any[]> => {
  const leagues = await db.models.League.findAll({ where: { gameWorldId: gwId } });
  const leagueIds = leagues.map((l: any) => l.dataValues.id);
  if (leagueIds.length === 0) return [];

  const divisions = await db.models.Division.findAll({
    where: { leagueId: { [Op.in]: leagueIds } }
  });
  const divisionIds = divisions.map((d: any) => d.dataValues.id);
  if (divisionIds.length === 0) return [];

  const divisionSeasons = await db.models.DivisionSeason.findAll({
    where: { divisionId: { [Op.in]: divisionIds } }
  });
  const divisionSeasonIds = divisionSeasons.map((ds: any) => ds.dataValues.id);
  if (divisionSeasonIds.length === 0) return [];

  const dsGames = await db.models.DivisionSeasonGame.findAll({
    where: { divisionSeasonId: { [Op.in]: divisionSeasonIds } }
  });
  const gameIds = [...new Set<number>(dsGames.map((dsg: any) => dsg.dataValues.gameId))];
  if (gameIds.length === 0) return [];

  const games = await db.models.Game.findAll({ where: { id: { [Op.in]: gameIds } } });
  return games.map((g: any) => g.dataValues);
};

const GameFactory = (id?: number) => {
  return {
    create: async (homeTeam: number, awayTeam: number) => {
      /* todo: scheduledDate? */
      return await db.models.Game.create({
        homeTeam,
        awayTeam,
        // scheduleDate: ???
      }).then(({ dataValues }) => dataValues);
    },

    // result(): REMOVED (#190, LLD e4) — the unguarded blind-update path is deleted;
    // Game writes are reachable only through the guarded simulate paths below.

    // @spec SIM-001,SIM-002,SIM-003,SIM-004,SIM-005,SIM-006,SIM-007,SIM-016,SIM-021,SIM-022,ECP-002
    simulate: async (options?: SimulateOptions) => {
      const game = await db.models.Game.findByPk(id);
      if (!game) throw new DomainError('the game was not found', 404);

      const { status, scheduledDate, homeTeam, awayTeam } = game.dataValues;

      if (status === 'COMPLETED') {
        throw new DomainError('the game has already been completed', 422);
      }
      if (status === 'IN_PROGRESS') {
        throw new DomainError('the game cannot be simulated in its current status', 422);
      }

      // Captured here when the scheduledDate branch below already walks the ancestor
      // chain, so the NOTIF-001 trigger doesn't re-run the identical walk from scratch.
      let resolvedGameWorldId: number | null = null;

      if (scheduledDate != null) {
        const dsg = await db.models.DivisionSeasonGame.findOne({ where: { gameId: id } });
        if (!dsg) {
          throw new DomainError('the GameWorld has no current date configured', 422);
        }
        const ds = await db.models.DivisionSeason.findByPk(dsg.dataValues.divisionSeasonId);
        const division = await db.models.Division.findByPk(ds!.dataValues.divisionId);
        const league = await db.models.League.findByPk(division!.dataValues.leagueId);
        const gameWorld = await db.models.GameWorld.findByPk(league!.dataValues.gameWorldId);

        if (!gameWorld || gameWorld.dataValues.currentDate == null) {
          throw new DomainError('the GameWorld has no current date configured', 422);
        }

        if (toDateStr(scheduledDate) > gameWorld.dataValues.currentDate) {
          throw new DomainError('the game is scheduled for a future date', 422);
        }

        resolvedGameWorldId = gameWorld.dataValues.id;
      }

      // @spec SIM-016 score production delegated to the SimulationEngine strategy
      // (seed domain-only — LLD e16; per-game derivation — e13/e14).
      const authoredContext = await loadAuthoredSimulationContext(id!, homeTeam, awayTeam);
      const simulationResult = resolveSimulationEngine(options?.seed)
        .simulateGame({ gameId: id!, homeTeam, awayTeam, ...authoredContext });
      const { homeTeamResult, awayTeamResult } = simulationResult;

      // @spec ECP-002 — score, event-derived stats, and the durable chain share one completion
      // transaction. Legacy random attribution remains after commit because it has no chain.
      const transaction = await db.transaction();
      let updated: any;
      try {
        const [affectedCount] = await db.models.Game.update(
          { homeTeamResult, awayTeamResult, status: 'COMPLETED' },
          { where: { id, status: { [Op.ne]: 'COMPLETED' } }, transaction }
        );
        if (affectedCount === 0) throw new DomainError('the game has already been completed', 422);
        updated = await db.models.Game.findByPk(id, { transaction });
        if (simulationResult.playerGameStats) await persistPlayerGameStats(simulationResult.playerGameStats, transaction);
        if (simulationResult.eventChain) await persistGameEvents(simulationResult.eventChain, transaction);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      if (!simulationResult.playerGameStats) await PlayerGameStatsWriter().writeForCompletedGame({
        gameId: id!, homeTeamId: homeTeam, awayTeamId: awayTeam, result: { homeTeamResult, awayTeamResult },
      });
      // @spec CUP-001,LCH-002,MSS-006,MSS-007 round-robin / knockout / stage completion hooks (single-game path)
      await resolveKnockoutGameCompletion(id!);
      await resolveRoundRobinGameCompletion(id!);
      await resolveCrossStageAdvancement(id!);

      // @spec NOTIF-001 — fired after the guarded update above has already succeeded,
      // so a game that didn't actually complete never produces a notification (see
      // notification-stream.md's "Key decisions" on why this isn't a db.transaction()).
      // resolvedGameWorldId is already known when the scheduledDate branch above ran
      // its ancestor walk; only an unscheduled game needs the separate resolveGameWorldId
      // walk here.
      const gameWorldId = resolvedGameWorldId ?? await resolveGameWorldId(id!);
      if (gameWorldId != null) {
        const payload: GameResultPayload = {
          gameId: id!,
          homeTeamId: homeTeam,
          awayTeamId: awayTeam,
          homeTeamResult: updated!.dataValues.homeTeamResult,
          awayTeamResult: updated!.dataValues.awayTeamResult,
        };
        // Each notify() call independently swallows its own write failure (NOTIF-005),
        // so the two team-scoped notifications have no ordering dependency on each other.
        await Promise.all([
          NotificationFactory().notify(GAME_RESULT, payload, { gameWorldId, teamId: homeTeam }),
          NotificationFactory().notify(GAME_RESULT, payload, { gameWorldId, teamId: awayTeam }),
        ]);
      }

      return updated!.dataValues;
    },

    // @spec SCL-013,SIM-011,SIM-012,SIM-013,SIM-014,SIM-015,SIM-016,SIM-021,SIM-022,ECP-002,ECP-003
    simulateBatch: async (gwId: number, endDate?: string, options?: SimulateOptions) => {
      const gameWorld = await db.models.GameWorld.findByPk(gwId);
      if (!gameWorld) throw new DomainError('the GameWorld was not found', 404);

      const { currentDate } = gameWorld.dataValues;

      if (!currentDate && !endDate) {
        throw new DomainError('the GameWorld has no current date configured', 422);
      }

      if (endDate && currentDate && endDate > currentDate) {
        throw new DomainError("the endDate exceeds the GameWorld's current date", 422);
      }

      const effectiveEndDate: string = endDate ?? currentDate;

      // Collect all DivisionSeason IDs reachable from gwId
      const leagues = await db.models.League.findAll({ where: { gameWorldId: gwId } });
      const leagueIds = leagues.map((l: any) => l.dataValues.id);
      if (leagueIds.length === 0) return { simulated: [], skipped: [] };

      const divisions = await db.models.Division.findAll({
        where: { leagueId: { [Op.in]: leagueIds } }
      });
      const divisionIds = divisions.map((d: any) => d.dataValues.id);
      if (divisionIds.length === 0) return { simulated: [], skipped: [] };

      const divisionSeasons = await db.models.DivisionSeason.findAll({
        where: { divisionId: { [Op.in]: divisionIds } }
      });
      const divisionSeasonIds = divisionSeasons.map((ds: any) => ds.dataValues.id);
      if (divisionSeasonIds.length === 0) return { simulated: [], skipped: [] };

      const dsGames = await db.models.DivisionSeasonGame.findAll({
        where: { divisionSeasonId: { [Op.in]: divisionSeasonIds } }
      });
      const gameIds = [...new Set<number>(dsGames.map((dsg: any) => dsg.dataValues.gameId))];
      if (gameIds.length === 0) return { simulated: [], skipped: [] };

      const games = await db.models.Game.findAll({
        where: { id: { [Op.in]: gameIds } }
      });

      const simulated: any[] = [];
      const skipped: { game: any; reason: string }[] = [];

      // @spec SIM-016 resolved once before the loop; per-game calls are pure, so
      // transaction semantics are unchanged (LLD e17) and batch outcomes are
      // order- and skip-independent (e14).
      const engine = resolveSimulationEngine(options?.seed);

      // Snapshot creation owns its own transaction. Materialize authored contexts before the
      // all-or-nothing result/stat transaction so SQLite never nests transactions; these
      // snapshots are idempotent point-in-time inputs, not completion writes.
      const authoredContexts = new Map<number, AuthoredSimulationContext | undefined>();
      for (const game of games) {
        const { status, scheduledDate } = game.dataValues;
        if (status === 'COMPLETED' || status === 'IN_PROGRESS'
          || (scheduledDate != null && toDateStr(scheduledDate) > effectiveEndDate)) continue;
        authoredContexts.set(game.dataValues.id, await loadAuthoredSimulationContext(
          game.dataValues.id, game.dataValues.homeTeam, game.dataValues.awayTeam,
        ));
      }

      const t = await db.transaction();
      try {
        for (const game of games) {
          const { status, scheduledDate } = game.dataValues;

          if (status === 'COMPLETED') {
            skipped.push({ game: game.dataValues, reason: 'already completed' });
            continue;
          }
          if (status === 'IN_PROGRESS') {
            skipped.push({ game: game.dataValues, reason: 'game in progress' });
            continue;
          }
          if (scheduledDate != null && toDateStr(scheduledDate) > effectiveEndDate) {
            skipped.push({ game: game.dataValues, reason: 'future date' });
            continue;
          }

          // @spec SIM-016 per-game delegation — fresh seed per game in production,
          // pinned base seed in tests (SIM-017/SIM-018).
          const authoredContext = authoredContexts.get(game.dataValues.id);
          const simulationResult = engine.simulateGame({
            gameId: game.dataValues.id,
            homeTeam: game.dataValues.homeTeam,
            awayTeam: game.dataValues.awayTeam,
            ...authoredContext,
          });
          const { homeTeamResult, awayTeamResult } = simulationResult;

          await db.models.Game.update(
            { homeTeamResult, awayTeamResult, status: 'COMPLETED' },
            { where: { id: game.dataValues.id }, transaction: t }
          );

          // @spec SIM-015,SIM-021,ECP-002,ECP-003 — score, event-projected player stats, and
          // the durable chain share the batch transaction, so any write error rolls back all.
          if (simulationResult.playerGameStats) {
            await persistPlayerGameStats(simulationResult.playerGameStats, t);
          }
          if (simulationResult.eventChain) await persistGameEvents(simulationResult.eventChain, t);

          simulated.push({ ...game.dataValues, homeTeamResult, awayTeamResult, status: 'COMPLETED', playerGameStats: simulationResult.playerGameStats });
        }

        await t.commit();
      } catch (error) {
        await t.rollback();
        throw error;
      }

      // @spec CUP-001,LCH-002,MSS-006,MSS-007 round-robin / knockout / stage completion hooks (batch path).
      // Runs AFTER the transaction commits (edge case e4) so the "last unresolved game in
      // round" check sees the full batch. Idempotent, so deduping by gameId is sufficient.
      const advanced = new Set<number>();
      for (const sim of simulated) {
        if (advanced.has(sim.id)) continue;
        advanced.add(sim.id);
        // @spec SIM-022 — event-derived stats were written in the transaction. Only the
        // legacy random fallback receives post-commit fabricated attribution.
        if (!sim.playerGameStats) await PlayerGameStatsWriter().writeForCompletedGame({
          gameId: sim.id, homeTeamId: sim.homeTeam, awayTeamId: sim.awayTeam,
          result: { homeTeamResult: sim.homeTeamResult, awayTeamResult: sim.awayTeamResult },
        });
        await resolveKnockoutGameCompletion(sim.id);
        await resolveRoundRobinGameCompletion(sim.id);
        await resolveCrossStageAdvancement(sim.id);
      }

      return { simulated, skipped };
    },

    // @spec SIM-019,SIM-020,MSS-009 — Simulate Today owns one player-facing day: complete
    // every scheduled game at or before today (including dependent-stage games created by
    // completion hooks), then move to the earliest later date only when nothing remains
    // unresolved. The generic simulateBatch stays date-bounded for rapidSimulateSeason.
    simulateToday: async (gwId: number) => {
      const gameWorld = await db.models.GameWorld.findByPk(gwId);
      const currentDate = gameWorld?.dataValues.currentDate;
      const simulated: any[] = [];
      const skipped: any[] = [];

      while (true) {
        const result = await GameFactory().simulateBatch(gwId);
        simulated.push(...result.simulated);
        skipped.push(...result.skipped);

        const reachableGames = await loadReachableGames(gwId);
        // @spec SIM-019,MSS-009 — completion hooks may materialize a dependent stage at
        // today's date after the batch has queried its candidates. Run another batch so a
        // single Simulate Today click does not falsely report success with that game pending.
        const scheduledAtCurrentDate = reachableGames.some((game: any) =>
          game.status === 'SCHEDULED'
          && game.scheduledDate != null
          && toDateStr(game.scheduledDate) <= currentDate,
        );
        if (scheduledAtCurrentDate) continue;

        const progressBlocked = reachableGames.some((game: any) =>
          game.status !== 'COMPLETED'
          && game.scheduledDate != null
          && toDateStr(game.scheduledDate) <= currentDate,
        );
        if (progressBlocked) return { simulated, skipped, nextDate: null, progressBlocked: true };

        const nextDate = reachableGames
          .filter((game: any) => game.status !== 'COMPLETED'
            && game.scheduledDate != null
            && toDateStr(game.scheduledDate) > currentDate)
          .map((game: any) => toDateStr(game.scheduledDate))
          .sort()[0] ?? null;

        if (nextDate != null) await GameWorldFactory(gwId).advanceCurrentDate(nextDate);
        return { simulated, skipped, nextDate, progressBlocked: false };
      }
    },

    // @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006,MSS-009 rapidSimulateSeason:
    // fast-forward an entire GameWorld's remaining season by repeatedly simulating the
    // current date's batch and advancing currentDate to the next distinct scheduledDate
    // among remaining non-COMPLETED games, until none remain. Built entirely on
    // simulateBatch (unchanged) + GameWorldFactory.advanceCurrentDate; never calls
    // newSeason. See docs/llds/game-world/rapid-simulate-season.md.
    rapidSimulateSeason: async (gwId: number) => {
      // RSS-001: load the GameWorld; reject 404 before simulating anything.
      const gameWorld = await db.models.GameWorld.findByPk(gwId);
      if (!gameWorld) {
        throw new DomainError(`No gameworld exists with id='${gwId}'`, 404);
      }

      const { config, currentDate } = gameWorld.dataValues;
      // RSS-002: require an active season with a currentDate; simulate nothing otherwise.
      if (!config?.inProgress || currentDate == null) {
        throw new DomainError('the GameWorld has no active season to simulate', 422);
      }

      let daysAdvanced = 0;
      const simulated: any[] = [];
      const skipped: any[] = [];
      let targetDate: string = currentDate;

      // Loop: simulate the current date, then advance to the next distinct future
      // scheduledDate, until no non-COMPLETED scheduled game remains (RSS-003/RSS-006).
      while (true) {
        const result = await GameFactory().simulateBatch(gwId);
        simulated.push(...result.simulated);
        skipped.push(...result.skipped);

        // MIN(scheduledDate) among reachable non-COMPLETED games strictly after
        // targetDate (same reachability walk as simulateBatch).
        const reachableGames = await loadReachableGames(gwId);
        // @spec MSS-009 — a completed source stage can create a dependent stage whose
        // first games are dated at or before the current simulation date. Re-run this
        // date before seeking a future date so those newly reachable games are played.
        const newlyReachableAtCurrentDate = reachableGames.some((g: any) =>
          g.status === 'SCHEDULED'
          && g.scheduledDate != null
          && toDateStr(g.scheduledDate) <= targetDate,
        );
        if (newlyReachableAtCurrentDate) continue;
        const futureDates = reachableGames
          .filter((g: any) => g.status !== 'COMPLETED'
            && g.scheduledDate != null
            && toDateStr(g.scheduledDate) > targetDate)
          .map((g: any) => toDateStr(g.scheduledDate))
          .sort();
        const remaining = futureDates.length > 0 ? futureDates[0] : null;

        if (remaining == null) break;

        // RSS-005: if this iteration resolved zero games while a non-COMPLETED game at
        // or before targetDate is stuck (skipped as 'game in progress'), abort with the
        // blocking date. Prior iterations stay committed — each simulateBatch commits
        // its own transaction independently.
        if (result.simulated.length === 0) {
          const stuck = result.skipped.find((s: any) =>
            s.reason === 'game in progress'
            && s.game?.scheduledDate != null
            && toDateStr(s.game.scheduledDate) <= targetDate);
          if (stuck) {
            throw new DomainError(
              `rapid simulation made no progress at date ${targetDate} — a non-completed game is blocking advancement`,
              422
            );
          }
        }

        // RSS-003: advance currentDate to the next scheduled date and continue.
        await GameWorldFactory(gwId).advanceCurrentDate(remaining);
        targetDate = remaining;
        daysAdvanced += 1;
      }

      // RSS-004: newSeason() is never called here — season rollover is a separate action.
      return { daysAdvanced, simulated, skipped };
    },
  };
};

export { GameFactory };
