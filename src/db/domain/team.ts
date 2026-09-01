import { Op, UniqueConstraintError } from 'sequelize';
import { ActiveLineupEntry, GameLineupSnapshot, MatchRules, RosterPlayer, TeamConfig, TeamLineup, TeamSeasonCalendar, TeamSeasonGame } from "../../api/models";
import db from '../client';
import { listForTeam } from './contract';
import { getKnockoutRoundLabel } from './knockout';
import { PlayerFactory, resolveCurrentContract, toRosterPlayer } from './player';
import { DomainError } from './errors';
import { validateLineup } from './lineup';

interface ITeam {
  create: (gwId: number, config: TeamConfig, options?: TeamCreateOptions) => any;
  getSchedule: (gwId: number, leagueId?: number) => Promise<TeamSeasonCalendar>;
  getRoster: () => Promise<RosterPlayer[]>;
  snapshotForGame: (gameId: number) => Promise<GameLineupSnapshot>;
  getLineup: (options?: { gameId?: number; gwId?: number }) => Promise<TeamLineup>;
  updateActiveLineup: (entries: ActiveLineupEntry[], matchRules: MatchRules) => Promise<TeamLineup>;
  saveActiveLineup: (entries: ActiveLineupEntry[], matchRules: MatchRules) => Promise<TeamLineup>;
};

interface TeamCreateOptions {
  compositionKey?: string;
  rosterSeed?: number;
  matchRules?: MatchRules;
}

interface ActiveLineupReplaceOptions { requirePermutation?: boolean; }

let teamCreateQueue = Promise.resolve();

const enqueueTeamCreate = async <T>(work: () => Promise<T>): Promise<T> => {
  const result = teamCreateQueue.then(work, work);
  teamCreateQueue = result.then(() => undefined, () => undefined);
  return result;
};

