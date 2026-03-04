import { simulateGame } from '../../../src/api/handlers';
import db from '../../../src/db/client';
import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'path';

const feature = loadFeature(path.resolve(__dirname, '../features/simulate-game.feature'));

defineFeature(feature, (test) => {
  let gameId: number | undefined;

  beforeEach(async () => {
    await db.sync({ force: true });
    gameId = undefined;
  });

  test('Game status transitions from SCHEDULED to COMPLETED after simulation', ({ given, when, then, and }) => {
    given(/^a Game exists with status "([^"]+)" and scheduledDate "([^"]+)"$/, async (status: string, scheduledDate: string) => {
      const game = await db.models.Game.create({
        homeTeam: 1,
        awayTeam: 2,
        status,
        scheduledDate: new Date(scheduledDate),
      }).then(({ dataValues }) => dataValues);
      gameId = game.id;
    });

    when('the player simulates the game by id', async () => {
      if (!gameId) throw new Error('gameId was not initialized');
      await simulateGame(gameId);
    });

    then(/^the game status is "([^"]+)"$/, async (expectedStatus: string) => {
      if (!gameId) throw new Error('gameId was not initialized');
      const game = await db.models.Game.findByPk(gameId);
      expect(game).not.toBeNull();
      expect(game?.dataValues.status).toBe(expectedStatus);
    });

    and(/^the game status is no longer "([^"]+)"$/, async (previousStatus: string) => {
      if (!gameId) throw new Error('gameId was not initialized');
      const game = await db.models.Game.findByPk(gameId);
      expect(game).not.toBeNull();
      expect(game?.dataValues.status).not.toBe(previousStatus);
    });
  });
});
