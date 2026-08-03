import { Op } from 'sequelize';
import db from '../client';
import { DomainError } from './errors';
import { GameWorldFactory } from './game-world';
import { resolveKnockoutGameCompletion } from './knockout-advancement';
import { resolveRoundRobinGameCompletion } from './season-result';

const toDateStr = (d: any): string => new Date(d).toISOString().slice(0, 10);

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

    result: async (homeTeam: number, awayTeam: number) => {
      return await db.models.Game.update({
        homeTeamResult: homeTeam,
        awayTeamResult: awayTeam,
        status: 'COMPLETED'
      }, {
        where: {
          id: { [Op.eq]: id }
        }
      });
    },

    simulate: async () => {
      const game = await db.models.Game.findByPk(id);
      if (!game) throw new DomainError('the game was not found', 404);

      const { status, scheduledDate } = game.dataValues;

      if (status === 'COMPLETED') {
        throw new DomainError('the game has already been completed', 422);
      }
      if (status === 'IN_PROGRESS') {
        throw new DomainError('the game cannot be simulated in its current status', 422);
      }

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
      }

      const homeTeamResult = Math.floor(Math.random() * 10);
      const awayTeamResult = Math.floor(Math.random() * 10);

      const [affectedCount] = await db.models.Game.update(
        { homeTeamResult, awayTeamResult, status: 'COMPLETED' },
        { where: { id, status: { [Op.ne]: 'COMPLETED' } } }
      );
      if (affectedCount === 0) {
        throw new DomainError('the game has already been completed', 422);
      }

      const updated = await db.models.Game.findByPk(id);
      // @spec CUP-001,LCH-002 round-robin / knockout completion hooks (single-game path)
      await resolveKnockoutGameCompletion(id!);
      await resolveRoundRobinGameCompletion(id!);
      return updated!.dataValues;
    },

    simulateBatch: async (gwId: number, endDate?: string) => {
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

          const homeTeamResult = Math.floor(Math.random() * 10);
          const awayTeamResult = Math.floor(Math.random() * 10);

          await db.models.Game.update(
            { homeTeamResult, awayTeamResult, status: 'COMPLETED' },
            { where: { id: game.dataValues.id }, transaction: t }
          );

          simulated.push({ ...game.dataValues, homeTeamResult, awayTeamResult, status: 'COMPLETED' });
        }

        await t.commit();
      } catch (error) {
        await t.rollback();
        throw error;
      }

      // @spec CUP-001,LCH-002 round-robin / knockout completion hooks (batch path).
      // Runs AFTER the transaction commits (edge case e4) so the "last unresolved game in
      // round" check sees the full batch. Idempotent, so deduping by gameId is sufficient.
      const advanced = new Set<number>();
      for (const sim of simulated) {
        if (advanced.has(sim.id)) continue;
        advanced.add(sim.id);
        await resolveKnockoutGameCompletion(sim.id);
        await resolveRoundRobinGameCompletion(sim.id);
      }

      return { simulated, skipped };
    },

    // @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006 rapidSimulateSeason:
    // fast-forward an entire GameWorld's remaining season by repeatedly simulating the
    // current date's batch and advancing currentDate to the next distinct scheduledDate
    // among remaining non-COMPLETED games, until none remain. Built entirely on
    // simulateBatch (unchanged) + GameWorldFactory.advanceCurrentDate; never calls
    // newSeason. See docs/llds/rapid-simulate-season.md.
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
