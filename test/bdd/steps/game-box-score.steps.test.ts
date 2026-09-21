// @spec BOXS-001,BOXS-002,BOXS-003,BOXS-004,BOXS-005
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';
import { DomainError } from '../../../src/db/domain/errors';

const feature = loadFeature(path.resolve(__dirname, '../features/game-box-score.feature'));
let gameId = 0; let response: any;
const attrs = { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, positions: { Pitcher: 50, Catcher: 50, FirstBase: 50, SecondBase: 50, ThirdBase: 50, Shortstop: 50, LeftField: 50, CenterField: 50, RightField: 50 }, pitches: [] };

const value = (row: any) => row.dataValues;
const createPlayer = (gameWorldId: number, teamId: number, name: string) => db.models.Player.create({ gameWorldId, teamId, attributes: attrs, givenName: name, familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01') }).then(value);

const createBoxScore = async (status = 'COMPLETED') => {
  const gw = await db.models.GameWorld.create({ year: 2025, config: {} }).then(value);
  const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then(value);
  const home = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Home Club' } }).then(value);
  const away = await db.models.Team.create({ gameWorldId: gw.id, homeLeagueId: league.id, config: { name: 'Away Club' } }).then(value);
  const game = await db.models.Game.create({ homeTeam: home.id, awayTeam: away.id, status, homeTeamResult: 7, awayTeamResult: 3 }).then(value);
  gameId = game.id;
  const homeLineup = await db.models.Lineup.create({ teamId: home.id, gameWorldId: gw.id, gameId: game.id }).then(value);
  const awayLineup = await db.models.Lineup.create({ teamId: away.id, gameWorldId: gw.id, gameId: game.id }).then(value);
  const [homeBench, homeStarter, awayStarter] = await Promise.all([createPlayer(gw.id, home.id, 'Home Bench'), createPlayer(gw.id, home.id, 'Home Starter'), createPlayer(gw.id, away.id, 'Away Starter')]);
  await db.models.LineupEntry.bulkCreate([
    { lineupId: homeLineup.id, playerId: homeStarter.id, role: 'STARTER', battingOrder: 1, fieldingPosition: 'Catcher' },
    { lineupId: homeLineup.id, playerId: homeBench.id, role: 'BENCH', battingOrder: null, fieldingPosition: null },
    { lineupId: awayLineup.id, playerId: awayStarter.id, role: 'STARTER', battingOrder: 1, fieldingPosition: 'Pitcher' },
  ]);
  await db.models.PlayerGameStats.bulkCreate([
    { playerId: homeBench.id, gameId: game.id, AB: 1, H: 1 },
    { playerId: homeStarter.id, gameId: game.id, AB: 4, H: 2, R: 2, RBI: 3, '2B': 1, HR: 1 },
    { playerId: awayStarter.id, gameId: game.id, AB: 3, H: 1, outsRecorded: 8, pitchingH: 5, pitchingBB: 2, pitchingSO: 6, ER: 3 },
  ]);
};

beforeEach(async () => { await db.sync({ force: true }); response = undefined; });
autoBindSteps(feature, [({ given, when, then, and }: any) => {
  given('a completed box-score game with frozen home and away lineups', () => createBoxScore());
  given('a scheduled box-score game', () => createBoxScore('SCHEDULED'));
  and('the away side has no recorded box-score stats', async () => { await db.models.PlayerGameStats.destroy({ where: { gameId, playerId: (await db.models.Player.findOne({ where: { givenName: 'Away Starter' } }))!.dataValues.id } }); });
  when('the client requests its box score', async () => { try { response = { statusCode: 200, body: await (handlers as any).getGameBoxScore(gameId) }; } catch (error) { response = { statusCode: error instanceof DomainError ? error.statusCode : 500, error }; } });
  then('the box score attributes players to their frozen home and away sides', () => { expect(response.body.home.players.map((p: any) => p.givenName)).toEqual(['Home Starter', 'Home Bench']); expect(response.body.away.players[0].givenName).toBe('Away Starter'); });
  and('each player includes frozen lineup fields, raw stats, and outs-derived IP', () => { expect(response.body.home.players[0]).toMatchObject({ battingOrder: 1, fieldingPosition: 'Catcher', role: 'STARTER', AB: 4, H: 2, RBI: 3, '2B': 1, HR: 1, IP: 0 }); expect(response.body.away.players[0]).toMatchObject({ fieldingPosition: 'Pitcher', outsRecorded: 8, IP: 8 / 3, pitchingH: 5 }); });
  and('the score header uses the completed game results and players are presentation ordered', () => { expect(response.body).toMatchObject({ home: { score: 7 }, away: { score: 3 } }); });
  then('the box score response is a 422 domain error', () => expect(response.statusCode).toBe(422));
  then('the box score has no away players and retains home players', () => { expect(response.body.away.players).toEqual([]); expect(response.body.home.players).toHaveLength(2); });
}]);
