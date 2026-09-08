// @spec PATTR-001,PATTR-002,PATTR-003,PCON-001,PCON-002,PCON-003,PCON-004,PCON-007,PCON-008,PID-001,PID-002,PID-004..PID-010
import { PlayerAttributes } from '../../../src/api/models';
import db from '../../../src/db/client';
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, SEASON_END_DAY, SEASON_END_MONTH } from '../../../src/db/domain/contract';
import { PlayerFactory, allocateRosterSlots, primaryPosition } from '../../../src/db/domain/player';
import { GameWorldFactory } from '../../../src/db/domain/game-world';
import { generateIdentity, LEAGUE_COMPOSITIONS, mulberry32, resolveComposition } from '../../../src/db/domain/identity';

const nonPitcherAttributes: PlayerAttributes = {
  contact: 71,
  power: 64,
  armStrength: 58,
  accuracy: 62,
  reaction: 77,
  vision: 68,
  discipline: 73,
  positions: {
    Pitcher: 12,
    Catcher: 22,
    FirstBase: 40,
    SecondBase: 55,
    ThirdBase: 64,
    Shortstop: 88,
    LeftField: 61,
    CenterField: 72,
    RightField: 57,
  },
  pitches: [
    { type: 'Fastball', velocity: 43, control: 31, spin: 29 },
    { type: 'Changeup', velocity: 35, control: 28, spin: 24 },
  ],
};

const EXPECTED_PITCHER_COUNTS: Record<number, number> = {
  20: 8,
  21: 8,
  22: 9,
  23: 9,
  24: 10,
  25: 10,
  26: 10,
  27: 11,
  28: 11,
  29: 12,
  30: 12,
};

