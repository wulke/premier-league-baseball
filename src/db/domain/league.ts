import { LeagueConfig } from "../../api/models";
import { DivisionFactory } from './division';
import db from '../client';
import { Op } from 'sequelize';

interface ILeague {
  create: (gwId: number, config: any, teamIdRefs: number[]) => any;
  get: () => any;
  isSeasonComplete: (year: number) => any;
  newSeason: (year: number) => any;
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

  return {
    isSeasonComplete,
    create: async (gwId: number, config: LeagueConfig, teamIdRefs: number[]) => {
      const league = await db.models.League.create({
        config,
        gameWorldId: gwId
      }).then(({ dataValues }) => dataValues);
      await Promise.all(config.divisions.map(async (divisionConfig) => 
        await db.models.Division.create({
          config: Object.assign({}, {
            ...divisionConfig,
            defaultTeams: divisionConfig.defaultTeams.map((idx) => teamIdRefs[idx]),
            gameFormula: divisionConfig.gameFormula ?? config.gameFormula,
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
      // ## todo ## update for knockout tournaments
      await Promise.all(
        league.Divisions
          .map(({ dataValues }) => dataValues.id)
          .map((id) => DivisionFactory(id).newSeason(currentYear))
      );
      return;
    }
  }
};

export { LeagueFactory };