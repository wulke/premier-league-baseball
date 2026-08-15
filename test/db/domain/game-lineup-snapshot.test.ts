// @spec LSNAP-003
import { UniqueConstraintError } from 'sequelize';
import db from '../../../src/db/client';
import { TeamFactory } from '../../../src/db/domain/team';

describe('TeamFactory snapshotForGame race recovery', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  afterEach(() => { jest.restoreAllMocks(); });

  const setup = async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2025 });
    const team = await db.models.Team.create({ gameWorldId: gameWorld.dataValues.id, config: { name: 'Race Club' } });
    await db.models.Game.create({ id: 40, homeTeam: team.dataValues.id, awayTeam: team.dataValues.id });
    const active = await db.models.Lineup.create({ teamId: team.dataValues.id, gameWorldId: gameWorld.dataValues.id });
    return { team: team.dataValues, active, winner: { id: 999, teamId: team.dataValues.id, gameWorldId: gameWorld.dataValues.id, gameId: 40 } };
  };

  // @spec LSNAP-003
  it('@spec LSNAP-003 returns the established lineup after a unique-index race', async () => {
    const { team, active, winner } = await setup();
    jest.spyOn(db.models.Lineup, 'findOne' as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({ dataValues: winner });
    jest.spyOn(db.models.Lineup, 'create' as any).mockRejectedValue(new UniqueConstraintError({ errors: [], message: 'duplicate lineup' }));

    await expect(TeamFactory(team.id).snapshotForGame(40)).resolves.toEqual(winner);
  });

  // @spec LSNAP-003
  it('@spec LSNAP-003 does not mask a non-unique snapshot write failure', async () => {
    const { team, active, winner } = await setup();
    jest.spyOn(db.models.Lineup, 'findOne' as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({ dataValues: winner });
    jest.spyOn(db.models.Lineup, 'create' as any).mockRejectedValue(new Error('storage failure'));

    await expect(TeamFactory(team.id).snapshotForGame(40)).rejects.toThrow('storage failure');
  });
});
