import db from '../../../src/db/client';
import { GameFactory } from '../../../src/db/domain';

describe('GameFactory', () => {
  it('creates an unscheduled game', async () => {
    const game = await GameFactory().create(1,2);
    const actual = await db.models.Game.findByPk(game.id)
      .then((result) => { if (!result) throw Error(); return result })
      .then(({ dataValues }) => dataValues);
    expect(actual.homeTeam).toStrictEqual(1);
    expect(actual.awayTeam).toStrictEqual(2);
  });
});