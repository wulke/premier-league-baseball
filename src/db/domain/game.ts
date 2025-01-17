import db from '../client';

interface IGame {
  create: (homeTeam: number, awayTeam: number) => any;
};

const GameFactory = (id?: number) => {
  return {
    create: async (homeTeam:number, awayTeam:number) => {
      /* todo: scheduledDate? */
      return await db.models.Game.create({
        homeTeam,
        awayTeam,
        // scheduleDate: ???
      }).then(({ dataValues }) => dataValues);
    }
  };
};

export { GameFactory };