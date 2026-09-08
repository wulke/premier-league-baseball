// @spec LIN-001,LIN-002,LIN-003,LIN-004,LIN-005,LIN-006,LEDIT-004,LEDIT-005,LEDIT-006,LEDIT-007
import db from '../../../src/db/client';
import { PlayerAttributes } from '../../../src/api/models';
import { LineupFactory, optimalFieldingAssignment, resolveMatchRules, startingPitcherId, validateLineup } from '../../../src/db/domain/lineup';
import { TeamFactory } from '../../../src/db/domain/team';

const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
const attributes = (primary: typeof positions[number], rating = 90, control = 50): PlayerAttributes => ({
  contact: rating, power: rating, armStrength: rating, accuracy: rating, reaction: rating, vision: rating, discipline: rating,
  positions: positions.reduce((all, position) => ({ ...all, [position]: position === primary ? rating : 1 }), {} as Record<typeof positions[number], number>),
  pitches: [{ type: 'Fastball', velocity: rating, control, spin: rating }],
});

describe('active lineup generation', () => {
  beforeEach(async () => { await db.sync({ force: true }); });

  // @spec LEDIT-004
  it('@spec LEDIT-004 rejects starter assignments on bench and bullpen entries', () => {
    const entries = [
      ...positions.map((fieldingPosition, index) => ({ playerId: index + 1, role: 'STARTER' as const, battingOrder: fieldingPosition === 'Pitcher' ? 9 : index, fieldingPosition })),
      { playerId: 10, role: 'BENCH' as const, battingOrder: 10, fieldingPosition: null },
    ];
    expect(() => validateLineup({ entries }, { dhEnabled: false, benchSize: 1, bullpenSize: 0 })).toThrow('Bench and bullpen entries cannot have starter assignments');
  });

  // @spec LIN-001
  it('@spec LIN-001 enforces active, game, player, and batting-order uniqueness', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2050 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Index Club' } }).then((row) => row.dataValues);
    const player = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Pitcher'), givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const active = await db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id }).then((row) => row.dataValues);
    await expect(db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id })).rejects.toThrow();
    const game = await db.models.Game.create({ homeTeam: team.id, awayTeam: team.id }).then((row) => row.dataValues);
    const gameLineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id, gameId: game.id }).then((row) => row.dataValues);
    await expect(db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id, gameId: game.id })).rejects.toThrow();
    await db.models.LineupEntry.create({ lineupId: active.id, playerId: player.id, role: 'STARTER', battingOrder: 1, fieldingPosition: 'Pitcher' });
    await expect(db.models.LineupEntry.create({ lineupId: active.id, playerId: player.id, role: 'BENCH' })).rejects.toThrow();
    await expect(db.models.LineupEntry.create({ lineupId: gameLineup.id, playerId: player.id, role: 'STARTER', battingOrder: 1, fieldingPosition: 'Pitcher' })).resolves.toBeDefined();
  });

  // @spec LIN-003,LIN-005
  it('@spec LIN-003 @spec LIN-005 creates one valid no-DH active lineup as part of TeamFactory.create', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2051 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await TeamFactory().create(gw.id, { name: 'Creation Club' }, { homeLeagueId: league.id, rosterSeed: 1 });
    const lineup = await db.models.Lineup.findOne({ where: { teamId: team.id, gameId: null }, include: [db.models.LineupEntry] }).then((row) => row?.dataValues);
    expect(lineup).toBeDefined();
    expect(lineup.LineupEntries.filter((entry: any) => entry.dataValues.role === 'STARTER')).toHaveLength(9);
    expect(() => validateLineup(lineup, { dhEnabled: false, benchSize: 5, bullpenSize: 7 })).not.toThrow();
  }, 10000);

  // @spec LIN-004
  it('@spec LIN-004 finds the optimal assignment for a 30-player roster within the world-creation budget', () => {
    const realisticRoster = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      attributes: attributes(index % 9 === 0 ? 'Pitcher' : 'CenterField', 50 + (index % 50)),
    }));
    const startedAt = performance.now();
    const assignment = optimalFieldingAssignment(realisticRoster);
    expect(assignment).toHaveLength(8);
    expect(performance.now() - startedAt).toBeLessThan(500);
  }, 1000);

  // @spec LIN-002,LIN-004,LIN-005,LIN-006
  it('@spec LIN-002 @spec LIN-004 @spec LIN-005 @spec LIN-006 builds an optimal DH lineup and gracefully caps partial reserves', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2052 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'DH Club' } }).then((row) => row.dataValues);
    const fielders = (['Catcher', 'FirstBase', 'ThirdBase', 'LeftField', 'CenterField', 'RightField'] as typeof positions[number][]).map((position, index) => ({
      primary: position, name: `F${index}`, rating: 80,
    }));
    // A naive 2B-first greedy pick takes A at 2B (100), leaving B at SS (1).
    // The global optimum is A at SS (99) and B at 2B (98).
    const crafted: Array<{ primary: typeof positions[number]; name: string; rating: number; control?: number }> = [
      { primary: 'Pitcher' as const, name: 'Low Control', rating: 70, control: 30 },
      { primary: 'Pitcher' as const, name: 'Ace', rating: 75, control: 95 },
      { primary: 'Catcher' as const, name: 'A', rating: 1 },
      { primary: 'Catcher' as const, name: 'B', rating: 1 },
      ...fielders,
      { primary: 'FirstBase' as const, name: 'DH', rating: 99 },
    ];
    const players = await Promise.all(crafted.map(async ({ primary, name, rating, control }) => {
      const playerAttributes = attributes(primary, rating, control ?? 50);
      if (name === 'A') { playerAttributes.positions.SecondBase = 100; playerAttributes.positions.Shortstop = 99; }
      if (name === 'B') { playerAttributes.positions.SecondBase = 98; playerAttributes.positions.Shortstop = 1; }
      return db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: playerAttributes, givenName: name, familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01') }).then((row) => row.dataValues);
    }));
    const rules = resolveMatchRules({ matchRules: { dhEnabled: false, benchSize: 1, bullpenSize: 1 } }, { matchRules: { dhEnabled: true, benchSize: 5, bullpenSize: 7 } });
    expect(rules).toEqual({ dhEnabled: true, benchSize: 5, bullpenSize: 7 });
    const assignment = optimalFieldingAssignment(players.filter((player: any) => player.givenName === 'A' || player.givenName === 'B' || player.givenName.startsWith('F')));
    expect((assignment.find(({ position }) => position === 'SecondBase')?.player as any)?.givenName).toBe('B');
    expect((assignment.find(({ position }) => position === 'Shortstop')?.player as any)?.givenName).toBe('A');
    const lineup = await LineupFactory().generateActive(team.id, gw.id, players, { matchRules: rules });
    const hydrated = await db.models.Lineup.findByPk(lineup.id, { include: [db.models.LineupEntry] }).then((row) => row?.dataValues);
    const entries = hydrated.LineupEntries.map((entry: any) => entry.dataValues);
    expect(entries.filter((entry: any) => entry.role === 'STARTER')).toHaveLength(10);
    expect(entries.find((entry: any) => entry.fieldingPosition === null && entry.role === 'STARTER')?.battingOrder).not.toBeNull();
    expect(entries.find((entry: any) => entry.fieldingPosition === 'Pitcher')?.battingOrder).toBeNull();
    expect(startingPitcherId(hydrated)).toBe(players.find((player: any) => player.givenName === 'Ace').id);
    expect(entries.filter((entry: any) => entry.role === 'BENCH')).toHaveLength(0);
    expect(entries.filter((entry: any) => entry.role === 'BULLPEN')).toHaveLength(1);
    expect(() => validateLineup(hydrated, rules)).not.toThrow();
  });

  // @spec LEDIT-005
  it('@spec LEDIT-005 preserves retained manual entries and places a signed player in the matching reserve pool', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2053 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Preserve Club' } }).then((row) => row.dataValues);
    const retained = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Pitcher'), givenName: 'Retained', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const signed = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Catcher'), givenName: 'Signed', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id }).then((row) => row.dataValues);
    await db.models.LineupEntry.create({ lineupId: lineup.id, playerId: retained.id, role: 'STARTER', battingOrder: 9, fieldingPosition: 'Pitcher' });

    await LineupFactory().repairActive(team.id, gw.id);

    const entries = await db.models.LineupEntry.findAll({ where: { lineupId: lineup.id } }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: retained.id, role: 'STARTER', battingOrder: 9, fieldingPosition: 'Pitcher' }),
      expect.objectContaining({ playerId: signed.id, role: 'BENCH', battingOrder: null, fieldingPosition: null }),
    ]));
  });

  // @spec LEDIT-006,LEDIT-007
  it('@spec LEDIT-006 @spec LEDIT-007 retains an unfillable departed starter as an invalid read-card entry', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2054 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Thin Club' } }).then((row) => row.dataValues);
    const departed = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Pitcher'), givenName: 'Departed', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id }).then((row) => row.dataValues);
    await db.models.LineupEntry.create({ lineupId: lineup.id, playerId: departed.id, role: 'STARTER', battingOrder: 9, fieldingPosition: 'Pitcher' });
    await db.models.Player.update({ teamId: null }, { where: { id: departed.id } });

    await expect(LineupFactory().repairActive(team.id, gw.id)).resolves.toBeDefined();
    await expect(TeamFactory(team.id).getLineup()).resolves.toEqual(expect.objectContaining({
      starters: [expect.objectContaining({ playerId: departed.id, valid: false })],
      startingPitcherId: null,
    }));
  });

  // @spec LEDIT-005,LEDIT-006
  it('@spec LEDIT-005 @spec LEDIT-006 fills the best feasible subset when replacements are fewer than departed fielders', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2055 }).then((row) => row.dataValues);
    const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Partial Club' } }).then((row) => row.dataValues);
    const pitcher = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Pitcher'), givenName: 'Pitcher', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const catcher = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Catcher'), givenName: 'Catcher', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const firstBase = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('FirstBase'), givenName: 'First', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const replacement = await db.models.Player.create({ gameWorldId: gw.id, teamId: team.id, attributes: attributes('Catcher', 99), givenName: 'Replacement', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date() }).then((row) => row.dataValues);
    const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId: gw.id }).then((row) => row.dataValues);
    await db.models.LineupEntry.bulkCreate([
      { lineupId: lineup.id, playerId: pitcher.id, role: 'STARTER', battingOrder: 9, fieldingPosition: 'Pitcher' },
      { lineupId: lineup.id, playerId: catcher.id, role: 'STARTER', battingOrder: 1, fieldingPosition: 'Catcher' },
      { lineupId: lineup.id, playerId: firstBase.id, role: 'STARTER', battingOrder: 2, fieldingPosition: 'FirstBase' },
    ]);
    await db.models.Player.update({ teamId: null }, { where: { id: [catcher.id, firstBase.id] } });

    await LineupFactory().repairActive(team.id, gw.id);

    const card = await TeamFactory(team.id).getLineup();
    expect(card.starters.filter((entry) => entry.valid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: replacement.id, fieldingPosition: 'Catcher' }),
    ]));
    expect(card.starters.filter((entry) => !entry.valid)).toHaveLength(1);
  });
});
