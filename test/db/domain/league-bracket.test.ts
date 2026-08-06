// @spec API-001,API-002,API-003,API-004

import db from '../../../src/db/client';
import { Endpoints } from '../../../src/api/endpoints';
import { LeagueConfig, LeagueType } from '../../../src/api/models';
import { router } from '../../../src/api/router';
import { DivisionFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';

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

const getBracketRoute = () => {
  const bracketPath = Endpoints.GetLeagueBracket;
  const layer = router.stack.find((l) => l.route?.path === bracketPath && l.route?.methods?.get);
  if (!layer) throw Error('League bracket route handler not found');
  return layer.route.stack[0].handle;
};

const getDivisionId = async (leagueId: number): Promise<number> =>
  db.models.League.findByPk(leagueId, { include: db.models.Division })
    .then((result) => {
      if (!result) throw Error();
      return result.dataValues.Divisions[0].id;
    });

const getRoundGames = async (divisionId: number, year: number, round: number) => {
  const seasons = await db.models.DivisionSeason.findAll({
    where: { divisionId, year },
    include: [{ model: db.models.Game, through: { attributes: [] } }],
  });
  const seen = new Set<number>();
  return seasons
    .flatMap((ds) => (ds.dataValues.Games ?? []) as any[])
    .filter((game) => {
      if (seen.has(game.id) || game.round !== round) return false;
      seen.add(game.id);
      return true;
    });
};

describe('Division bracket shaping', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec API-001
  it('@spec API-001 rejects a nonexistent league id with the existing league error convention', async () => {
    const handler = getBracketRoute();
    const req: any = { params: { leagueId: '999999' } };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      error: expect.stringContaining("Invalid League '999999'"),
    });
  });

  // @spec API-002 @spec API-004
  it('@spec API-002 @spec API-004 returns one bracket entry per division with structure, rounds, and champion from SeasonResult', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      ['Albion', 'Borough', 'City', 'Dynamos', 'Evergreen']
        .map((name) => TeamFactory().create(gw.id, { name }))
    );

    const leagueConfig: LeagueConfig = {
      name: 'Mixed Structure League',
      type: LeagueType.League,
      stages: [{ id: "default", name: "Default", divisions: [
        {
          name: 'Premier Division',
          defaultTeams: [0, 1],
          format: ROUND_ROBIN_FORMAT,
          isTopTier: true,
        },
        {
          name: 'League Cup',
          defaultTeams: [2, 3, 4],
          format: KNOCKOUT_FORMAT,
        },
      ] }],
    };

    const league = await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id));
    const divisions = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((result) => {
        if (!result) throw Error();
        return result.dataValues.Divisions.map(({ dataValues }) => dataValues);
      });
    const roundRobinDivision = divisions.find((div) => div.config.name === 'Premier Division')!;
    const knockoutDivision = divisions.find((div) => div.config.name === 'League Cup')!;

    await DivisionFactory(roundRobinDivision.id).newSeason(gw.year - 1);
    await DivisionFactory(knockoutDivision.id).newSeason(gw.year - 1);

    await db.models.SeasonResult.bulkCreate([
      { divisionId: roundRobinDivision.id, year: gw.year, championTeamId: teams[0].id },
      { divisionId: knockoutDivision.id, year: gw.year, championTeamId: teams[2].id },
    ]);

    const handler = getBracketRoute();
    const req: any = { params: { leagueId: `${league.id}` } };
    const res: any = { send: jest.fn() };

    await handler(req, res);

    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(body).toHaveLength(2);

    const roundRobin = body.find((entry) => entry.divisionId === roundRobinDivision.id);
    expect(roundRobin).toMatchObject({
      divisionId: roundRobinDivision.id,
      divisionName: 'Premier Division',
      structure: 'ROUND_ROBIN',
      champion: { teamId: teams[0].id },
      rounds: [],
    });

    const knockout = body.find((entry) => entry.divisionId === knockoutDivision.id);
    expect(knockout.divisionName).toBe('League Cup');
    expect(knockout.structure).toBe('KNOCKOUT');
    expect(knockout.champion).toEqual({ teamId: teams[2].id });
    expect(knockout.rounds).toHaveLength(1);
    expect(knockout.rounds[0].ties.map((tie) => tie.kind).sort()).toEqual(['BYE', 'SERIES']);
  });

  // @spec API-002 @spec API-004
  it('@spec API-002 @spec API-004 returns empty rounds for round-robin divisions and champions from SeasonResult', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      ['North', 'South'].map((name) => TeamFactory().create(gw.id, { name }))
    );
    const leagueConfig: LeagueConfig = {
      name: 'Round Robin League',
      type: LeagueType.League,
      stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Top Flight',
        defaultTeams: [0, 1],
        format: ROUND_ROBIN_FORMAT,
        isTopTier: true,
      }] }],
    };

    const league = await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id));
    const divisionId = await getDivisionId(league.id);
    await DivisionFactory(divisionId).newSeason(gw.year - 1);
    await db.models.SeasonResult.create({ divisionId, year: gw.year, championTeamId: teams[1].id });

    const bracket = await DivisionFactory(divisionId).getBracket(gw.year);

    expect(bracket.rounds).toEqual([]);
    expect(bracket.champion).toEqual({ teamId: teams[1].id });
  });

  // @spec API-002 @spec API-003
  it('@spec API-002 @spec API-003 groups knockout rounds into byes and series and synthesizes a pending next round during redraw gap', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
    const teams = await Promise.all(
      ['Aces', 'Bruins', 'Comets', 'Dragons'].map((name) => TeamFactory().create(gw.id, { name }))
    );
    const leagueConfig: LeagueConfig = {
      name: 'Cup League',
      type: LeagueType.LeagueCup,
      stages: [{ id: "default", name: "Default", divisions: [{
        name: 'Cup',
        defaultTeams: [0, 1, 2, 3], isTopTier: true,
        format: KNOCKOUT_FORMAT,
      }] }],
    };

    const league = await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id));
    const divisionId = await getDivisionId(league.id);
    await DivisionFactory(divisionId).newSeason(gw.year - 1);

    const roundOneGames = await getRoundGames(divisionId, gw.year, 1);
    for (const game of roundOneGames) {
      await db.models.Game.update(
        { status: 'COMPLETED', homeTeamResult: 4, awayTeamResult: 1 },
        { where: { id: game.id } },
      );
    }

    const bracket = await DivisionFactory(divisionId).getBracket(gw.year);

    expect(bracket.rounds).toHaveLength(2);
    expect(bracket.rounds[0]).toMatchObject({
      round: 1,
      label: 'Semifinals',
      status: 'COMPLETE',
    });
    expect(bracket.rounds[0].ties).toHaveLength(2);
    expect(bracket.rounds[0].ties.every((tie) => tie.kind === 'SERIES')).toBe(true);

    expect(bracket.rounds[1]).toEqual({
      round: 2,
      label: 'Final',
      status: 'PENDING',
      ties: [{
        kind: 'SERIES',
        teamA: { teamId: null, teamName: null },
        teamB: { teamId: null, teamName: null },
        games: [],
      }],
    });
  });
});
