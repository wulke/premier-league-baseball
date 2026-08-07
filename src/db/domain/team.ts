import { Op } from 'sequelize';
import { TeamConfig, TeamSeasonCalendar, TeamSeasonGame } from "../../api/models";
import db from '../client';
import { getKnockoutRoundLabel } from './knockout';
import { PlayerFactory } from './player';

interface ITeam {
  create: (gwId: number, config: TeamConfig, options?: TeamCreateOptions) => any;
  getSchedule: (gwId: number, leagueId?: number) => Promise<TeamSeasonCalendar>;
};

interface TeamCreateOptions {
  compositionKey?: string;
  rosterSeed?: number;
}

let teamCreateQueue = Promise.resolve();

const enqueueTeamCreate = async <T>(work: () => Promise<T>): Promise<T> => {
  const result = teamCreateQueue.then(work, work);
  teamCreateQueue = result.then(() => undefined, () => undefined);
  return result;
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
  };
};

export { TeamFactory };