describe('Player model + attribute schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PID-001,PID-004,PID-005,PID-007,PID-008,PID-009
  it('@spec PID-001 @spec PID-004 @spec PID-005 @spec PID-007 @spec PID-008 @spec PID-009 generates reproducible country-pool identities with a bounded birth date', () => {
    const first = Array.from({ length: 4 }, () => generateIdentity(LEAGUE_COMPOSITIONS.PREMIER_LEAGUE, mulberry32(168)));
    const second = Array.from({ length: 4 }, () => generateIdentity(LEAGUE_COMPOSITIONS.PREMIER_LEAGUE, mulberry32(168)));

    expect(first).toEqual(second);
    first.forEach((identity) => {
      expect(['US', 'DO', 'VE', 'PR', 'CU', 'JP', 'KR', 'MX', 'BR', 'TW']).toContain(identity.countryCode);
      expect(identity.givenName).not.toEqual('');
      expect(identity.familyName).not.toEqual('');
      expect(['R', 'L', 'S']).toContain(identity.bats);
      expect(['R', 'L']).toContain(identity.throws);
      expect(identity.birthDate.getUTCFullYear()).toBeGreaterThanOrEqual(1987);
      expect(identity.birthDate.getUTCFullYear()).toBeLessThanOrEqual(2008);
    });
  });

  // @spec PID-002,PID-010
  it('@spec PID-002 @spec PID-010 resolves a named league composition and defaults unknown keys', () => {
    expect(resolveComposition('NPB')).toBe(LEAGUE_COMPOSITIONS.NPB);
    expect(resolveComposition('unknown')).toBe(LEAGUE_COMPOSITIONS.PREMIER_LEAGUE);
  });

  // @spec PID-010,TLO-005 — the Team's Home League (not `leagues[0]`) owns its composition
  it('@spec PID-010 @spec TLO-005 resolves roster composition from the Team\'s home League', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(168);
    const format = { structure: 'ROUND_ROBIN' as const, legs: 'ONE_LEG' as const, winsToAdvance: 'Bo1' as const };
    const stage = (teamIndex: number) => [{
      id: 'regular',
      name: 'Regular season',
      divisions: [{ name: 'Division', defaultTeams: [teamIndex], format, isTopTier: true }],
    }];
    try {
      const created = await GameWorldFactory().create({
        name: 'Premier League',
        year: 2056,
        leagues: [
          { key: 'japan-first', name: 'Japan First', type: 'League', compositionKey: 'NPB', teams: [{ name: 'Tokyo Test Club' }], stages: stage(0) },
          { key: 'england-cup', name: 'England Second', type: 'League Cup', compositionKey: 'PREMIER_LEAGUE', externalTeams: 'japan-first', stages: stage(0) },
        ],
      });

      expect(created.teams[0].homeLeagueId).toBe(created.leagues[0].id);
      const playerRow = await db.models.Player.findOne({ where: { teamId: created.teams[0].id } });
      if (!playerRow) throw new Error('Expected initial roster player');
      const player = playerRow.dataValues;
      expect(player.countryCode).toBe(
        generateIdentity(LEAGUE_COMPOSITIONS.NPB, mulberry32(168), 2056).countryCode
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  // @spec PID-006
  it('@spec PID-006 defines all six required typed identity columns', () => {
    const attributes = db.models.Player.getAttributes();
    ['givenName', 'familyName', 'countryCode', 'bats', 'throws', 'birthDate'].forEach((field) => {
      expect(attributes[field].allowNull).toBe(false);
    });
    expect(attributes.birthDate.type.constructor.name).toBe('DATE');
  });

  // @spec PATTR-001
  it('@spec PATTR-001 derives primary position from the highest-rated positions entry', async () => {
    expect(
      primaryPosition({
        attributes: nonPitcherAttributes,
      })
    ).toBe('Shortstop');
  });

  // @spec PATTR-002,PATTR-003
  it('@spec PATTR-002 @spec PATTR-003 persists uniform pitches for a free-agent player', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2046 }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: { name: 'Fixture League' } }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Chicago Whales' }
    }).then(({ dataValues }) => dataValues);

    const player = await PlayerFactory().create(gameWorld.id, nonPitcherAttributes, null);

    await PlayerFactory().create(
      gameWorld.id,
      {
        ...nonPitcherAttributes,
        positions: {
          ...nonPitcherAttributes.positions,
          Pitcher: 91,
        },
      },
      team.id
    );

    const gameWorldWithPlayers = await db.models.GameWorld.findByPk(gameWorld.id, {
      include: [db.models.Player],
    });
    const teamWithPlayers = await db.models.Team.findByPk(team.id, {
      include: [db.models.Player],
    });

    expect(player.teamId).toBeNull();
    expect(player.attributes.pitches).toEqual(nonPitcherAttributes.pitches);
    expect(player.attributes.positions).toEqual(nonPitcherAttributes.positions);
    expect(gameWorldWithPlayers?.dataValues.Players).toHaveLength(2);
    expect(teamWithPlayers?.dataValues.Players).toHaveLength(1);
  });

  // @spec PCON-002
  it('@spec PCON-002 allocates roster slots proportionally instead of via a fixed template', () => {
    for (let headcount = MIN_ROSTER_SIZE; headcount <= MAX_ROSTER_SIZE; headcount += 1) {
      const slots = allocateRosterSlots(headcount);
      const counts = slots.reduce<Record<string, number>>((totals, slot) => {
        totals[slot] = (totals[slot] ?? 0) + 1;
        return totals;
      }, {});

      const pitcherCount = counts.Pitcher ?? 0;
      const fielderCounts: number[] = Object.entries(counts)
        .filter(([position]) => position !== 'Pitcher')
        .map(([, count]) => count);

      expect(slots).toHaveLength(headcount);
      expect(pitcherCount).toBe(EXPECTED_PITCHER_COUNTS[headcount]);
      expect(fielderCounts).toHaveLength(8);
      expect(Math.max(...fielderCounts) - Math.min(...fielderCounts)).toBeLessThanOrEqual(1);
    }
  });

  // @spec PCON-001,PCON-003,PCON-004,PCON-007,PCON-008,PID-002,PID-006,PID-010
  it('@spec PCON-001 @spec PCON-003 @spec PCON-004 @spec PCON-007 @spec PCON-008 @spec PID-002 @spec PID-006 @spec PID-010 generates a minimum-size roster with identity columns and DATE contracts', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2052 }).then(({ dataValues }) => dataValues);
    await db.models.League.bulkCreate([
      { gameWorldId: gameWorld.id, config: { name: 'Premier League', compositionKey: 'PREMIER_LEAGUE' } },
      { gameWorldId: gameWorld.id, config: { name: 'Tokyo League', compositionKey: 'NPB' } },
    ]);
    const homeLeague = await db.models.League.findOne({
      where: { gameWorldId: gameWorld.id },
      order: [['id', 'ASC']],
    }).then((l) => l!.dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: homeLeague.id,
      config: { name: 'Austin Arrows' },
    }).then(({ dataValues }) => dataValues);

    try {
      const players = await PlayerFactory().generateRoster(team.id, gameWorld.id, { compositionKey: 'NPB', seed: 168 });
      const contracts = await db.models.Contract.findAll({
        where: { teamId: team.id },
        order: [['id', 'ASC']],
      }).then((rows) => rows.map(({ dataValues }) => dataValues));

      expect(players).toHaveLength(MIN_ROSTER_SIZE);
      expect(contracts).toHaveLength(MIN_ROSTER_SIZE);
      expect(players[0].countryCode).toBe(
        generateIdentity(LEAGUE_COMPOSITIONS.NPB, mulberry32(168), gameWorld.year).countryCode
      );

      const reloadedPlayers = await db.models.Player.findAll({ where: { teamId: team.id } }).then((rows) => rows.map(({ dataValues }) => dataValues));
      expect(reloadedPlayers).toHaveLength(MIN_ROSTER_SIZE);
      reloadedPlayers.forEach((player) => {
        expect(player.teamId).toBe(team.id);
        expect(player.givenName).toEqual(expect.any(String));
        expect(player.familyName).toEqual(expect.any(String));
        expect(player.countryCode).toMatch(/^[A-Z]{2}$/);
        expect(['R', 'L', 'S']).toContain(player.bats);
        expect(['R', 'L']).toContain(player.throws);
        expect(player.birthDate).toBeInstanceOf(Date);
        expect(player.attributes).toEqual({
          contact: 1,
          power: 1,
          armStrength: 1,
          accuracy: 1,
          reaction: 1,
          vision: 1,
          discipline: 1,
          positions: {
            Pitcher: 1,
            Catcher: 1,
            FirstBase: 1,
            SecondBase: 1,
            ThirdBase: 1,
            Shortstop: 1,
            LeftField: 1,
            CenterField: 1,
            RightField: 1,
          },
          pitches: [
            { type: 'Fastball', velocity: 1, control: 1, spin: 1 },
            { type: 'Curveball', velocity: 1, control: 1, spin: 1 },
            { type: 'Slider', velocity: 1, control: 1, spin: 1 },
            { type: 'Changeup', velocity: 1, control: 1, spin: 1 },
          ],
        });
      });

      contracts.forEach((contract) => {
        expect(contract.teamId).toBe(team.id);
        expect(contract.startDate).toEqual(new Date(`${gameWorld.year}-03-01T00:00:00.000Z`));
        expect(contract.endDate).toEqual(new Date(`${gameWorld.year}-10-31T00:00:00.000Z`));
      });
      expect(contracts.map((contract) => contract.playerId).sort((a, b) => a - b)).toEqual(
        players.map((player) => player.id!).sort((a, b) => a - b)
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  // @spec PCON-001
  it('@spec PCON-001 generates a maximum-size roster when the random headcount hits the upper bound', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999999);
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2053 }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Denver Peaks' },
    }).then(({ dataValues }) => dataValues);

    try {
      const players = await PlayerFactory().generateRoster(team.id, gameWorld.id);
      expect(players).toHaveLength(MAX_ROSTER_SIZE);
    } finally {
      randomSpy.mockRestore();
    }
  });

  // @spec XFER-021 — not Gherkin-routed (internal refactor, no observable behavior change).
  it('@spec XFER-021 generated Contracts end on the shared SEASON_END anchor', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2053 }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Anchor City' },
    }).then(({ dataValues }) => dataValues);

    const players = await PlayerFactory().generateRoster(team.id, gameWorld.id);
    const contract = await db.models.Contract.findOne({ where: { playerId: players[0].id } });

    expect(new Date(contract!.dataValues.endDate).toISOString().slice(0, 10))
      .toBe(new Date(Date.UTC(gameWorld.year, SEASON_END_MONTH, SEASON_END_DAY)).toISOString().slice(0, 10));
  });
});
