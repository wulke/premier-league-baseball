import { TeamConfig } from "../../api/models";
import db from '../client';

interface ITeam {
  create: (gwId: number, config: TeamConfig) => any;
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
  };
};

export { TeamFactory };