import { DefaultStandingsConfig, DivisionStandings, LeagueConfig, StandingsConfig, resolveCompetitionFormat } from "../../api/models";
import { DivisionFactory } from './division';
import db from '../client';
import { Op } from 'sequelize';

interface ILeague {
  create: (gwId: number, config: any, teamIdRefs: number[]) => any;
  get: () => any;
  isSeasonComplete: (year: number) => any;
  newSeason: (year: number) => any;
  getStandings: () => Promise<DivisionStandings[]>;
};

const LeagueFactory = (id?: number): ILeague => {
  const getLeague = async () => {
    /* todo: support for dynamic options */
    return await db.models.League.findByPk(id, { include: { model: db.models.Division, include: [db.models.Team] }})
      .then((league) => {
        if (!league) throw Error(`Invalid League '${id}`);
        return league.dataValues;
      });
  };
  const isSeasonComplete = async (year: number): Promise<boolean> => {
    return await getLeague()
      .then(async (league) => {
        return await Promise.all(league.Divisions.map(async ({ dataValues }) => {
          // return await db.models.DivisionSeason.findAll({
          //   where: {
          //     year: {
          //       [Op.eq]: year
          //     },
          //     divisionId: {
          //       [Op.eq]: dataValues.id
          //     }
          //   }
          // })
          return DivisionFactory(dataValues.id).isSeasonComplete(year);
        }));
      })
      .then((response) => {
        return response.every((value) => value);
      });
  };

  const getStandings = async (): Promise<DivisionStandings[]> => {
    const league = await db.models.League.findByPk(id, {
      include: [db.models.GameWorld, db.models.Division]
    }).then((l) => {
      if (!l) throw Error(`Invalid League '${id}'`);
      return l.dataValues;
    });

    const year: number = league.GameWorld.year;
    const standingsConfig: StandingsConfig = league.config.standingsConfig ?? DefaultStandingsConfig;

    return Promise.all(
      league.Divisions.map(async ({ dataValues: div }) => ({
        divisionId: div.id,
        divisionName: div.config.name,
        standings: await DivisionFactory(div.id).getStandings(year, standingsConfig),
      }))
    );
  };

  return {
    isSeasonComplete,
    getStandings,
    create: async (gwId: number, config: LeagueConfig, teamIdRefs: number[]) => {
      // @spec CFG-001
      const league = await db.models.League.create({
        config,
        gameWorldId: gwId
      }).then(({ dataValues }) => dataValues);
      await Promise.all(config.divisions.map(async (divisionConfig) => 
        await db.models.Division.create({
          config: Object.assign({}, {
            ...divisionConfig,
            defaultTeams: divisionConfig.defaultTeams.map((idx) => teamIdRefs[idx]),
            format: resolveCompetitionFormat(divisionConfig, config),
          }),
          leagueId: league.id
        })
      ));
      return league;
    },
    get: getLeague,
    newSeason: async (currentYear: number) => {
      const league = await getLeague();
      // (1) check all season is complete
      if (!(await isSeasonComplete(currentYear))) throw Error(`Seasonis not complete for id='${id}' and year='${currentYear}'`);
      // (2) each division starts a new season
      for (const { dataValues } of league.Divisions) {
        await DivisionFactory(dataValues.id).newSeason(currentYear);
      }
      return;
    }
  }
};

export { LeagueFactory };
