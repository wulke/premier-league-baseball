// @spec PARP-014
import db from '../../../src/db/client';
import { migratePlayerGameStatsOutsRecorded } from '../../../src/db/migrations/player-game-stats-outs-recorded';

describe('PlayerGameStats outsRecorded migration', () => {
  beforeEach(async () => { await db.sync({ force: true }); });

  // @spec PARP-014
  it('@spec PARP-014 adds outsRecorded with a zero default to a legacy PlayerGameStats table', async () => {
    await db.getQueryInterface().removeColumn('PlayerGameStats', 'outsRecorded');

    await migratePlayerGameStatsOutsRecorded(db);

    const columns = await db.getQueryInterface().describeTable('PlayerGameStats');
    expect(columns.outsRecorded).toMatchObject({ allowNull: false, defaultValue: '0' });
  });

  // @spec PARP-014
  it('@spec PARP-014 is a no-op when outsRecorded already exists', async () => {
    await expect(migratePlayerGameStatsOutsRecorded(db)).resolves.toBeUndefined();
  });
});
