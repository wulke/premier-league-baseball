import { GameWorldFactory, LeagueFactory } from '../../../src/db/domain';
import { LeagueConfig, LeagueType, useDefaultGameWorld } from '../../../src/api/models';
import db from '../../../src/db/client';
import { Op } from 'sequelize';
import { DomainError } from '../../../src/db/domain/errors';

jest.setTimeout(30000);

const ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  winsToAdvance: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const KNOCKOUT_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  winsToAdvance: 'Bo1' as const,
  seeding: 'FIXED' as const,
};

describe('LeagueFactory (initial Season)', () => {
  let gw;
  beforeAll(async () => {
    await db.sync({ force: true });
    gw = await GameWorldFactory().create(useDefaultGameWorld());
  });
  it('create: Creates correct default League configuration', async () => {
    const leagues = (await db.models.League.findAll({
      where: {
        gameWorldId: {
          [Op.eq]: gw.id
        }
      }
    })).map(({ dataValues }) => dataValues);
    leagues.forEach(async (league) => {
      const divisions = (await db.models.Division.findAll({
        where: {
          leagueId: {
            [Op.eq]: league.id
          }
        }
      })).map(({ dataValues }) => dataValues);
      expect(divisions.length).toStrictEqual(league.config.stages[0].divisions.length);
    });
  });
  // @spec SCL-001
  it('create: initializes its season year from the parent GameWorld in CUTOVER', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2031, config: {} })
      .then(({ dataValues }) => dataValues);
    const league = await LeagueFactory().create(gameWorld.id, {
      name: 'Lifecycle League',
      type: LeagueType.League,
      stages: [{ id: "default", name: "Default", divisions: [] }],
    }, []);

    expect(league.year).toBe(2031);
    expect(league.status).toBe('CUTOVER');
  });
  it('isSeasonComplete: True when initial season', async () => {
    await gw.leagues.forEach(async ({ id }) => {
      expect(await LeagueFactory(id).isSeasonComplete(gw.year)).toBeTruthy();
    });
    expect(gw.leagues.length).toStrictEqual(gw.config.leagues.length);
  });

  it('getStandings: reads standings from current game world year', async () => {
    const sgw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }, { name: 'Delta' }]
        .map((config) => db.models.Team.create({ config, gameWorldId: sgw.id }).then(({ dataValues }) => dataValues))
    );

    const config: LeagueConfig = {
      name: 'Year Selection League',
      type: LeagueType.League,
      stages: [{ id: "default", name: "Default", divisions: [
        {
          name: 'Division A',
          defaultTeams: [0, 1],
          format: ROUND_ROBIN_FORMAT,
        },
        {
          name: 'Division B',
          defaultTeams: [2, 3],
          format: ROUND_ROBIN_FORMAT,
        }
      ] }]
    };

    const league = await LeagueFactory().create(sgw.id, config, teams.map(({ id }) => id));
    const divisions = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((result) => { if (!result) throw Error(); return result.dataValues.Divisions.map(({ dataValues }) => dataValues); });
    const [divisionA, divisionB] = divisions;

    const seasonRows = await Promise.all([
      db.models.DivisionSeason.create({ divisionId: divisionA.id, teamId: teams[0].id, year: sgw.year }).then(({ dataValues }) => dataValues),
      db.models.DivisionSeason.create({ divisionId: divisionA.id, teamId: teams[1].id, year: sgw.year }).then(({ dataValues }) => dataValues),
      db.models.DivisionSeason.create({ divisionId: divisionB.id, teamId: teams[2].id, year: sgw.year }).then(({ dataValues }) => dataValues),
      db.models.DivisionSeason.create({ divisionId: divisionB.id, teamId: teams[3].id, year: sgw.year }).then(({ dataValues }) => dataValues),
    ]);

    const dsAlphaCurrent = seasonRows[0];
    const dsBetaCurrent = seasonRows[1];
    const dsGammaCurrent = seasonRows[2];
    const dsDeltaCurrent = seasonRows[3];

    const gameAlphaWinCurrent = await db.models.Game.create({
      homeTeam: teams[0].id,
      awayTeam: teams[1].id,
      homeTeamResult: 1,
      awayTeamResult: 0
    }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: gameAlphaWinCurrent.id, divisionSeasonId: dsAlphaCurrent.id },
      { gameId: gameAlphaWinCurrent.id, divisionSeasonId: dsBetaCurrent.id }
    ]);

    const gameDrawCurrent = await db.models.Game.create({
      homeTeam: teams[2].id,
      awayTeam: teams[3].id,
      homeTeamResult: 1,
      awayTeamResult: 1
    }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: gameDrawCurrent.id, divisionSeasonId: dsGammaCurrent.id },
      { gameId: gameDrawCurrent.id, divisionSeasonId: dsDeltaCurrent.id }
    ]);

    const standings = await LeagueFactory(league.id).getStandings();
    expect(standings).toHaveLength(2);
    expect(standings.map((s) => s.divisionName)).toEqual(expect.arrayContaining(['Division A', 'Division B']));

    const divisionAStandings = standings.find((s) => s.divisionName === 'Division A')!.standings;
    expect(divisionAStandings[0].teamName).toBe('Alpha');
    expect(divisionAStandings[0].points).toBe(3);
    expect(divisionAStandings[1].teamName).toBe('Beta');
    expect(divisionAStandings[1].points).toBe(0);
  });

  it('getStandings: honors table-mode standingsConfig points', async () => {
    const sgw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      [{ name: 'Knights' }, { name: 'Pirates' }]
        .map((config) => db.models.Team.create({ config, gameWorldId: sgw.id }).then(({ dataValues }) => dataValues))
    );

    const config: LeagueConfig = {
      name: 'Custom Points League',
      type: LeagueType.League,
      standingsConfig: { mode: 'table', points: { win: 5, draw: 2, loss: 0 } },
      stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Single Division',
        defaultTeams: [0, 1], isTopTier: true,
        format: ROUND_ROBIN_FORMAT,
      }] }]
    };

    const league = await LeagueFactory().create(sgw.id, config, teams.map(({ id }) => id));
    const division = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((result) => { if (!result) throw Error(); return result.dataValues.Divisions[0].dataValues; });

    const dsA = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: teams[0].id, year: sgw.year
    }).then(({ dataValues }) => dataValues);
    const dsB = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: teams[1].id, year: sgw.year
    }).then(({ dataValues }) => dataValues);

    const game = await db.models.Game.create({
      homeTeam: teams[0].id,
      awayTeam: teams[1].id,
      homeTeamResult: 3,
      awayTeamResult: 2
    }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: game.id, divisionSeasonId: dsA.id },
      { gameId: game.id, divisionSeasonId: dsB.id }
    ]);

    const standings = await LeagueFactory(league.id).getStandings();
    expect(standings).toHaveLength(1);
    expect(standings[0].standings[0].teamName).toBe('Knights');
    expect(standings[0].standings[0].points).toBe(5);
    expect(standings[0].standings[1].teamName).toBe('Pirates');
    expect(standings[0].standings[1].points).toBe(0);
  });

  it('getStandings: honors elimination-mode standingsConfig points', async () => {
    const sgw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      [{ name: 'Team A' }, { name: 'Team B' }]
        .map((config) => db.models.Team.create({ config, gameWorldId: sgw.id }).then(({ dataValues }) => dataValues))
    );

    const config: LeagueConfig = {
      name: 'Knockout League',
      type: LeagueType.LeagueCup,
      standingsConfig: { mode: 'elimination', points: { win: 1, loss: 0 } },
      stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Round 1',
        defaultTeams: [0, 1], isTopTier: true,
        format: KNOCKOUT_FORMAT,
      }] }]
    };

    const league = await LeagueFactory().create(sgw.id, config, teams.map(({ id }) => id));
    const division = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((result) => { if (!result) throw Error(); return result.dataValues.Divisions[0].dataValues; });

    const dsA = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: teams[0].id, year: sgw.year
    }).then(({ dataValues }) => dataValues);
    const dsB = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: teams[1].id, year: sgw.year
    }).then(({ dataValues }) => dataValues);

    const game = await db.models.Game.create({
      homeTeam: teams[0].id,
      awayTeam: teams[1].id,
      homeTeamResult: 2,
      awayTeamResult: 1
    }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: game.id, divisionSeasonId: dsA.id },
      { gameId: game.id, divisionSeasonId: dsB.id }
    ]);

    const standings = await LeagueFactory(league.id).getStandings();
    expect(standings).toHaveLength(1);
    expect(standings[0].standings[0].teamName).toBe('Team A');
    expect(standings[0].standings[0].points).toBe(1);
    expect(standings[0].standings[1].teamName).toBe('Team B');
    expect(standings[0].standings[1].points).toBe(0);
  });
});