// @spec LWRITE-001,LWRITE-002,LWRITE-003,LEDIT-001,LEDIT-003,LEDIT-004 — both lineup
// write verbs share the same validated, transactional replacement primitive. The explicit
// projection is also an input boundary: request-only fields must not select another Lineup.
const replaceActiveLineup = async (
  teamId: number,
  entries: ActiveLineupEntry[],
  matchRules: MatchRules,
  options: ActiveLineupReplaceOptions = {},
): Promise<TeamLineup> => {
  const team = await db.models.Team.findByPk(teamId);
  if (!team) throw new DomainError('Not found', 404);
  const lineup = await db.models.Lineup.findOne({ where: { teamId, gameId: null } });
  if (!lineup) throw new DomainError('Not found', 404);
  if (!Array.isArray(entries)) throw new DomainError('entries must be an array', 422);

  const submittedPlayerIds = new Set<number>(entries.map((entry) => entry.playerId));
  if (options.requirePermutation) {
    const storedEntries = await db.models.LineupEntry.findAll({ where: { lineupId: lineup.dataValues.id } })
      .then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
    const storedPlayerIds = new Set<number>(storedEntries.map((entry: any) => entry.playerId));
    if (submittedPlayerIds.size !== storedPlayerIds.size || entries.length !== storedEntries.length || [...submittedPlayerIds].some((playerId) => !storedPlayerIds.has(playerId))) {
      throw new DomainError('entries must be a complete permutation of the active lineup', 422);
    }
  }

  const players = submittedPlayerIds.size === 0 ? [] : await db.models.Player.findAll({
    where: { id: { [Op.in]: [...submittedPlayerIds] } },
  }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
  if (players.length !== submittedPlayerIds.size || players.some((player: any) => (
    player.teamId !== teamId || player.gameWorldId !== team.dataValues.gameWorldId
  ))) {
    throw new DomainError(options.requirePermutation ? 'every lineup player must belong to the team' : "player is not on this team's roster", 422);
  }
  try {
    validateLineup({ entries }, matchRules);
  } catch (error) {
    throw new DomainError((error as Error).message, 422);
  }

  const transaction = await db.transaction();
  try {
    await db.models.LineupEntry.destroy({ where: { lineupId: lineup.dataValues.id }, transaction });
    await db.models.LineupEntry.bulkCreate(entries.map(({ playerId, role, battingOrder, fieldingPosition }) => ({
      lineupId: lineup.dataValues.id, playerId, role, battingOrder, fieldingPosition,
    })), { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return TeamFactory(teamId).getLineup();
};

const TeamFactory = (id?: number): ITeam => {
  return {
    // @spec PCON-001,PCON-004,PCON-007,PID-010
    create: async (gwId: number, config: TeamConfig, options: TeamCreateOptions = {}) => enqueueTeamCreate(async () => {
      const transaction = await db.transaction();

      try {
        const gameWorld = await db.models.GameWorld.findByPk(gwId, { transaction }).then((gw) => {
          if (!gw) throw Error(`GameWorld '${gwId}' not found`);
          return gw.dataValues;
        });

        const team = await db.models.Team.create({
          config,
          gameWorldId: gwId
        }, { transaction }).then(({ dataValues }) => dataValues);

        await PlayerFactory().generateRoster(team.id, gwId, {
          gameWorldYear: gameWorld.year,
          compositionKey: options.compositionKey,
          seed: options.rosterSeed,
          matchRules: options.matchRules,
          transaction,
        });

        await transaction.commit();
        return team;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }),

    // @spec SCL-010,SCL-011
    getSchedule: async (gwId: number, leagueId?: number): Promise<TeamSeasonCalendar> => {
      // 1. Verify the GameWorld; its year is only a legacy fallback for pre-migration League rows.
      const gameWorld = await db.models.GameWorld.findByPk(gwId).then((gw) => {
        if (!gw) throw Error(`GameWorld '${gwId}' not found`);
        return gw.dataValues;
      });

      // 2. Resolve team name
      const team = await db.models.Team.findByPk(id)
        .then((t) => {
          if (!t) throw Error(`Team '${id}' not found`);
          return t.dataValues;
        });

      // 3. Resolve only Divisions this team has played in, with their parent Leagues.
      const teamDivisionIds = await db.models.DivisionSeason.findAll({
        attributes: ['divisionId'],
        where: { teamId: id },
      }).then((seasons) => Array.from(new Set(seasons.map((season) => season.dataValues.divisionId))));
      const divisions = teamDivisionIds.length === 0 ? [] : await db.models.Division.findAll({
        where: { id: { [Op.in]: teamDivisionIds } },
        include: [{ model: db.models.League, where: { gameWorldId: gwId } }],
      });
      const divisionIdsByYear = new Map<number, number[]>();
      divisions.forEach((division) => {
        const divisionLeagueId = division.dataValues.leagueId;
        if (leagueId != null && divisionLeagueId !== leagueId) return;
        const league = division.dataValues.League?.dataValues ?? division.dataValues.League;
        const year = league.year ?? gameWorld.year;
        divisionIdsByYear.set(year, [...(divisionIdsByYear.get(year) ?? []), division.dataValues.id]);
      });

      // 4. Batch the season and bracket-size queries by effective League year.
      const groupedSeasons = await Promise.all(Array.from(divisionIdsByYear.entries()).map(async ([year, divisionIds]) => {
        return db.models.DivisionSeason.findAll({
          where: { teamId: id, divisionId: { [Op.in]: divisionIds }, year },
          include: [
            { model: db.models.Division },
            { model: db.models.Game, through: { attributes: [] } },
          ],
        });
      }));
      const filtered = groupedSeasons.flat();

      const divisionSeasonCounts = new Map<number, number>();
      const countRowsByYear = await Promise.all(Array.from(divisionIdsByYear.entries()).map(async ([year, divisionIds]) => {
        return db.models.DivisionSeason.findAll({
          attributes: ['divisionId'],
          where: { divisionId: { [Op.in]: divisionIds }, year },
        });
      }));
      countRowsByYear.flat().forEach((season) => {
        const divisionId = season.dataValues.divisionId;
        divisionSeasonCounts.set(divisionId, (divisionSeasonCounts.get(divisionId) ?? 0) + 1);
      });

      // 5. Flatten games and collect all referenced team IDs for name lookup
      const teamIdSet = new Set<number>();
      const rawGames: Array<{ game: any; divisionId: number; divisionName: string; year: number }> = [];

      for (const ds of filtered) {
        const { dataValues: dsData } = ds;
        const div = dsData.Division;
        const divisionName = (div?.dataValues?.config ?? div?.config)?.name ?? `Division ${dsData.divisionId}`;

        for (const game of (dsData.Games ?? [])) {
          rawGames.push({ game, divisionId: dsData.divisionId, divisionName, year: dsData.year });
          teamIdSet.add(game.homeTeam);
          teamIdSet.add(game.awayTeam);
        }
      }

      // 6. Bulk-fetch all referenced team names
      const teamMap = new Map<number, string>();
      if (teamIdSet.size > 0) {
        const teams = await db.models.Team.findAll({
          where: { id: { [Op.in]: Array.from(teamIdSet) } },
        }).then((results) => results.map(({ dataValues }) => dataValues));

        teams.forEach((t) => teamMap.set(t.id, t.config?.name ?? `Team ${t.id}`));
      }

      // 7. Build structured response
      const games: TeamSeasonGame[] = rawGames.map(({ game, divisionId, divisionName, year }) => ({
        // @spec CUP-011
        gameId: game.id,
        year,
        scheduledDate: game.scheduledDate ? new Date(game.scheduledDate).toISOString() : null,
        homeTeamId: game.homeTeam,
        homeTeamName: teamMap.get(game.homeTeam) ?? `Team ${game.homeTeam}`,
        awayTeamId: game.awayTeam,
        awayTeamName: game.awayTeam == null ? 'Bye' : (teamMap.get(game.awayTeam) ?? `Team ${game.awayTeam}`),
        divisionId,
        divisionName,
        roundLabel: (() => {
          if (game.round == null) return null;

          const divisionSeason = filtered.find((ds) => ds.dataValues.divisionId === divisionId);
          const format = divisionSeason?.dataValues?.Division?.dataValues?.config?.format
            ?? divisionSeason?.dataValues?.Division?.config?.format;
          if (format?.structure === 'KNOCKOUT') {
            return getKnockoutRoundLabel(divisionSeasonCounts.get(divisionId) ?? 0, game.round);
          }

          return `Round ${game.round}`;
        })(),
        homeTeamResult: game.homeTeamResult,
        awayTeamResult: game.awayTeamResult,
        status: game.status,
      }));

      return {
        teamId: id!,
        teamName: team.config?.name ?? `Team ${id}`,
        games,
      };
    },

    // @spec ROST-001,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010,ROST-011
    // @spec XFER-022 — Contract is the membership source of truth; this now filters to
    // each player's *current* Contract (superseding ROST-004's unfiltered v1 behavior)
    // via the same resolveCurrentContract helper the player-detail read already uses.
    getRoster: async (): Promise<RosterPlayer[]> => {
      const team = await db.models.Team.findByPk(id);
      if (!team) throw new DomainError('Not found', 404);

      const gameWorld = await db.models.GameWorld.findByPk(team.dataValues.gameWorldId);
      if (!gameWorld) throw new DomainError('Not found', 404);

      const contracts = await listForTeam(id!);

      const currentDate = gameWorld.dataValues.currentDate ?? undefined;
      const year = gameWorld.dataValues.year;

      const byPlayer = new Map<number, any[]>();
      contracts.forEach((contract: any) => {
        const playerId = contract.dataValues.playerId;
        byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), contract]);
      });

      return Array.from(byPlayer.values())
        .map((playerContracts) => resolveCurrentContract(playerContracts, currentDate, year))
        .filter((contract): contract is any => contract !== null)
        .map((contract) => contract.dataValues.Player)
        .sort((a: any, b: any) => a.dataValues.id - b.dataValues.id)
        .map(toRosterPlayer(year));
    },

    // @spec LSNAP-001,LSNAP-002,LSNAP-003,LSNAP-005
    snapshotForGame: async (gameId: number): Promise<GameLineupSnapshot> => {
      const team = await db.models.Team.findByPk(id);
      if (!team) throw new DomainError('Not found', 404);
      const game = await db.models.Game.findByPk(gameId);
      if (!game) throw new DomainError('Not found', 404);

      const transaction = await db.transaction();
      try {
        const existing = await db.models.Lineup.findOne({ where: { teamId: id, gameId }, transaction });
        if (existing) {
          await transaction.commit();
          return existing.dataValues;
        }

        const active = await db.models.Lineup.findOne({ where: { teamId: id, gameId: null }, transaction });
        if (!active) throw new DomainError('Not found', 404);
        const entries = await db.models.LineupEntry.findAll({ where: { lineupId: active.dataValues.id }, transaction });
        const lineup = await db.models.Lineup.create({ teamId: id, gameWorldId: team.dataValues.gameWorldId, gameId }, { transaction });
        await db.models.LineupEntry.bulkCreate(entries.map(({ dataValues }: any) => ({
          lineupId: lineup.dataValues.id,
          playerId: dataValues.playerId,
          role: dataValues.role,
          battingOrder: dataValues.battingOrder,
          fieldingPosition: dataValues.fieldingPosition,
        })), { transaction });

        // A frozen per-game snapshot is intentionally never repaired by ContractFactory's
        // LineupFactory.repairActive() (#237) — only the active (gameId-less) Lineup is;
        // a #138-season roster is static at freeze time.
        await transaction.commit();
        return lineup.dataValues;
      } catch (error) {
        await transaction.rollback();
        if (error instanceof UniqueConstraintError) {
          const existing = await db.models.Lineup.findOne({ where: { teamId: id, gameId } });
          if (existing) return existing.dataValues;
        }
        throw error;
      }
    },

    // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LSNAP-004
    getLineup: async ({ gameId, gwId }: { gameId?: number; gwId?: number } = {}): Promise<TeamLineup> => {
      const team = await db.models.Team.findByPk(id);
      if (!team || (gwId != null && team.dataValues.gameWorldId !== gwId)) {
        throw new DomainError('Not found', 404);
      }

      const lineup = await db.models.Lineup.findOne({ where: { teamId: id, gameId: gameId ?? null } });
      if (!lineup) throw new DomainError('Not found', 404);

      const entries = await db.models.LineupEntry.findAll({ where: { lineupId: lineup.dataValues.id } })
        .then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
      const starters = entries
        .filter((entry: any) => entry.role === 'STARTER')
        .sort((a: any, b: any) => (a.battingOrder ?? Infinity) - (b.battingOrder ?? Infinity))
        .map((entry: any) => ({
          playerId: entry.playerId,
          battingOrder: entry.battingOrder,
          fieldingPosition: entry.fieldingPosition,
        }));
      const startingPitcherId = starters.find((entry) => entry.fieldingPosition === 'Pitcher')?.playerId;
      if (startingPitcherId == null) throw new DomainError('Not found', 404);

      const toPool = (role: 'BENCH' | 'BULLPEN') => entries
        .filter((entry: any) => entry.role === role)
        .map((entry: any) => ({ playerId: entry.playerId }));
      return { starters, startingPitcherId, bench: toPool('BENCH'), bullpen: toPool('BULLPEN') };
    },

    // @spec LWRITE-001,LWRITE-002,LWRITE-003 — validate before beginning destructive work, then
    // replace only a complete permutation of the gameId-less template in one transaction.
    // Per-game snapshots stay untouched.
    updateActiveLineup: async (entries: ActiveLineupEntry[], matchRules: MatchRules): Promise<TeamLineup> => {
      return replaceActiveLineup(id!, entries, matchRules, { requirePermutation: true });
    },

    // @spec LEDIT-001,LEDIT-003,LEDIT-004 — the PUT contract replaces the active template
    // with any valid current-roster selection. Unlike the legacy PATCH permutation write, it
    // retains the Lineup row and deliberately does not inspect per-game snapshots.
    saveActiveLineup: async (entries: ActiveLineupEntry[], matchRules: MatchRules): Promise<TeamLineup> => {
      return replaceActiveLineup(id!, entries, matchRules);
    },
  };
};

export { TeamFactory };
