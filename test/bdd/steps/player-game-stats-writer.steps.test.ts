// @spec PGSW-001,PGSW-002,PGSW-003,PGSW-004
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import { GameFactory } from '../../../src/db/domain';

const feature = loadFeature(path.resolve(__dirname, '../features/player-game-stats-writer.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];

let game: any;
let homeTeam: any;
let awayTeam: any;
let homePlayers: any[] = [];
let awayPlayers: any[] = [];

const createPlayer = async (teamId: number, gameWorldId: number, index: number) => (
  db.models.Player.create({
    teamId, gameWorldId, givenName: `Player${teamId}-${index}`, familyName: 'Writer', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
    attributes: { positions: {}, pitches: [] },
  }).then(({ dataValues }: any) => dataValues)
);

const createCompleteLineup = async (team: any, gameWorldId: number) => {
  const players = await Promise.all(Array.from({ length: 10 }, (_, index) => createPlayer(team.id, gameWorldId, index + 1)));
  const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId }).then(({ dataValues }: any) => dataValues);
  await db.models.LineupEntry.bulkCreate([
    ...positions.map((fieldingPosition, index) => ({ lineupId: lineup.id, playerId: players[index].id, role: 'STARTER', battingOrder: index + 1, fieldingPosition })),
    { lineupId: lineup.id, playerId: players[9].id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null },
  ]);
  return players;
};

const createGame = async () => {
  const gameWorld = await db.models.GameWorld.create({ year: 2025, currentDate: '2025-04-10', config: {} }).then(({ dataValues }: any) => dataValues);
  const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }: any) => dataValues);
  homeTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  awayTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  game = await db.models.Game.create({ homeTeam: homeTeam.id, awayTeam: awayTeam.id, status: 'SCHEDULED' }).then(({ dataValues }: any) => dataValues);
  return gameWorld.id;
};

beforeEach(async () => { await db.sync({ force: true }); game = undefined; homePlayers = []; awayPlayers = []; });

autoBindSteps(feature, [({ given, when, then, and }: any) => {
  given('a scheduled game has complete active lineups for both teams', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId);
    awayPlayers = await createCompleteLineup(awayTeam, gameWorldId);
  });
  given('a scheduled game has a complete home lineup and no away lineup', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId);
  });
  given('a scheduled game has no active lineups', async () => { await createGame(); });
  when('the game completes through single simulation', async () => { await GameFactory(game.id).simulate({ seed: 1 }); });
  then('both teams have player game-stat rows for the game', async () => {
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } })).resolves.toBe(10);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: awayPlayers.map(({ id }) => id) } })).resolves.toBe(10);
  });
  and("each team's player runs equal its completed game score", async () => {
    const completed = await db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues);
    const homeRuns = await db.models.PlayerGameStats.sum('R', { where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } });
    const awayRuns = await db.models.PlayerGameStats.sum('R', { where: { gameId: game.id, playerId: awayPlayers.map(({ id }) => id) } });
    expect(homeRuns).toBe(completed.homeTeamResult);
    expect(awayRuns).toBe(completed.awayTeamResult);
  });
  and("only each lineup's starting pitcher has GS", async () => {
    const starters = [homePlayers[0].id, awayPlayers[0].id];
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, GS: true } })).resolves.toBe(2);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: starters, GS: true } })).resolves.toBe(2);
  });
  then('the completed game has player game-stat rows only for the home team', async () => {
    await expect(db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues.status)).resolves.toBe('COMPLETED');
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } })).resolves.toBe(10);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id } })).resolves.toBe(10);
  });
  then('the completed game has no player game-stat rows', async () => {
    await expect(db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues.status)).resolves.toBe('COMPLETED');
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id } })).resolves.toBe(0);
  });
}]);
