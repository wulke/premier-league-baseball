// @spec PSTATQ-001,PSTATQ-002,PSTATQ-003
import db from '../../../src/db/client';
import { PlayerFactory } from '../../../src/db/domain';

describe('player stats query', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  // @spec PSTATQ-001,PSTATQ-002
  it('@spec PSTATQ-001 @spec PSTATQ-002 aggregates counting stats and derives rates', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
    await db.models.Player.create({ id: 1, gameWorldId: 1, teamId: null, givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date(), attributes: { positions: {}, pitches: [] } });
    await db.models.Game.bulkCreate([{ id: 1, homeTeamId: 1, awayTeamId: 2, status: 'COMPLETED' }, { id: 2, homeTeamId: 1, awayTeamId: 2, status: 'COMPLETED' }]);
    await db.models.PlayerGameStats.bulkCreate([{ playerId: 1, gameId: 1, AB: 4, H: 2, BB: 1, '2B': 1, HR: 1, IP: 3, ER: 1, pitchingH: 2, pitchingBB: 1 }, { playerId: 1, gameId: 2, AB: 2, H: 1, IP: 0 }]);
    await expect(PlayerFactory(1).getStats({ grain: 'career', year: 2025, gwId: 1 })).resolves.toMatchObject({ batting: { G: 2, AB: 6, H: 3, AVG: 0.5, SLG: 1.1667, OPS: 1.7381 }, pitching: { ERA: 3, WHIP: 1 } });
  });
  // @spec PSTATQ-003
  it('@spec PSTATQ-003 returns null for a player with no rows', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, config: {} }); await db.models.Player.create({ id: 2, gameWorldId: 1, teamId: null, givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date(), attributes: { positions: {}, pitches: [] } });
    await expect(PlayerFactory(2).getStats({ grain: 'career', year: 2025, gwId: 1 })).resolves.toBeNull();
  });
});