describe('LeagueFactory.cutover', () => {
  let gameWorld: any;
  let league: any;
  let division: any;
  let teams: any[];

  beforeEach(async () => {
    await db.sync({ force: true });
    gameWorld = await db.models.GameWorld.create({ year: 2027, config: {} })
      .then(({ dataValues }) => dataValues);
    league = await LeagueFactory().create(gameWorld.id, {
      name: 'Cutover League', type: LeagueType.League, stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Division A', defaultTeams: [], isTopTier: true, format: ROUND_ROBIN_FORMAT,
      }] }],
    }, []);
    division = await db.models.Division.findOne({ where: { leagueId: league.id } })
      .then((row) => row!.dataValues);
    teams = await Promise.all(['Home', 'Away'].map((name) => db.models.Team.create({
      gameWorldId: gameWorld.id, config: { name },
    }).then(({ dataValues }) => dataValues)));
  });

  // @spec SCL-002
  it('rejects with 422 and preserves the League when it is not IN_SEASON', async () => {
    await expect(LeagueFactory(league.id).cutover()).rejects.toMatchObject({
      statusCode: 422,
      message: 'league is not in season',
    } satisfies Partial<DomainError>);

    const unchanged = await LeagueFactory(league.id).get();
    expect(unchanged).toMatchObject({ year: 2027, status: 'CUTOVER' });
  });

  // @spec SCL-002
  it('rejects with 422 and preserves the League when its current season is incomplete', async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: league.id } });
    const season = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: teams[0].id, year: 2027 })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: teams[0].id, awayTeam: teams[1].id, status: 'SCHEDULED' })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });

    await expect(LeagueFactory(league.id).cutover()).rejects.toMatchObject({
      statusCode: 422,
      message: 'season is not complete',
    } satisfies Partial<DomainError>);

    const unchanged = await LeagueFactory(league.id).get();
    expect(unchanged).toMatchObject({ year: 2027, status: 'IN_SEASON' });
  });

  // @spec SCL-002
  it('increments the year and moves a complete IN_SEASON League to CUTOVER', async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: league.id } });
    const season = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: teams[0].id, year: 2027 })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: teams[0].id, awayTeam: teams[1].id, status: 'COMPLETED', homeTeamResult: 1, awayTeamResult: 0 })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });

    await expect(LeagueFactory(league.id).cutover()).resolves.toEqual({ id: league.id, year: 2028, status: 'CUTOVER' });
    await expect(LeagueFactory(league.id).get()).resolves.toMatchObject({ year: 2028, status: 'CUTOVER' });
  });

  // @spec SCL-002
  it('allows an IN_SEASON League with zero DivisionSeason rows to cut over', async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: league.id } });

    await expect(LeagueFactory(league.id).cutover()).resolves.toEqual({ id: league.id, year: 2028, status: 'CUTOVER' });
  });
});

