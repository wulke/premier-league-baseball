// @spec PCON-001,PCON-004,PCON-007
import db from '../../../src/db/client';
import { TeamFactory } from '../../../src/db/domain';

const ONE_LEG_KNOCKOUT_FIXED_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  seeding: 'FIXED' as const,
};

describe('TeamFactory', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
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
  });

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
  });

  // @spec PCON-001,PCON-004,PCON-007
  it('@spec PCON-001 @spec PCON-004 @spec PCON-007 creates an initial roster with matching contracts after the team row exists', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const gw = await db.models.GameWorld.create({ config: {}, year: 2054 }).then((m) => m.dataValues);

    try {
      const team = await TeamFactory().create(gw.id, { name: 'Milwaukee Makers' });
      const hydratedTeam = await db.models.Team.findByPk(team.id, {
        include: [db.models.Player, db.models.Contract],
      });

      expect(hydratedTeam?.dataValues.Players).toHaveLength(20);
      expect(hydratedTeam?.dataValues.Contracts).toHaveLength(20);
      hydratedTeam?.dataValues.Players.forEach((player: any) => {
        expect(player.dataValues.teamId).toBe(team.id);
      });
      hydratedTeam?.dataValues.Contracts.forEach((contract: any) => {
        expect(contract.dataValues.teamId).toBe(team.id);
        expect(contract.dataValues.startYear).toBe(gw.year);
        expect(contract.dataValues.endYear).toBe(gw.year);
      });
    } finally {
      randomSpy.mockRestore();
    }
  });
});
