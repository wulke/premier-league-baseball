import { TeamConfig } from "../../api/models";
import db from '../client';

interface ITeam {
  create: (gwId: number, config: TeamConfig) => any;
  // schedule: (config: { year?: number }) => any;
};

const TeamFactory = (id?: number): ITeam => {
  return {
    create: async (gwId: number, config: TeamConfig) => {
      const team = await db.models.Team.create({
        config,
        gameWorldId: gwId
      }).then(({ dataValues }) => dataValues);
      return team;
    },
    // schedule: async (config: { year?: number }) => {
    //   const team = await db.models.Team.findByPk(id, { include: { model: db.models.GameWorld }});
    //   console.debug(team);
    //   if (!config.year) {
    //     // get current year of game world
    //   }
    //   /* how to know which season? */
    // },
  };
};

export { TeamFactory };