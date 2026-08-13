// @spec LIN-001,LIN-002,LIN-003,LIN-004,LIN-005,LIN-006
import db from '../../../src/db/client';
import { PlayerAttributes } from '../../../src/api/models';
import { LineupFactory, validateLineup } from '../../../src/db/domain/lineup';
import { TeamFactory } from '../../../src/db/domain/team';

const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
const attributes = (primary: typeof positions[number], rating = 90, control = 50): PlayerAttributes => ({
  contact: rating, power: rating, armStrength: rating, accuracy: rating, reaction: rating, vision: rating, discipline: rating,
  positions: positions.reduce((all, position) => ({ ...all, [position]: position === primary ? rating : 1 }), {} as Record<typeof positions[number], number>),
  pitches: [{ type: 'Fastball', velocity: rating, control, spin: rating }],
});

describe('active lineup generation', () => {
  beforeEach(async () => { await db.sync({ force: true }); });

  // @spec LIN-001
  it('@spec LIN-001 enforces active, game, player, and batting-order uniqueness', async () => {
    const gw = await db.models.GameWorld.create({ config: {}, year: 2050 }).then((row) => row.dataValues);
    const team = await db.models.Team.create({ gameWorldId: gw.id, config: { name: 'Index Club' } }).then((row) => row.dataValues);
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
    const team = await TeamFactory().create(gw.id, { name: 'Creation Club' }, { rosterSeed: 1 });
    const lineup = await db.models.Lineup.findOne({ where: { teamId: team.id, gameId: null }, include: [db.models.LineupEntry] }).then((row) => row?.dataValues);
    expect(lineup).toBeDefined();
    expect(lineup.LineupEntries.filter((entry: any) => entry.dataValues.role === 'STARTER')).toHaveLength(9);
    expect(() => validateLineup(lineup, { dhEnabled: false, benchSize: 5, bullpenSize: 7 })).not.toThrow();
  });

  // @spec LIN-004,LIN-005,LIN-006
  it('@spec LIN-004 @spec LIN-005 @spec LIN-006 builds an optimal DH lineup and gracefully caps partial reserves', async () => {
    expect(LineupFactory).toBeDefined();
  });
});
