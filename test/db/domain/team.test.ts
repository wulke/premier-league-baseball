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
});
