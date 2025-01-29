import { Op } from 'sequelize';
import db from '../client';

interface IGame {
  create: (homeTeam: number, awayTeam: number) => any;
  result: (homeTeam: number, awayTeam: number) => any;
};

const GameFactory = (id?: number): IGame => {
  return {
    create: async (homeTeam:number, awayTeam:number) => {
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
      }, {
        where: {
          id: {
            [Op.eq]: id
          }
        }
      });
    }
  };
};

export { GameFactory };