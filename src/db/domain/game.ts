import { Op } from 'sequelize';
import db from '../client';
import { DomainError } from './errors';
import { resolveKnockoutGameCompletion } from './knockout-advancement';
import { resolveRoundRobinGameCompletion } from './season-result';

const toDateStr = (d: any): string => new Date(d).toISOString().slice(0, 10);

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

      await db.models.Game.update(
        { homeTeamResult, awayTeamResult, status: 'COMPLETED' },
        { where: { id } }
      );

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
  };
};

export { GameFactory };
