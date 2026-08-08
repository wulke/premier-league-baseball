// @spec PCON-001,PCON-004,PCON-007
import db from '../../../src/db/client';
import { TeamFactory } from '../../../src/db/domain';
import { generateIdentity, LEAGUE_COMPOSITIONS, mulberry32 } from '../../../src/db/domain/identity';

const ONE_LEG_KNOCKOUT_FIXED_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  winsToAdvance: 'Bo1' as const,
  seeding: 'FIXED' as const,
};

describe('TeamFactory', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec SCL-010,SCL-011
  it('@spec SCL-010 @spec SCL-011 returns games from each League\'s current year with a per-game year', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2026 }).then(({ dataValues }) => dataValues);
    const [team, mlsOpponent, uefaOpponent] = await Promise.all(
      ['Calendar Club', 'MLS Opponent', 'UEFA Opponent'].map((name) =>
        db.models.Team.create({ gameWorldId: gw.id, config: { name } }).then(({ dataValues }) => dataValues)
      )
    );
    const [mls, uefa] = await Promise.all([
      db.models.League.create({ gameWorldId: gw.id, config: { name: 'MLS' }, year: 2028, status: 'IN_SEASON' }).then(({ dataValues }) => dataValues),
      db.models.League.create({ gameWorldId: gw.id, config: { name: 'UEFA' }, year: 2027, status: 'IN_SEASON' }).then(({ dataValues }) => dataValues),
    ]);
    const [mlsDivision, uefaDivision] = await Promise.all([
      db.models.Division.create({ leagueId: mls.id, config: { name: 'MLS Division', defaultTeams: [] } }).then(({ dataValues }) => dataValues),
      db.models.Division.create({ leagueId: uefa.id, config: { name: 'UEFA Division', defaultTeams: [] } }).then(({ dataValues }) => dataValues),
    ]);
    const [mlsSeason, uefaSeason] = await Promise.all([
      db.models.DivisionSeason.create({ divisionId: mlsDivision.id, teamId: team.id, year: mls.year }).then(({ dataValues }) => dataValues),
      db.models.DivisionSeason.create({ divisionId: uefaDivision.id, teamId: team.id, year: uefa.year }).then(({ dataValues }) => dataValues),
    ]);
    const [mlsGame, uefaGame] = await Promise.all([
      db.models.Game.create({ homeTeam: team.id, awayTeam: mlsOpponent.id, scheduledDate: '2028-04-01' }).then(({ dataValues }) => dataValues),
      db.models.Game.create({ homeTeam: team.id, awayTeam: uefaOpponent.id, scheduledDate: '2027-09-01' }).then(({ dataValues }) => dataValues),
    ]);
    await db.models.DivisionSeasonGame.bulkCreate([
      { divisionSeasonId: mlsSeason.id, gameId: mlsGame.id },
      { divisionSeasonId: uefaSeason.id, gameId: uefaGame.id },
    ]);

    const schedule = await TeamFactory(team.id).getSchedule(gw.id);

    expect(schedule).not.toHaveProperty('year');
    expect(schedule.games).toEqual(expect.arrayContaining([
      expect.objectContaining({ gameId: mlsGame.id, year: 2028 }),
      expect.objectContaining({ gameId: uefaGame.id, year: 2027 }),
    ]));
  });

  // @spec CUP-011
  it('@spec CUP-011 renders knockout rounds with tournament-convention labels for a 44-team bracket', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2044 }).then((m) => m.dataValues);
    const teams = await Promise.all(
      [...Array(44).keys()].map((i) => TeamFactory().create(gw.id, { name: `Cup Team ${i}` }))
    );

    const league = await db.models.League.create({
      gameWorldId: gw.id,
      config: {
        name: 'League Cup',
        type: 'League Cup',
      }
    }).then(({ dataValues }) => dataValues);

    const division = await db.models.Division.create({
      leagueId: league.id,
      config: {
        name: '1st Round',
        defaultTeams: teams.map(({ id }) => id),
        format: ONE_LEG_KNOCKOUT_FIXED_FORMAT,
      }
    }).then(({ dataValues }) => dataValues);

    await db.models.DivisionSeason.bulkCreate(
      teams.map(({ id: teamId }, bracketSlot) => ({
        divisionId: division.id,
        teamId,
        year: gw.year,
        bracketSlot,
      }))
    );

    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: division.id, year: gw.year },
      order: [['bracketSlot', 'ASC']]
    }).then((rows) => rows.map(({ dataValues }) => dataValues));

    const scheduleTeam = divisionSeasons[0];
    const opponentSeasons = divisionSeasons.slice(1, 7);

    const roundDefinitions = [
      { round: 1, opponent: opponentSeasons[0].teamId, expectedLabel: '1st Round' },
      { round: 2, opponent: opponentSeasons[1].teamId, expectedLabel: 'Round of 32' },
      { round: 3, opponent: opponentSeasons[2].teamId, expectedLabel: 'Round of 16' },
      { round: 4, opponent: opponentSeasons[3].teamId, expectedLabel: 'Quarterfinals' },
      { round: 5, opponent: opponentSeasons[4].teamId, expectedLabel: 'Semifinals' },
      { round: 6, opponent: opponentSeasons[5].teamId, expectedLabel: 'Final' },
    ];

    for (const { round, opponent } of roundDefinitions) {
      const game = await db.models.Game.create({
        homeTeam: scheduleTeam.teamId,
        awayTeam: opponent,
        round,
      }).then(({ dataValues }) => dataValues);

      const opponentSeason = divisionSeasons.find((season) => season.teamId === opponent);
      if (!opponentSeason) throw Error();

      await db.models.DivisionSeasonGame.bulkCreate([
        { gameId: game.id, divisionSeasonId: scheduleTeam.id },
        { gameId: game.id, divisionSeasonId: opponentSeason.id },
      ]);
    }

    const schedule = await TeamFactory(scheduleTeam.teamId).getSchedule(gw.id, league.id);

    expect(schedule.games.map((game) => game.roundLabel)).toEqual(
      roundDefinitions.map(({ expectedLabel }) => expectedLabel)
    );
  }, 10000);

  // @spec CUP-011
  it('@spec CUP-011 renders knockout rounds with tournament-convention labels for an 8-team bracket', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2045 }).then((m) => m.dataValues);
    const teams = await Promise.all(
      [...Array(8).keys()].map((i) => TeamFactory().create(gw.id, { name: `Eight Team ${i}` }))
    );

    const league = await db.models.League.create({
      gameWorldId: gw.id,
      config: {
        name: 'Eight Team Cup',
        type: 'League Cup',
      }
    }).then(({ dataValues }) => dataValues);

    const division = await db.models.Division.create({
      leagueId: league.id,
      config: {
        name: 'Quarterfinals',
        defaultTeams: teams.map(({ id }) => id),
        format: ONE_LEG_KNOCKOUT_FIXED_FORMAT,
      }
    }).then(({ dataValues }) => dataValues);

    await db.models.DivisionSeason.bulkCreate(
      teams.map(({ id: teamId }, bracketSlot) => ({
        divisionId: division.id,
        teamId,
        year: gw.year,
        bracketSlot,
      }))
    );

    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: division.id, year: gw.year },
      order: [['bracketSlot', 'ASC']]
    }).then((rows) => rows.map(({ dataValues }) => dataValues));

    const scheduleTeam = divisionSeasons[0];
    const opponentSeasons = divisionSeasons.slice(1, 5);

    const roundDefinitions = [
      { round: 1, opponent: opponentSeasons[0].teamId, expectedLabel: 'Quarterfinals' },
      { round: 2, opponent: opponentSeasons[1].teamId, expectedLabel: 'Semifinals' },
      { round: 3, opponent: opponentSeasons[2].teamId, expectedLabel: 'Final' },
    ];

    for (const { round, opponent } of roundDefinitions) {
      const game = await db.models.Game.create({
        homeTeam: scheduleTeam.teamId,
        awayTeam: opponent,
        round,
      }).then(({ dataValues }) => dataValues);

      const opponentSeason = divisionSeasons.find((season) => season.teamId === opponent);
      if (!opponentSeason) throw Error();

      await db.models.DivisionSeasonGame.bulkCreate([
        { gameId: game.id, divisionSeasonId: scheduleTeam.id },
        { gameId: game.id, divisionSeasonId: opponentSeason.id },
      ]);
    }

    const schedule = await TeamFactory(scheduleTeam.teamId).getSchedule(gw.id, league.id);

    expect(schedule.games.map((game) => game.roundLabel)).toEqual(
      roundDefinitions.map(({ expectedLabel }) => expectedLabel)
    );
  }, 10000);

  // @spec PCON-001,PCON-004,PCON-007,PID-010
  it('@spec PCON-001 @spec PCON-004 @spec PCON-007 @spec PID-010 creates an initial roster with matching contracts after the team row exists', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const gw = await db.models.GameWorld.create({ config: {}, year: 2054 }).then((m) => m.dataValues);

    try {
      const team = await TeamFactory().create(gw.id, { name: 'Milwaukee Makers' }, { compositionKey: 'NPB', rosterSeed: 168 });
      const hydratedTeam = await db.models.Team.findByPk(team.id, {
        include: [db.models.Player, db.models.Contract],
      });

      expect(hydratedTeam?.dataValues.Players).toHaveLength(20);
      expect(hydratedTeam?.dataValues.Contracts).toHaveLength(20);
      hydratedTeam?.dataValues.Players.forEach((player: any) => {
        expect(player.dataValues.teamId).toBe(team.id);
      });
      expect(hydratedTeam?.dataValues.Players[0].dataValues.countryCode).toBe(
        generateIdentity(LEAGUE_COMPOSITIONS.NPB, mulberry32(168), gw.year).countryCode
      );
      hydratedTeam?.dataValues.Contracts.forEach((contract: any) => {
        expect(contract.dataValues.teamId).toBe(team.id);
        expect(contract.dataValues.startDate).toEqual(new Date(`${gw.year}-03-01T00:00:00.000Z`));
        expect(contract.dataValues.endDate).toEqual(new Date(`${gw.year}-10-31T00:00:00.000Z`));
      });
    } finally {
      randomSpy.mockRestore();
    }
  });

  // @spec PCON-004,PCON-007
  it('@spec PCON-004 @spec PCON-007 rolls back the team row when roster contract issuance fails', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2055 }).then((m) => m.dataValues);
    const originalBulkCreate = db.models.Contract.bulkCreate;
    const contractCountBefore = await db.models.Contract.count();

    db.models.Contract.bulkCreate = jest.fn().mockRejectedValueOnce(new Error('forced contract failure')) as typeof originalBulkCreate;

    try {
      await expect(TeamFactory().create(gw.id, { name: 'Rollback Club' })).rejects.toThrow('forced contract failure');

      const teams = await db.models.Team.findAll({
        where: { gameWorldId: gw.id },
      });
      const players = await db.models.Player.findAll({
        where: { gameWorldId: gw.id },
      });
      const contractCountAfter = await db.models.Contract.count();

      expect(teams).toHaveLength(0);
      expect(players).toHaveLength(0);
      expect(contractCountAfter).toBe(contractCountBefore);
    } finally {
      db.models.Contract.bulkCreate = originalBulkCreate;
    }
  });

  // @spec ROST-007,ROST-008,ROST-009
  it('@spec ROST-007 @spec ROST-008 @spec ROST-009 reads Contract membership even when Player.teamId is null', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2056 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, config: { name: 'Contract Club' } }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      teamId: null,
      gameWorldId: gw.id,
      givenName: 'Contract',
      familyName: 'Only',
      countryCode: 'US',
      bats: 'L',
      throws: 'R',
      birthDate: new Date('2030-06-01T00:00:00.000Z'),
      attributes: {
        contact: 61, power: 62, armStrength: 63, accuracy: 64, reaction: 65, vision: 66, discipline: 67,
        positions: { Pitcher: 10, Catcher: 10, FirstBase: 70, SecondBase: 10, ThirdBase: 10, Shortstop: 80, LeftField: 10, CenterField: 10, RightField: 10 },
        pitches: [],
      },
    }).then(({ dataValues }) => dataValues);
    await db.models.Contract.create({
      playerId: player.id,
      teamId: team.id,
      startDate: new Date('2056-03-01T00:00:00.000Z'),
      endDate: new Date('2056-10-31T00:00:00.000Z'),
    });

    await expect(TeamFactory(team.id).getRoster()).resolves.toEqual([expect.objectContaining({
      id: player.id,
      age: 26,
      primaryPosition: 'Shortstop',
      positionCoverage: ['FirstBase', 'Shortstop'],
      contact: 61,
      discipline: 67,
    })]);
  });
});
