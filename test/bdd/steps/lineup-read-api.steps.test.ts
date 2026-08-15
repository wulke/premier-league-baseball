// @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004
// Lineup read API acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';
import { DomainError } from '../../../src/db/domain/errors';

const feature = loadFeature(path.resolve(__dirname, '../features/lineup-read-api.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
let response: { statusCode: number; body?: any; error?: unknown } | undefined;
let expected: { pitcherId?: number; bench: number[]; bullpen: number[] } = { bench: [], bullpen: [] };

const createPlayer = async (teamId: number, gameWorldId: number, index: number) => db.models.Player.create({
  teamId, gameWorldId, givenName: `Lineup${index}`, familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
  attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
    positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
}).then((row: any) => row.dataValues);

const createActiveLineup = async (teamId: number, gameWorldId: number, dhEnabled: boolean) => {
  await db.models.Team.create({ id: teamId, gameWorldId, config: { name: `Lineup Team ${teamId}` } });
  const lineup = await db.models.Lineup.create({ teamId, gameWorldId }).then((row: any) => row.dataValues);
  const starters = await Promise.all(positions.map((position, index) => createPlayer(teamId, gameWorldId, index + 1)));
  const dh = dhEnabled ? await createPlayer(teamId, gameWorldId, 10) : undefined;
  const bench = await Promise.all([11, 12].map((index) => createPlayer(teamId, gameWorldId, index)));
  const bullpen = await Promise.all([13, 14].map((index) => createPlayer(teamId, gameWorldId, index)));
  await db.models.LineupEntry.bulkCreate([
    ...starters.map((player: any, index: number) => ({ lineupId: lineup.id, playerId: player.id, role: 'STARTER', battingOrder: index === 0 && dhEnabled ? null : (dhEnabled ? index : index + 1), fieldingPosition: positions[index] })),
    ...(dh ? [{ lineupId: lineup.id, playerId: dh.id, role: 'STARTER', battingOrder: 9, fieldingPosition: null }] : []),
    ...bench.map((player: any) => ({ lineupId: lineup.id, playerId: player.id, role: 'BENCH', battingOrder: null, fieldingPosition: null })),
    ...bullpen.map((player: any) => ({ lineupId: lineup.id, playerId: player.id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null })),
  ]);
  expected = { pitcherId: starters[0].id, bench: bench.map((player: any) => player.id), bullpen: bullpen.map((player: any) => player.id) };
};

const capture = async (teamId: number, gwId?: number) => {
  try { response = { statusCode: 200, body: await (handlers as any).getTeamLineup(teamId, gwId) }; }
  catch (error) { response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error }; }
};

beforeEach(async () => { await db.sync({ force: true }); response = undefined; expected = { bench: [], bullpen: [] }; });

autoBindSteps(feature, [({ given, when, then }: any) => {
  given(/^GameWorld (\d+) exists for lineup reads$/, async (gwId: string) => { await db.models.GameWorld.create({ id: Number(gwId), year: 2025, config: {} }); });
  given(/^Team (\d+) in GameWorld (\d+) has a DH-off active lineup$/, async (teamId: string, gwId: string) => createActiveLineup(Number(teamId), Number(gwId), false));
  given(/^Team (\d+) in GameWorld (\d+) has a DH-on active lineup$/, async (teamId: string, gwId: string) => createActiveLineup(Number(teamId), Number(gwId), true));
  when(/^the client requests the active lineup for Team (\d+)$/, async (teamId: string) => capture(Number(teamId)));
  when(/^the client requests the active lineup for Team (\d+) with \?gwId=(\d+)$/, async (teamId: string, gwId: string) => capture(Number(teamId), Number(gwId)));
  then('the response contains nine starters in batting order', () => {
    expect(response?.body.starters).toEqual(expect.arrayContaining([
      expect.objectContaining({ battingOrder: 1 }), expect.objectContaining({ battingOrder: 9 }),
    ]));
    expect(response?.body.starters).toHaveLength(9);
  });
  then('the response derives the starting pitcher from the Pitcher starter entry', () => expect(response?.body.startingPitcherId).toBe(expected.pitcherId));
  then('the response exposes the bench and bullpen as order-agnostic player ID pools', () => {
    expect(response?.body.bench.map((row: any) => row.playerId)).toEqual(expect.arrayContaining(expected.bench));
    expect(response?.body.bullpen.map((row: any) => row.playerId)).toEqual(expect.arrayContaining(expected.bullpen));
  });
  then('the response has no DH starter', () => expect(response?.body.starters.some((starter: any) => starter.fieldingPosition === null)).toBe(false));
  then('the response contains ten starters including the null-position DH', () => {
    expect(response?.body.starters).toHaveLength(10);
    expect(response?.body.starters).toContainEqual(expect.objectContaining({ fieldingPosition: null, battingOrder: 9 }));
  });
  then('the DH-on pitcher has no batting order', () => expect(response?.body.starters).toContainEqual(expect.objectContaining({ fieldingPosition: 'Pitcher', battingOrder: null })));
  then('the lineup response indicates the Team was not found', () => expect(response?.statusCode).toBe(404));
}]);