describe('LeagueFactory.start', () => {
  let gameWorld: any;
  let league: any;
  let division: any;
  let teams: any[];

  beforeEach(async () => {
    await db.sync({ force: true });
    gameWorld = await db.models.GameWorld.create({ year: 2030, currentDate: '2027-03-01', config: {} })
      .then(({ dataValues }) => dataValues);
    teams = await Promise.all(['Home', 'Away'].map((name) => db.models.Team.create({
      gameWorldId: gameWorld.id, config: { name },
    }).then(({ dataValues }) => dataValues)));
    league = await LeagueFactory().create(gameWorld.id, {
      name: 'Start League', type: LeagueType.League, stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Division A', defaultTeams: [0, 1], isTopTier: true, format: ROUND_ROBIN_FORMAT,
        schedulingConfig: { startDate: '2027-03-08', intervalDays: 7 },
      }] }],
    }, teams.map(({ id }) => id));
    division = await db.models.Division.findOne({ where: { leagueId: league.id } })
      .then((row) => row!.dataValues);
  });

  // @spec SCL-003
  it('rejects with 422 and generates nothing when the League is not in CUTOVER', async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: league.id } });

    await expect(LeagueFactory(league.id).start()).rejects.toMatchObject({
      statusCode: 422,
      message: 'league is not in cutover',
    } satisfies Partial<DomainError>);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: division.id } })).resolves.toBe(0);
  });

  // @spec SCL-004
  it('rejects with the offending Division and generates nothing when startDate is on the current date', async () => {
    await db.models.Division.update({
      config: { ...division.config, schedulingConfig: { startDate: '2027-03-01', intervalDays: 7 } },
    }, { where: { id: division.id } });

    await expect(LeagueFactory(league.id).start()).rejects.toMatchObject({
      statusCode: 422,
      message: `Division ${division.id} start date must be after the GameWorld current date`,
    } satisfies Partial<DomainError>);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: division.id } })).resolves.toBe(0);
    await expect(db.models.Game.count()).resolves.toBe(0);
  });

  // @spec SCL-004
  it('starts without a date constraint when the GameWorld currentDate is null', async () => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: gameWorld.id } });

    await expect(LeagueFactory(league.id).start()).resolves.toEqual({
      id: league.id, year: 2030, status: 'IN_SEASON',
    });
  });

  // @spec SCL-006
  it('bootstraps an unset GameWorld currentDate to the earliest configured Division startDate', async () => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: gameWorld.id } });
    await db.models.Division.create({
      leagueId: league.id,
      config: {
        name: 'Earlier Division', defaultTeams: teams.map(({ id }) => id), format: ROUND_ROBIN_FORMAT,
        schedulingConfig: { startDate: '2027-02-22', intervalDays: 7 },
      },
    });

    await LeagueFactory(league.id).start();

    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { currentDate: '2027-02-22' },
    });
  });

  // @spec SCL-006
  it('leaves an unset GameWorld currentDate unset when no Division has schedulingConfig', async () => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: gameWorld.id } });
    await db.models.Division.update({
      config: { ...division.config, schedulingConfig: undefined },
    }, { where: { id: division.id } });

    await LeagueFactory(league.id).start();

    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { currentDate: null },
    });
  });

  // @spec SCL-007
  it('leaves an existing GameWorld currentDate unchanged when a later League starts', async () => {
    await LeagueFactory(league.id).start();

    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { currentDate: '2027-03-01' },
    });
  });

  // @spec SCL-005,SCL-009
  it('generates the Division season using League.year rather than GameWorld.year', async () => {
    await db.models.League.update({ year: 2027 }, { where: { id: league.id } });

    await LeagueFactory(league.id).start();

    await expect(db.models.DivisionSeason.count({ where: { divisionId: division.id, year: 2027 } })).resolves.toBe(2);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: division.id, year: 2030 } })).resolves.toBe(0);
  });

  // @spec SCL-005
  it('rolls back every Division when a later Division fails to generate', async () => {
    const invalidDivision = await db.models.Division.create({
      leagueId: league.id,
      config: { name: 'Invalid Division', defaultTeams: teams.map(({ id }) => id) },
    }).then(({ dataValues }) => dataValues);

    await expect(LeagueFactory(league.id).start()).rejects.toThrow();

    await expect(db.models.DivisionSeason.count({
      where: { divisionId: { [Op.in]: [division.id, invalidDivision.id] } },
    })).resolves.toBe(0);
    await expect(db.models.Game.count()).resolves.toBe(0);
    await expect(LeagueFactory(league.id).get()).resolves.toMatchObject({ status: 'CUTOVER' });
  });

  // @spec SCL-008
  it('derives GameWorld.config.inProgress as true when this League starts', async () => {
    await LeagueFactory(league.id).start();

    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { config: { inProgress: true } },
    });
  });
});

