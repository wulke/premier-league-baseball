import db from '../../src/db/client';
import { LeagueFactory } from '../../src/db/domain';
import { Endpoints } from '../../src/api/endpoints';
import { GameFormula, LeagueConfig, LeagueType } from '../../src/api/models';
import { router } from '../../src/api/router';

describe('League standings API', () => {
  it('GET /api/league/:leagueId/standings handler returns standings grouped by division', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      [{ name: 'Red' }, { name: 'Blue' }]
        .map((config) => db.models.Team.create({ config, gameWorldId: gw.id }).then(({ dataValues }) => dataValues))
    );

    const leagueConfig: LeagueConfig = {
      name: 'API Standings League',
      type: LeagueType.League,
      divisions: [{
        name: 'API Division',
        defaultTeams: [0, 1],
        gameFormula: [GameFormula.ONE_LEG, GameFormula.Bo1, GameFormula.ROUND_ROBIN, GameFormula.AGGREGATE]
      }]
    };
    const league = await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id));

    const division = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((result) => { if (!result) throw Error(); return result.dataValues.Divisions[0].dataValues; });

    const dsRed = await db.models.DivisionSeason.create({
      divisionId: division.id,
      teamId: teams[0].id,
      year: gw.year
    }).then(({ dataValues }) => dataValues);
    const dsBlue = await db.models.DivisionSeason.create({
      divisionId: division.id,
      teamId: teams[1].id,
      year: gw.year
    }).then(({ dataValues }) => dataValues);

    const game = await db.models.Game.create({
      homeTeam: teams[0].id,
      awayTeam: teams[1].id,
      homeTeamResult: 2,
      awayTeamResult: 0
    }).then(({ dataValues }) => dataValues);

    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: game.id, divisionSeasonId: dsRed.id },
      { gameId: game.id, divisionSeasonId: dsBlue.id }
    ]);

    const standingsPath = Endpoints.GetLeagueStandings;
    const layer = router.stack.find((l) => l.route?.path === standingsPath && l.route?.methods?.get);
    if (!layer) throw Error('League standings route handler not found');

    const req: any = { params: { leagueId: `${league.id}` } };
    const res: any = { send: jest.fn() };

    await layer.route.stack[0].handle(req, res);

    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(body).toHaveLength(1);
    expect(body[0].divisionName).toBe('API Division');
    expect(body[0].standings).toHaveLength(2);
    expect(body[0].standings[0].teamName).toBe('Red');
    expect(body[0].standings[0].points).toBe(3);
    expect(body[0].standings[1].teamName).toBe('Blue');
    expect(body[0].standings[1].points).toBe(0);
  });
});
