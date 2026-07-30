import { GameWorldFactory, LeagueFactory } from '../../../src/db/domain';
import { LeagueConfig, LeagueType, useDefaultGameWorld } from '../../../src/api/models';
import db from '../../../src/db/client';
import { Op } from 'sequelize';

const ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const KNOCKOUT_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
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
      expect(divisions.length).toStrictEqual(league.config.divisions.length);
    });
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
      divisions: [
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
      ]
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
      divisions: [{
        name: 'Single Division',
        defaultTeams: [0, 1],
        format: ROUND_ROBIN_FORMAT,
      }]
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
      divisions: [{
        name: 'Round 1',
        defaultTeams: [0, 1],
        format: KNOCKOUT_FORMAT,
      }]
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
