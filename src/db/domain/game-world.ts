import { Op } from 'sequelize';
import { NewGameWorld, RosterPlayer, validateNewGameWorld } from "../../api/models";
import db from '../client';
import { DomainError } from './errors';
import { LeagueFactory, TeamFactory, resolveCurrentContract, toRosterPlayer } from ".";
import { deleteForGameWorld } from './contract';

interface IGameWorld {
  create: (NewGameWorld) => any;
  find: () => any | any[];
  newSeason: () => any;
  advanceCurrentDate: (date: string) => Promise<{ id: number; currentDate: string }>;
  setManagedClub: (teamId: number | null) => Promise<{ id: number; managedTeamId: number | null }>;
  getFreeAgents: () => Promise<RosterPlayer[]>;
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
    // @spec TLO-002,TLO-003,TLO-004 — per-League team ownership replaces the old
    // "first configured League" composition threading: (1) all Leagues exist as
    // empty containers, (2) each League's own Teams are created in leagues[] order
    // with homeLeagueId naming their owner (an externalTeams League pulls the
    // strictly-prior source's already-created Teams instead of creating rows),
    // (3) Divisions follow for every League. DivisionSeasons still materialize at
    // League.start (unchanged).
    create: async (config: NewGameWorld) => {
      // @spec TLO-003 — ownership validation precedes any write, so a malformed
      // payload leaves no partial world behind.
      validateNewGameWorld(config);
      // create game world
      const gw = await db.models.GameWorld.create({
        config: { ...config, inProgress: false },
      }).then(({ dataValues }) => dataValues);
      // (1) all Leagues as empty containers, in leagues[] order
      const leagues = await Promise.all(config.leagues.map(async (leagueConfig) =>
        await LeagueFactory().createContainer(gw.id, leagueConfig)
      ));
      // (2) per-League Teams, still in leagues[] order; a League's Team ids are
      // registered under its key so later externalTeams references resolve.
      const teamsByLeagueKey = new Map<string, any[]>();
      const teamIdsByLeagueIndex = new Map<number, number[]>();
      const createdTeams: any[] = [];
      for (const [index, leagueConfig] of config.leagues.entries()) {
        if (leagueConfig.teams) {
          const teams = await Promise.all(leagueConfig.teams.map(async (teamConfig) =>
            await TeamFactory().create(gw.id, teamConfig, { homeLeagueId: leagues[index].id })
          ));
          teams.forEach((team) => createdTeams.push(team));
          teamIdsByLeagueIndex.set(index, teams.map(({ id }) => id));
          if (leagueConfig.key != null) teamsByLeagueKey.set(leagueConfig.key, teams);
        } else {
          // @spec TLO-007 — externalTeams reuses the source's exact Team rows; no
          // new Teams are created and homeLeagueId is left untouched.
          const sourceTeams = teamsByLeagueKey.get(leagueConfig.externalTeams!);
          if (!sourceTeams) {
            throw Error(`League '${leagueConfig.name}' references unresolved externalTeams '${leagueConfig.externalTeams}'`);
          }
          teamIdsByLeagueIndex.set(index, sourceTeams.map(({ id }) => id));
          if (leagueConfig.key != null) teamsByLeagueKey.set(leagueConfig.key, sourceTeams);
        }
      }
      // (3) Divisions for all Leagues
      for (const [index, leagueConfig] of config.leagues.entries()) {
        await LeagueFactory(leagues[index].id).createDivisions(leagueConfig, teamIdsByLeagueIndex.get(index) ?? []);
      }
      return { ...gw, leagues, teams: createdTeams };
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
    // @spec XFER-009,XFER-023 — read via GameWorld's own association (backend-standards §1
    // exception: a Factory may read an associated model via `include`, starting from its
    // own primary key), reusing the same row serializer TeamFactory.getRoster() uses.
    getFreeAgents: async (): Promise<RosterPlayer[]> => {
      if (!id) throw Error('no game world to list free agents for');
      const gameWorld = await db.models.GameWorld.findByPk(id, {
        include: [{ model: db.models.Player, include: [db.models.Contract] }],
      });
      if (!gameWorld) throw notFoundError(Number(id));

      const currentDate = gameWorld.dataValues.currentDate ?? undefined;
      const year = gameWorld.dataValues.year;
      const players = gameWorld.dataValues.Players ?? [];

      return players
        .filter((player: any) => resolveCurrentContract(player.dataValues.Contracts ?? [], currentDate, year) === null)
        .map(toRosterPlayer(year));
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

        const lineups = await db.models.Lineup.findAll({ where: { gameWorldId }, transaction });
        const lineupIds = mapIds(lineups);

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

        if (lineupIds.length > 0) {
          await db.models.LineupEntry.destroy({ where: { lineupId: { [Op.in]: lineupIds } }, transaction });
          await db.models.Lineup.destroy({ where: { id: { [Op.in]: lineupIds } }, transaction });
        }

        // @spec GWD-002 — ContractFactory owns the cascade's Contract mutation.
        await deleteForGameWorld({ playerIds, teamIds }, { transaction });

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
