import { NewGameWorld } from "../../api/models";
import db from '../client';
import { LeagueFactory, TeamFactory } from ".";

interface IGameWorld {
  create: (NewGameWorld) => any;
  find: () => any | any[];
  newSeason: () => any;
};

const GameWorldFactory = (id?: number): IGameWorld => {
  return {
    create: async (config: NewGameWorld) => {
      // create game world
      const gw = await db.models.GameWorld.create({
        config: { ...config, inProgress: false },
      }).then(({ dataValues }) => dataValues);
      // create teams
      const teams = await Promise.all(config.teams?.map(async (teamConfig) => 
        await TeamFactory().create(gw.id, teamConfig)
      ));
      // create Leagues
      const leagues = await Promise.all(config.leagues?.map(async (leagueConfig) =>
        await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id ))
      ));
      return { ...gw, leagues, teams };
    },
    find: async () => 
      id ? await db.models.GameWorld.findByPk(id, { include: [db.models.League, db.models.Team]})
         : await db.models.GameWorld.findAll(),
    newSeason: async () => {
      if (!id) throw Error('no game world to start new season');
      return await db.models.GameWorld.findByPk(id, { include: db.models.League })
        .then((gw) => {
          if (!gw) throw Error(`No gameworld exists with id='${id}'`);
          return gw.dataValues;
        })
        .then(async (gw) => {
          // transaction: https://sequelize.org/docs/v6/other-topics/transactions
          const transaction = await db.transaction();
          try {
            const currentYear = gw.year;
            // (1) increment year <= do we want to move this?
            await db.models.GameWorld.increment({ year: 1 }, { where: { id: gw.id }});
            await db.models.GameWorld.update({ config: { ...gw.config, inProgress: true }}, { where: { id: gw.id }});
            // (2) for each League.newSeason()
            await Promise.all(
              gw.Leagues
                .map(({ dataValues }) => dataValues.id)
                .map((id) => LeagueFactory(id).newSeason(currentYear))
            );
            // (3) commit transaction
            await transaction.commit();
          } catch (error) {
            console.error(error);
            await transaction.rollback();
          }
          return GameWorldFactory(id).find();
        });
    }
  }
};

export { GameWorldFactory };