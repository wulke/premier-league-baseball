// @spec TLO-001,TLO-002,TLO-003,TLO-004,TLO-005,TLO-006,TLO-007,TLO-008,TLO-010
// Per-League team ownership & unambiguous identity composition (#283) acceptance.
import db from '../../../src/db/client';
import { GameWorldFactory, LeagueFactory } from '../../../src/db/domain';
import * as handlers from '../../../src/api/handlers';
import { useDefaultGameWorld } from '../../../src/api/models';
import { generateIdentity, LEAGUE_COMPOSITIONS, mulberry32 } from '../../../src/db/domain/identity';
import { MIN_ROSTER_SIZE } from '../../../src/db/domain/contract';

const ROUND_ROBIN_FORMAT = { structure: 'ROUND_ROBIN' as const, legs: 'ONE_LEG' as const, winsToAdvance: 'Bo1' as const };

// A minimal single-division stage whose pool holds every index of the owning League's teams.
const allTeamsStage = (teamCount = 1) => [{
  id: 'regular',
  name: 'Regular Season',
  divisions: [{ name: 'Only Division', defaultTeams: [...Array(teamCount).keys()], format: ROUND_ROBIN_FORMAT, isTopTier: true }],
}];

// The expected identity sequence generateRoster draws for a fixed seed — identities are
// generated sequentially from one mulberry32 stream, so replaying the same seed and
// composition yields the same countryCode order.
const expectedCountrySequence = (compositionKey: string, year: number, count: number) => {
  const rng = mulberry32(168);
  return Array.from({ length: count }, () =>
    generateIdentity(LEAGUE_COMPOSITIONS[compositionKey], rng, year).countryCode);
};

