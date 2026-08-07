import { Op } from 'sequelize';
import { NewGameWorld } from "../../api/models";
import db from '../client';
import { DomainError } from './errors';
import { LeagueFactory, TeamFactory } from ".";

interface IGameWorld {
  create: (NewGameWorld) => any;
  find: () => any | any[];
  newSeason: () => any;
  advanceCurrentDate: (date: string) => Promise<{ id: number; currentDate: string }>;
  setManagedClub: (teamId: number | null) => Promise<{ id: number; managedTeamId: number | null }>;
  delete: () => Promise<{ id: number }>;
};

const mapIds = (rows: any[]): number[] => rows.map(({ dataValues }) => dataValues.id);
const notFoundError = (id: number) => {
  const error: Error & { statusCode?: number } = Error(`No gameworld exists with id='${id}'`);
  error.statusCode = 404;
  return error;
};

const GameWorldFactory = (id?: number): IGameWorld => {
  return {
    create: async (config: NewGameWorld) => {
      // create game world
      const gw = await db.models.GameWorld.create({
        config: { ...config, inProgress: false },
      }).then(({ dataValues }) => dataValues);
      // @spec PID-010 — teams are shared across the world's Leagues and are created
      // before Division membership exists, so the first configured League is the
      // explicit primary identity-composition source.
      const primaryCompositionKey = config.leagues?.[0]?.compositionKey;
      // create teams
      const teams = await Promise.all(config.teams?.map(async (teamConfig) => 
        await TeamFactory().create(gw.id, teamConfig, { compositionKey: primaryCompositionKey })
      ));
      // create Leagues
      const leagues = await Promise.all(config.leagues?.map(async (leagueConfig) =>
        await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id ))
      ));
      return { ...gw, leagues, teams };
    },
    find: async () => 
      id ? await db.models.GameWorld.findByPk(id, { include: [db.models.League, db.models.Team]})
         : await db.models.GameWorld.findAll(),
    // @spec GWS-001,SCL-008
    newSeason: async () => {
      if (!id) throw Error('no game world to start new season');
      return await db.models.GameWorld.findByPk(id, { include: db.models.League })
        .then((gw) => {
          if (!gw) throw Error(`No gameworld exists with id='${id}'`);
          return gw.dataValues;
        })
        .then(async (gw) => {
          const currentYear = gw.year;
          try {
            // (1) increment year <= do we want to move this?
            await db.models.GameWorld.increment({ year: 1 }, { where: { id: gw.id }});
            // (2) for each League.newSeason()
            for (const { dataValues } of gw.Leagues) {
              await LeagueFactory(dataValues.id).newSeason(currentYear);
            }
            const inProgress = await db.models.League.count({
              where: { gameWorldId: gw.id, status: 'IN_SEASON' },
            }) > 0;
            await db.models.GameWorld.update({ config: { ...gw.config, inProgress }}, { where: { id: gw.id }});
          } catch (error) {
            console.error(error);
            throw error;
          }
          return GameWorldFactory(id).find();
        });
    },
    // @spec RSS-008 advanceCurrentDate: a strictly-forward currentDate mutator used by
    // rapidSimulateSeason. Rejects non-forward dates (422) and missing GameWorlds (404);
    // mirrors newSeason's `if (!id) throw` guard when invoked without an id.
    advanceCurrentDate: async (date: string) => {
      if (!id) throw Error('no game world to advance');
      const gameWorld = await db.models.GameWorld.findByPk(id);
      if (!gameWorld) throw notFoundError(Number(id));
      const current = gameWorld.dataValues.currentDate;
      if (current != null && date <= current) {
        throw new DomainError("date must be strictly after the GameWorld's current currentDate", 422);
      }
      await db.models.GameWorld.update({ currentDate: date }, { where: { id } });
      return { id, currentDate: date };
    },
    // @spec MCLB-003,MCLB-004,MCLB-005
    setManagedClub: async (teamId: number | null) => {
      if (!id) throw Error('no game world to set managed club');
      const gameWorld = await db.models.GameWorld.findByPk(id);
      if (!gameWorld) throw notFoundError(Number(id));

      if (teamId !== null) {
        if (typeof teamId !== 'number' || !Number.isInteger(teamId)) {
          throw new DomainError('teamId must be an integer or null', 422);
        }
        const team = await db.models.Team.findByPk(teamId);
        if (!team || team.dataValues.gameWorldId !== gameWorld.dataValues.id) {
          throw new DomainError('teamId must belong to the target GameWorld', 422);
        }
      }

      await db.models.GameWorld.update({ managedTeamId: teamId }, { where: { id } });
      return { id, managedTeamId: teamId };
    },
    // @spec GWD-001,GWD-002,GWD-003,GWD-004
    delete: async () => {
      const gameWorldId = typeof id === 'number' && Number.isFinite(id) ? id : undefined;
      if (gameWorldId === undefined) throw notFoundError(Number(id));

      const gameWorld = await db.models.GameWorld.findByPk(gameWorldId);
      if (!gameWorld) throw notFoundError(gameWorldId);

      const transaction = await db.transaction();

      try {
        const leagues = await db.models.League.findAll({
          where: { gameWorldId },
          transaction,
        });
        const leagueIds = mapIds(leagues);

        const teams = await db.models.Team.findAll({
          where: { gameWorldId },
          transaction,
        });
        const teamIds = mapIds(teams);

        const players = await db.models.Player.findAll({
          where: { gameWorldId },
          transaction,
        });
        const playerIds = mapIds(players);

        const divisions = leagueIds.length === 0 ? [] : await db.models.Division.findAll({
          where: { leagueId: { [Op.in]: leagueIds } },
          transaction,
        });
        const divisionIds = mapIds(divisions);

        const divisionSeasons = divisionIds.length === 0 ? [] : await db.models.DivisionSeason.findAll({
          where: { divisionId: { [Op.in]: divisionIds } },
          transaction,
        });
        const divisionSeasonIds = mapIds(divisionSeasons);

        const divisionSeasonGames = divisionSeasonIds.length === 0 ? [] : await db.models.DivisionSeasonGame.findAll({
          where: { divisionSeasonId: { [Op.in]: divisionSeasonIds } },
          transaction,
        });
        const gameIds = Array.from(new Set(divisionSeasonGames.map(({ dataValues }) => dataValues.gameId)));

        if (playerIds.length > 0) {
          await db.models.PlayerGameStats.destroy({
            where: { playerId: { [Op.in]: playerIds } },
            transaction,
          });
        }

        const contractWhere = [
          ...(playerIds.length > 0 ? [{ playerId: { [Op.in]: playerIds } }] : []),
          ...(teamIds.length > 0 ? [{ teamId: { [Op.in]: teamIds } }] : []),
        ];
        if (contractWhere.length > 0) {
          await db.models.Contract.destroy({
            where: { [Op.or]: contractWhere },
            transaction,
          });
        }

        if (divisionIds.length > 0) {
          await db.models.SeasonResult.destroy({
            where: { divisionId: { [Op.in]: divisionIds } },
            transaction,
          });
        }

        if (divisionSeasonIds.length > 0) {
          await db.models.DivisionSeasonGame.destroy({
            where: { divisionSeasonId: { [Op.in]: divisionSeasonIds } },
            transaction,
          });
        }

        if (gameIds.length > 0) {
          const remainingGameLinks = await db.models.DivisionSeasonGame.findAll({
            where: { gameId: { [Op.in]: gameIds } },
            transaction,
          });
          const remainingGameIds = new Set(remainingGameLinks.map(({ dataValues }) => dataValues.gameId));
          const orphanGameIds = gameIds.filter((gameId) => !remainingGameIds.has(gameId));

          if (orphanGameIds.length > 0) {
            await db.models.Game.destroy({
              where: { id: { [Op.in]: orphanGameIds } },
              transaction,
            });
          }
        }

        if (divisionSeasonIds.length > 0) {
          await db.models.DivisionSeason.destroy({
            where: { id: { [Op.in]: divisionSeasonIds } },
            transaction,
          });
        }

        if (divisionIds.length > 0) {
          await db.models.Division.destroy({
            where: { id: { [Op.in]: divisionIds } },
            transaction,
          });
        }

        await db.models.Player.destroy({
          where: { gameWorldId },
          transaction,
        });
        await db.models.Team.destroy({
          where: { gameWorldId },
          transaction,
        });
        await db.models.League.destroy({
          where: { gameWorldId },
          transaction,
        });
        await db.models.GameWorld.destroy({
          where: { id: gameWorldId },
          transaction,
        });

        await transaction.commit();
        return { id: gameWorldId };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
  }
};

export { GameWorldFactory };
