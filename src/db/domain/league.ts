import { DefaultStandingsConfig, DivisionStandings, LeagueConfig, LeagueDivisionBracket, StandingsConfig, validateLeagueConfig } from "../../api/models";
import { DivisionFactory } from './division';
import db from '../client';
import { Transaction } from 'sequelize';
import { DomainError } from './errors';
import { reconcileTeamMemberships } from './contract';

interface ILeague {
  create: (gwId: number, config: LeagueConfig, teamIdRefs: number[]) => any;
  createContainer: (gwId: number, config: LeagueConfig) => any;
  createDivisions: (config: LeagueConfig, teamIdRefs: number[]) => Promise<void>;
  get: () => any;
  isSeasonComplete: (year: number) => any;
  cutover: () => Promise<{ id: number; year: number; status: 'CUTOVER' }>;
  start: () => Promise<{ id: number; year: number; status: 'IN_SEASON' }>;
  newSeason: (year: number) => any;
  getBracket: () => Promise<LeagueDivisionBracket[]>;
  getStandings: () => Promise<DivisionStandings[]>;
};

const LeagueFactory = (id?: number): ILeague => {
  // @spec SCL-008
  const recomputeGameWorldInProgress = async (gameWorldId: number, transaction: Transaction) => {
    const gameWorld = await db.models.GameWorld.findByPk(gameWorldId, { transaction });
    if (!gameWorld) throw Error(`Invalid GameWorld '${gameWorldId}'`);

    const inProgress = await db.models.League.count({
      where: { gameWorldId, status: 'IN_SEASON' },
      transaction,
    }) > 0;
    await db.models.GameWorld.update({
      config: { ...gameWorld.dataValues.config, inProgress },
    }, { where: { id: gameWorldId }, transaction });
  };

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

  // @spec SCL-002,SCL-008
  const cutover = async (): Promise<{ id: number; year: number; status: 'CUTOVER' }> => {
    const league = await getLeague();
    if (league.status !== 'IN_SEASON') {
      throw new DomainError('league is not in season', 422);
    }
    if (!(await isSeasonComplete(league.year))) {
      throw new DomainError('season is not complete', 422);
    }

    const year = league.year + 1;
    const transaction = await db.transaction();
    try {
      await db.models.League.update({ year, status: 'CUTOVER' }, { where: { id: league.id }, transaction });
      await recomputeGameWorldInProgress(league.gameWorldId, transaction);
      // @spec XFER-008 — corrects any Player.teamId left stale by natural contract expiry.
      const gameWorld = await db.models.GameWorld.findByPk(league.gameWorldId, { transaction });
      if (!gameWorld) throw Error(`Invalid GameWorld '${league.gameWorldId}'`);
      await reconcileTeamMemberships(
        league.gameWorldId,
        gameWorld.dataValues.currentDate ?? undefined,
        gameWorld.dataValues.year,
        transaction,
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return { id: league.id, year, status: 'CUTOVER' };
  };

  // @spec SCL-003,SCL-004,SCL-005,SCL-006,SCL-007,SCL-008,SCL-009,MSS-005
  const start = async (): Promise<{ id: number; year: number; status: 'IN_SEASON' }> => {
    const league = await getLeague();
    if (league.status !== 'CUTOVER') {
      throw new DomainError('league is not in cutover', 422);
    }

    const gameWorld = await db.models.GameWorld.findByPk(league.gameWorldId)
      .then((world) => {
        if (!world) throw Error(`Invalid GameWorld '${league.gameWorldId}'`);
        return world.dataValues;
      });

    const firstStageId = league.config.stages[0].id;
    const firstStageDivisions = league.Divisions.filter(({ dataValues: division }) => division.config.stageId === firstStageId);

    for (const { dataValues: division } of firstStageDivisions) {
      const startDate = division.config.schedulingConfig?.startDate;
      if (gameWorld.currentDate != null && startDate != null && startDate <= gameWorld.currentDate) {
        throw new DomainError(`Division ${division.id} start date must be after the GameWorld current date`, 422);
      }
    }

    const transaction = await db.transaction();
    try {
      for (const { dataValues: division } of firstStageDivisions) {
        await DivisionFactory(division.id).newSeason(league.year - 1, league.year, { transaction });
      }
      await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: league.id }, transaction });
      await recomputeGameWorldInProgress(league.gameWorldId, transaction);
      // @spec SCL-006,SCL-007
      if (gameWorld.currentDate == null) {
        const startDates = firstStageDivisions
          .map(({ dataValues: division }) => division.config.schedulingConfig?.startDate)
          .filter((startDate): startDate is string => startDate != null);
        if (startDates.length > 0) {
          await db.models.GameWorld.update({ currentDate: startDates.sort()[0] }, {
            where: { id: gameWorld.id }, transaction,
          });
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return { id: league.id, year: league.year, status: 'IN_SEASON' };
  };

  // @spec API-001,API-002,API-003,API-004
  const getBracket = async (): Promise<LeagueDivisionBracket[]> => {
    const league = await db.models.League.findByPk(id, {
      include: [db.models.GameWorld, db.models.Division]
    }).then((l) => {
      if (!l) throw Error(`Invalid League '${id}'`);
      return l.dataValues;
    });

    const year: number = league.GameWorld.year;

    return Promise.all(
      league.Divisions.map(async ({ dataValues: div }) => {
        const bracket = await DivisionFactory(div.id).getBracket(year);
        return {
          divisionId: div.id,
          divisionName: div.config.name,
          structure: div.config.format.structure,
          ...(bracket.champion ? { champion: bracket.champion } : {}),
          rounds: bracket.rounds,
        };
      })
    );
  };

  return {
    isSeasonComplete,
    getBracket,
    getStandings,
    cutover,
    start,
    // @spec TLO-004 — the split creation primitives GameWorldFactory composes: the
    // League row (container) exists before its Teams (whose homeLeagueId FK needs
    // it), and Divisions follow once Team ids exist. `create` below remains the
    // one-step composite for direct callers whose Teams already exist.
    createContainer: async (gwId: number, config: LeagueConfig) => {
      // @spec CFG-011,CFG-012,CFG-013,CFG-014,CFG-015,CFG-016,CFG-017,SCL-001,MSS-004
      validateLeagueConfig(config);
      const gameWorld = await db.models.GameWorld.findByPk(gwId);
      if (!gameWorld) throw Error(`Invalid GameWorld '${gwId}'`);
      return await db.models.League.create({
        config,
        gameWorldId: gwId,
        year: gameWorld.dataValues.year,
        status: 'CUTOVER',
      }).then(({ dataValues }) => dataValues);
    },
    createDivisions: async (config: LeagueConfig, teamIdRefs: number[]) => {
      // @spec MSS-004 — stamps stageId/stageOrder; defaultTeams indices resolve
      // against the owning (or external source) League's team-id array (TLO-002).
      await Promise.all(config.stages.flatMap((stage) => stage.divisions.map(async (divisionConfig, stageOrder) =>
        db.models.Division.create({
          config: {
            ...divisionConfig,
            stageId: stage.id,
            stageOrder,
            defaultTeams: divisionConfig.defaultTeams.map((idx) => teamIdRefs[idx]),
            format: divisionConfig.format,
          },
          leagueId: id,
        }),
      )));
    },
    create: async (gwId: number, config: LeagueConfig, teamIdRefs: number[]) => {
      const league = await LeagueFactory().createContainer(gwId, config);
      await LeagueFactory(league.id).createDivisions(config, teamIdRefs);
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
