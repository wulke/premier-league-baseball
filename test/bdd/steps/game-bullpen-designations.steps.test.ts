// @spec GBULL-001,GBULL-002,GBULL-003,GBULL-004,GBULL-005
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';
import { TeamFactory } from '../../../src/db/domain/team';
import { DomainError } from '../../../src/db/domain/errors';

const feature = loadFeature(path.resolve(__dirname, '../features/game-bullpen-designations.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];
let response: any;
let beforeSave: any;

const setup = async () => {
  await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
  await db.models.Team.create({ id: 10, gameWorldId: 1, config: { name: 'Harbor' } });
  const lineup = await db.models.Lineup.create({ teamId: 10, gameWorldId: 1 }).then((row: any) => row.dataValues);
  const players = await Promise.all(Array.from({ length: 12 }, (_, index) => db.models.Player.create({
    teamId: 10, gameWorldId: 1, givenName: 'Player', familyName: String(index + 1), countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
    attributes: { positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
  }).then((row: any) => row.dataValues)));
  await db.models.LineupEntry.bulkCreate([
    ...positions.map((position, index) => ({ lineupId: lineup.id, playerId: players[index].id, role: 'STARTER', battingOrder: position === 'Pitcher' ? 9 : index, fieldingPosition: position })),
    { lineupId: lineup.id, playerId: players[9].id, role: 'BENCH', battingOrder: null, fieldingPosition: null },
    { lineupId: lineup.id, playerId: players[10].id, role: 'BENCH', battingOrder: null, fieldingPosition: null },
    { lineupId: lineup.id, playerId: players[11].id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null },
  ]);
};
const game = async (id: number, status: string = 'SCHEDULED', date = '2025-04-01') => db.models.Game.create({ id, homeTeam: 10, awayTeam: 11, status, scheduledDate: new Date(date) });
const capture = async (work: () => Promise<any>) => { try { response = { statusCode: 200, body: await work() }; } catch (error) { response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any).statusCode, error }; } };
const entriesFor = async (gameId: number) => TeamFactory(10).getLineup({ gameId }).then((lineup) => [
  ...lineup.starters.map((entry) => ({ ...entry, role: 'STARTER' })),
  ...lineup.bench.map((entry) => ({ ...entry, role: 'BENCH', battingOrder: null, fieldingPosition: null })),
  ...lineup.bullpen.map((entry) => ({ ...entry, role: 'BULLPEN', battingOrder: null, fieldingPosition: null })),
]);

beforeEach(async () => { await db.sync({ force: true }); response = undefined; beforeSave = undefined; });

autoBindSteps(feature, [({ given, when, then }: any) => {
  given('GameWorld 1 has a team with a valid active lineup for bullpen designations', setup);
  given('Team 10 has scheduled games 40 and 41 in date order', async () => { await game(40, 'SCHEDULED', '2025-04-01'); await game(41, 'SCHEDULED', '2025-04-02'); });
  given('Team 10 has scheduled Game 40', async () => { await game(40); });
  given('Team 10 has an IN_PROGRESS Game 40', async () => { await game(40, 'IN_PROGRESS'); await TeamFactory(10).snapshotForGame(40); });
  when("the client reads Team 10's next-game lineup", async () => capture(() => (handlers as any).getNextTeamGameLineup(10, 1)));
  when('the client saves a valid changed lineup for Game 40', async () => {
    await TeamFactory(10).snapshotForGame(40); beforeSave = await TeamFactory(10).getLineup({ gameId: 40 });
    const entries = await entriesFor(40); const pitcher = entries.find((entry) => entry.fieldingPosition === 'Pitcher')!; const bullpen = entries.find((entry) => entry.role === 'BULLPEN')!;
    [pitcher.playerId, bullpen.playerId] = [bullpen.playerId, pitcher.playerId];
    await capture(() => (handlers as any).saveTeamGameLineup(10, 40, entries));
  });
  when('the client saves an invalid lineup for Game 40', async () => {
    await TeamFactory(10).snapshotForGame(40); beforeSave = await TeamFactory(10).getLineup({ gameId: 40 });
    const entries = await entriesFor(40); entries[1].playerId = entries[0].playerId;
    await capture(() => (handlers as any).saveTeamGameLineup(10, 40, entries));
  });
  then('Game 40 is returned with a per-game lineup snapshot', async () => { expect(response.body.game.id).toBe(40); await expect(db.models.Lineup.count({ where: { teamId: 10, gameId: 40 } })).resolves.toBe(1); });
  then('no next-game lineup is returned', () => expect(response.body).toBeNull());
  then("Game 40's saved lineup contains the changed starter", () => { expect(response.statusCode).toBe(200); expect(response.body.startingPitcherId).not.toBe(beforeSave.startingPitcherId); });
  then('the save is rejected and Game 40\'s snapshot is unchanged', async () => { expect(response.statusCode).toBe(422); await expect(TeamFactory(10).getLineup({ gameId: 40 })).resolves.toEqual(beforeSave); });
}]);