describe('LeagueFactory lifecycle GameWorld inProgress derivation', () => {
  let gameWorld: any;
  let firstLeague: any;
  let secondLeague: any;

  beforeEach(async () => {
    await db.sync({ force: true });
    gameWorld = await db.models.GameWorld.create({ year: 2027, config: { name: 'Shared World', inProgress: false } })
      .then(({ dataValues }) => dataValues);
    firstLeague = await LeagueFactory().create(gameWorld.id, {
      name: 'First League', type: LeagueType.League, stages: [{ id: "default", name: "Default", divisions: [] }],
    }, []);
    secondLeague = await LeagueFactory().create(gameWorld.id, {
      name: 'Second League', type: LeagueType.League, stages: [{ id: "default", name: "Default", divisions: [] }],
    }, []);
  });

  // @spec SCL-008
  it('keeps inProgress true until the last IN_SEASON sibling cuts over, preserving config', async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: [firstLeague.id, secondLeague.id] } });

    await LeagueFactory(firstLeague.id).cutover();
    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { config: { name: 'Shared World', inProgress: true } },
    });

    await LeagueFactory(secondLeague.id).cutover();
    await expect(db.models.GameWorld.findByPk(gameWorld.id)).resolves.toMatchObject({
      dataValues: { config: { name: 'Shared World', inProgress: false } },
    });
  });
});
