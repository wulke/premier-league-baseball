import { Op } from 'sequelize';
import { TeamConfig, TeamSeasonCalendar, TeamSeasonGame } from "../../api/models";
import db from '../client';
import { getKnockoutRoundLabel } from './knockout';
import { PlayerFactory } from './player';

interface ITeam {
  create: (gwId: number, config: TeamConfig) => any;
  getSchedule: (gwId: number, leagueId?: number) => Promise<TeamSeasonCalendar>;
};

const TeamFactory = (id?: number): ITeam => {
  return {
    // @spec PCON-001,PCON-004,PCON-007
    create: async (gwId: number, config: TeamConfig) => {
      const team = await db.models.Team.create({
        config,
        gameWorldId: gwId
      }).then(({ dataValues }) => dataValues);
      await PlayerFactory().generateRoster(team.id, gwId);
      return team;
    },

    getSchedule: async (gwId: number, leagueId?: number): Promise<TeamSeasonCalendar> => {
      // 1. Resolve year from game world
      const gameWorld = await db.models.GameWorld.findByPk(gwId)
        .then((gw) => {
          if (!gw) throw Error(`GameWorld '${gwId}' not found`);
          return gw.dataValues;
        });

      // 2. Resolve team name
      const team = await db.models.Team.findByPk(id)
        .then((t) => {
          if (!t) throw Error(`Team '${id}' not found`);
          return t.dataValues;
        });

      // 3. Load all DivisionSeason entries for this team and year,
      //    with the parent Division (for name + leagueId) and linked Games
      const divisionSeasons = await db.models.DivisionSeason.findAll({
        where: { teamId: id, year: gameWorld.year },
        include: [
          { model: db.models.Division },
          { model: db.models.Game, through: { attributes: [] } },
        ],
      });

      // 4. Optionally filter to one league (Division.leagueId)
      const filtered = leagueId
        ? divisionSeasons.filter((ds) => {
            const div = ds.dataValues.Division;
            return div && (div.dataValues?.leagueId ?? div.leagueId) === leagueId;
          })
        : divisionSeasons;

      const divisionIds = Array.from(new Set(filtered.map((ds) => ds.dataValues.divisionId)));
      const divisionSeasonCounts = divisionIds.length === 0
        ? new Map<number, number>()
        : await db.models.DivisionSeason.findAll({
            where: {
              year: gameWorld.year,
              divisionId: { [Op.in]: divisionIds },
            },
          }).then((rows) => rows.reduce((counts, row) => {
            const { divisionId } = row.dataValues;
            counts.set(divisionId, (counts.get(divisionId) ?? 0) + 1);
            return counts;
          }, new Map<number, number>()));

      // 5. Flatten games and collect all referenced team IDs for name lookup
      const teamIdSet = new Set<number>();
      const rawGames: Array<{ game: any; divisionId: number; divisionName: string }> = [];

      for (const ds of filtered) {
        const { dataValues: dsData } = ds;
        const div = dsData.Division;
        const divisionName = (div?.dataValues?.config ?? div?.config)?.name ?? `Division ${dsData.divisionId}`;

        for (const game of (dsData.Games ?? [])) {
          rawGames.push({ game, divisionId: dsData.divisionId, divisionName });
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
      const games: TeamSeasonGame[] = rawGames.map(({ game, divisionId, divisionName }) => ({
        // @spec CUP-011
        gameId: game.id,
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
        year: gameWorld.year,
        games,
      };
    },
  };
};

export { TeamFactory };