const teamCountryCodes = async (teamId: number) => {
  const players = await db.models.Player.findAll({
    where: { teamId },
    order: [['id', 'ASC']],
  }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
  return players.map((player) => player.countryCode);
};

describe('Team home-League ownership (#283)', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec TLO-001
  it('@spec TLO-001 defines homeLeagueId as a NOT NULL FK column with a Team→League association', () => {
    const attributes = db.models.Team.getAttributes();
    expect(attributes.homeLeagueId).toBeDefined();
    expect(attributes.homeLeagueId.allowNull).toBe(false);
    expect(db.models.Team.associations.HomeLeague).toBeDefined();
    expect(db.models.Team.associations.HomeLeague.target).toBe(db.models.League);
  });

  // @spec TLO-001
  it('@spec TLO-001 populates homeLeagueId at creation and rejects a foreign-GameWorld League', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2030 }).then((m) => m.dataValues);
    const otherGw = await db.models.GameWorld.create({ config: {}, year: 2030 }).then((m) => m.dataValues);
    const homeLeague = await db.models.League.create({
      gameWorldId: gw.id,
      config: { name: 'Home League', compositionKey: 'NPB' },
    }).then((m) => m.dataValues);
    const foreignLeague = await db.models.League.create({
      gameWorldId: otherGw.id,
      config: { name: 'Foreign League' },
    }).then((m) => m.dataValues);

    const { TeamFactory } = require('../../../src/db/domain');
    const team = await TeamFactory().create(gw.id, { name: 'Owned Club' }, { homeLeagueId: homeLeague.id });
    expect(team.homeLeagueId).toBe(homeLeague.id);

    await expect(
      TeamFactory().create(gw.id, { name: 'Poached Club' }, { homeLeagueId: foreignLeague.id }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  // @spec TLO-003
  it('@spec TLO-003 rejects ambiguous or mis-ordered team sources before writing any row', async () => {
    const teams = [{ name: 'A Club' }, { name: 'B Club' }];
    const base = {
      name: 'Premier League',
      year: 2031,
      leagues: [
        { key: 'parent', name: 'Parent League', type: 'League', teams: teams, stages: allTeamsStage() },
      ],
    };

    const cases: Array<{ label: string; leagues: any[] }> = [
      { label: 'neither teams nor externalTeams', leagues: [{ key: 'a', name: 'A', type: 'League', stages: allTeamsStage() }] },
      {
        label: 'both teams and externalTeams',
        leagues: [
          { ...base.leagues[0] },
          { key: 'b', name: 'B', type: 'League Cup', teams, externalTeams: 'parent', stages: allTeamsStage() },
        ],
      },
      {
        label: 'unknown source key',
        leagues: [
          { ...base.leagues[0] },
          { key: 'b', name: 'B', type: 'League Cup', externalTeams: 'nope', stages: allTeamsStage() },
        ],
      },
      {
        label: 'self reference',
        leagues: [
          { key: 'a', name: 'A', type: 'League Cup', externalTeams: 'a', stages: allTeamsStage() },
        ],
      },
      {
        label: 'forward reference',
        leagues: [
          { key: 'a', name: 'A', type: 'League Cup', externalTeams: 'b', stages: allTeamsStage() },
          { key: 'b', name: 'B', type: 'League', teams, stages: allTeamsStage() },
        ],
      },
      {
        label: 'duplicate keys',
        leagues: [
          { ...base.leagues[0] },
          { key: 'parent', name: 'Clone', type: 'League', teams, stages: allTeamsStage() },
        ],
      },
    ];

    for (const { label, leagues } of cases) {
      await expect(GameWorldFactory().create({ ...base, leagues })).rejects.toThrow(/team source|strictly-prior|unique/i);
      await expect(db.models.GameWorld.count()).resolves.toBe(0);
      await expect(db.models.League.count()).resolves.toBe(0);
      await expect(db.models.Team.count()).resolves.toBe(0);
      void label;
    }
  });

  // @spec TLO-002,TLO-004,TLO-006
  it('@spec TLO-002 @spec TLO-004 @spec TLO-006 assigns deterministic per-League composition across two independent parent Leagues', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(168);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const created = await GameWorldFactory().create({
        name: 'Premier League',
        year: 2032,
        leagues: [
          {
            key: 'japan',
            name: 'Japan League',
            type: 'League',
            compositionKey: 'NPB',
            teams: [{ name: 'Tokyo Club' }, { name: 'Osaka Club' }],
            stages: allTeamsStage(),
          },
          {
            key: 'korea',
            name: 'Korea League',
            type: 'League',
            compositionKey: 'KBO',
            teams: [{ name: 'Seoul Club' }, { name: 'Busan Club' }],
            stages: allTeamsStage(),
          },
        ],
      });

      // disjoint pools: one Team row per declared pool entry, none shared
      expect(created.teams).toHaveLength(4);
      expect(created.leagues).toHaveLength(2);

      const teamRows = await db.models.Team.findAll({
        where: { gameWorldId: created.id },
        order: [['id', 'ASC']],
      }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
      expect(teamRows.map((team) => team.homeLeagueId)).toEqual([
        created.leagues[0].id, created.leagues[0].id,
        created.leagues[1].id, created.leagues[1].id,
      ]);

      // each Team's roster composition derives from its own Home League
      const [tokyo, , seoul] = teamRows;
      await expect(teamCountryCodes(tokyo.id)).resolves.toEqual(
        expectedCountrySequence('NPB', 2032, MIN_ROSTER_SIZE),
      );
      await expect(teamCountryCodes(seoul.id)).resolves.toEqual(
        expectedCountrySequence('KBO', 2032, MIN_ROSTER_SIZE),
      );
    } finally {
      nowSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  // @spec TLO-010
  it('@spec TLO-010 generates each parent League\'s active lineup with its own match rules', async () => {
    const created = await GameWorldFactory().create({
      name: 'Premier League',
      year: 2032,
      leagues: [
        {
          key: 'no-dh', name: 'No DH League', type: 'League',
          matchRules: { dhEnabled: false, benchSize: 0, bullpenSize: 0 },
          teams: [{ name: 'Pitchers Bat' }], stages: allTeamsStage(),
        },
        {
          key: 'dh', name: 'DH League', type: 'League',
          matchRules: { dhEnabled: true, benchSize: 0, bullpenSize: 0 },
          teams: [{ name: 'Designated Hitter' }], stages: allTeamsStage(),
        },
      ],
    });
    const teams = await db.models.Team.findAll({ where: { gameWorldId: created.id }, order: [['id', 'ASC']] })
      .then((rows: any[]) => rows.map(({ dataValues }) => dataValues));

    const entriesFor = async (teamId: number) => db.models.Lineup.findOne({ where: { teamId, gameId: null }, include: [db.models.LineupEntry] })
      .then((lineup: any) => lineup.dataValues.LineupEntries.map((entry: any) => entry.dataValues));
    const [noDhEntries, dhEntries] = await Promise.all(teams.map((team) => entriesFor(team.id)));
    const starters = (entries: any[]) => entries.filter(({ role }) => role === 'STARTER');

    expect(starters(noDhEntries)).toHaveLength(9);
    expect(starters(noDhEntries).find(({ fieldingPosition }) => fieldingPosition === 'Pitcher').battingOrder).toBe(9);
    expect(noDhEntries.filter(({ role }) => role === 'BENCH' || role === 'BULLPEN')).toHaveLength(0);
    expect(starters(dhEntries)).toHaveLength(10);
    expect(starters(dhEntries).find(({ fieldingPosition }) => fieldingPosition === 'Pitcher').battingOrder).toBeNull();
    expect(starters(dhEntries).filter(({ fieldingPosition }) => fieldingPosition == null)).toHaveLength(1);
    expect(dhEntries.filter(({ role }) => role === 'BENCH' || role === 'BULLPEN')).toHaveLength(0);
  });

  // @spec TLO-004
  it('@spec TLO-004 resolves chained externalTeams sources to the original Team rows', async () => {
    const created = await GameWorldFactory().create({
      name: 'Premier League',
      year: 2033,
      leagues: [
        { key: 'parent', name: 'Parent League', type: 'League', teams: [{ name: 'One' }, { name: 'Two' }], stages: allTeamsStage(2) },
        { key: 'shield', name: 'Shield', type: 'League Cup', externalTeams: 'parent', stages: allTeamsStage(2) },
        { key: 'plate', name: 'Plate', type: 'League Cup', externalTeams: 'shield', stages: allTeamsStage(2) },
      ],
    });

    // 2 Teams total — the two external Leagues create no Team rows
    expect(created.teams).toHaveLength(2);
    const teamIds = (await db.models.Team.findAll({ where: { gameWorldId: created.id } }))
      .map((team: any) => team.dataValues.id).sort();

    for (const league of created.leagues.slice(1)) {
      const divisions = await db.models.Division.findAll({ where: { leagueId: league.id } });
      expect(divisions).toHaveLength(1);
      expect([...divisions[0].dataValues.config.defaultTeams].sort()).toEqual(teamIds);
    }
    expect((await db.models.Team.findAll({ where: { gameWorldId: created.id } }))
      .every((team: any) => team.dataValues.homeLeagueId === created.leagues[0].id)).toBe(true);
  });

  // @spec TLO-007,TLO-008
  it('@spec TLO-007 @spec TLO-008 the default world shares the League Cup the Premier League\'s exact Teams', async () => {
    const created = await GameWorldFactory().create(useDefaultGameWorld());

    expect(created.leagues).toHaveLength(2);
    expect(created.teams).toHaveLength(44);

    const [premierLeague, leagueCup] = created.leagues;
    const teamRows = await db.models.Team.findAll({ where: { gameWorldId: created.id } });
    // every Team's home League is the Premier League — cup participation changes nothing
    expect(teamRows.every((team: any) => team.dataValues.homeLeagueId === premierLeague.id)).toBe(true);

    const cupDivisions = await db.models.Division.findAll({ where: { leagueId: leagueCup.id } });
    expect(cupDivisions).toHaveLength(1);
    const cupTeamIds = [...cupDivisions[0].dataValues.config.defaultTeams].sort();
    expect(cupTeamIds).toEqual(teamRows.map((team: any) => team.dataValues.id).sort());
    expect(cupTeamIds).toHaveLength(44);
  });

  // @spec TLO-008
  it('@spec TLO-008 creates the default world end-to-end through the create API handler', async () => {
    const response: any = await handlers.newGameWorld(useDefaultGameWorld());

    expect(response.id).toBeDefined();
    expect(response.leagues).toHaveLength(2);
    expect(response.teams).toHaveLength(44);

    const world = await db.models.GameWorld.findByPk(response.id);
    expect(world?.dataValues.config.inProgress).toBe(false);
    await expect(db.models.League.count({ where: { gameWorldId: response.id } })).resolves.toBe(2);
    await expect(db.models.Team.count({ where: { gameWorldId: response.id } })).resolves.toBe(44);

    // both Leagues still carry their divisions for the existing start flow
    for (const league of response.leagues) {
      const divisions = await db.models.Division.findAll({ where: { leagueId: league.id } });
      expect(divisions.length).toBeGreaterThan(0);
      expect(await LeagueFactory(league.id).get()).toMatchObject({ id: league.id, status: 'CUTOVER' });
    }
  }, 30000);
});
