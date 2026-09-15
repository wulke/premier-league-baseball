// @spec PSTATQ-001,PSTATQ-002,PSTATQ-003
import db from '../../../src/db/client';
import { PlayerFactory } from '../../../src/db/domain';

describe('player stats query', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  // @spec PSTATQ-001,PSTATQ-002
  it('@spec PSTATQ-001 @spec PSTATQ-002 aggregates counting stats and derives rates', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
    await db.models.Player.create({ id: 1, gameWorldId: 1, teamId: null, givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date(), attributes: { positions: {}, pitches: [] } });
    await db.models.Game.bulkCreate([{ id: 1, homeTeam: 1, awayTeam: 2, status: 'COMPLETED' }, { id: 2, homeTeam: 1, awayTeam: 2, status: 'COMPLETED' }]);
    await db.models.PlayerGameStats.bulkCreate([{ playerId: 1, gameId: 1, AB: 4, H: 2, BB: 1, '2B': 1, HR: 1, IP: 3, ER: 1, pitchingH: 2, pitchingBB: 1 }, { playerId: 1, gameId: 2, AB: 2, H: 1, IP: 0 }]);
    await expect(PlayerFactory(1).getStats({ grain: 'career', gwId: 1 })).resolves.toMatchObject({ batting: { G: 2, AB: 6, H: 3, AVG: 0.5, SLG: 1.1667, OPS: 1.7381 }, pitching: { ERA: 3, WHIP: 1 } });
  });
  // @spec PSTATQ-003
  it('@spec PSTATQ-003 returns null for a player with no rows', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, config: {} }); await db.models.Player.create({ id: 2, gameWorldId: 1, teamId: null, givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date(), attributes: { positions: {}, pitches: [] } });
    await expect(PlayerFactory(2).getStats({ grain: 'career', gwId: 1 })).resolves.toBeNull();
  });
  // @spec PSTATQ-001,PSTATQ-002
  it('@spec PSTATQ-001 @spec PSTATQ-002 filters season through DivisionSeason and limits last10 by game date', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
    await db.models.Player.create({ id: 1, gameWorldId: 1, teamId: null, givenName: 'A', familyName: 'B', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date(), attributes: { positions: {}, pitches: [] } });
    await db.models.Game.bulkCreate(Array.from({ length: 11 }, (_, index) => ({ id: index + 1, homeTeam: 1, awayTeam: 2, scheduledDate: new Date(2025, 0, index + 1), status: 'COMPLETED' })));
    await db.models.PlayerGameStats.bulkCreate(Array.from({ length: 11 }, (_, index) => ({ playerId: 1, gameId: index + 1, AB: 1, H: 1 })));
    const league: any = await db.models.League.create({ gameWorldId: 1, config: {} });
    await db.models.Team.bulkCreate([{ id: 1, gameWorldId: 1, homeLeagueId: league.dataValues.id, config: {} }, { id: 2, gameWorldId: 1, homeLeagueId: league.dataValues.id, config: {} }]);
    const division: any = await db.models.Division.create({ leagueId: league.dataValues.id, config: {} });
    const current: any = await db.models.DivisionSeason.create({ divisionId: division.dataValues.id, teamId: 1, year: 2025 });
    const prior: any = await db.models.DivisionSeason.create({ divisionId: division.dataValues.id, teamId: 2, year: 2024 });
    await db.models.DivisionSeasonGame.bulkCreate([{ divisionSeasonId: current.dataValues.id, gameId: 11 }, { divisionSeasonId: prior.dataValues.id, gameId: 1 }]);
    await expect(PlayerFactory(1).getStats({ grain: 'season', gwId: 1 })).resolves.toMatchObject({ batting: { G: 1, AB: 1 } });
    await expect(PlayerFactory(1).getStats({ grain: 'last10', gwId: 1 })).resolves.toMatchObject({ batting: { G: 10, AB: 10 } });
  });
});
