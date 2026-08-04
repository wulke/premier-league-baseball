import { Op } from 'sequelize';
import { TeamConfig, TeamSeasonCalendar, TeamSeasonGame } from "../../api/models";
import db from '../client';
import { getKnockoutRoundLabel } from './knockout';
import { PlayerFactory } from './player';

interface ITeam {
  create: (gwId: number, config: TeamConfig) => any;
  getSchedule: (gwId: number, leagueId?: number) => Promise<TeamSeasonCalendar>;
};

let teamCreateQueue = Promise.resolve();

const enqueueTeamCreate = async <T>(work: () => Promise<T>): Promise<T> => {
  const result = teamCreateQueue.then(work, work);
  teamCreateQueue = result.then(() => undefined, () => undefined);
  return result;
};

const TeamFactory = (id?: number): ITeam => {
  return {
    // @spec PCON-001,PCON-004,PCON-007
    create: async (gwId: number, config: TeamConfig) => enqueueTeamCreate(async () => {
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

      // 3. Resolve each Division's parent League, then query its current year.
      const divisions = await db.models.Division.findAll({
        include: [{ model: db.models.League, where: { gameWorldId: gwId } }],
      });
      const selectedDivisions = divisions.filter((division) => {
        const divisionLeagueId = division.dataValues.leagueId;
        return leagueId == null || divisionLeagueId === leagueId;
      });
      const divisionSeasonsByDivision = await Promise.all(selectedDivisions.map(async (division) => {
        const league = division.dataValues.League?.dataValues ?? division.dataValues.League;
        const year = league.year ?? gameWorld.year;
        return db.models.DivisionSeason.findAll({
          where: { teamId: id, divisionId: division.dataValues.id, year },
          include: [
            { model: db.models.Division },
            { model: db.models.Game, through: { attributes: [] } },
          ],
        });
      }));
      const filtered = divisionSeasonsByDivision.flat();

      const divisionSeasonCounts = new Map<number, number>();
      await Promise.all(selectedDivisions.map(async (division) => {
        const league = division.dataValues.League?.dataValues ?? division.dataValues.League;
        const year = league.year ?? gameWorld.year;
        const count = await db.models.DivisionSeason.count({
          where: { divisionId: division.dataValues.id, year },
        });
        divisionSeasonCounts.set(division.dataValues.id, count);
      }));

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
  };
};

export { TeamFactory };
