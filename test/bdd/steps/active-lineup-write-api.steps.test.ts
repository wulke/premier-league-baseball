// @spec LWRITE-001,LWRITE-002,LWRITE-003
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/active-lineup-write-api.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
let teamId = 10;
let submitted: any[] = [];
let response: { statusCode: number; error?: unknown } | undefined;
let before: any[] = [];
let foreignPlayerId: number | undefined;

const storedEntries = async () => {
  const lineup = await db.models.Lineup.findOne({ where: { teamId, gameId: null } });
  if (!lineup) throw Error('missing active lineup');
  return db.models.LineupEntry.findAll({ where: { lineupId: lineup.dataValues.id } })
    .then((rows: any[]) => rows.map(({ dataValues }) => ({ playerId: dataValues.playerId, role: dataValues.role, battingOrder: dataValues.battingOrder, fieldingPosition: dataValues.fieldingPosition }))
      .sort((left, right) => left.playerId - right.playerId));
};

const createActiveLineup = async () => {
  await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
  await db.models.Team.create({ id: teamId, gameWorldId: 1, config: { name: 'Write Club' } });
  const lineup = await db.models.Lineup.create({ teamId, gameWorldId: 1 }).then((row: any) => row.dataValues);
  const players = await Promise.all(Array.from({ length: 11 }, (_, index) => db.models.Player.create({
    teamId, gameWorldId: 1, givenName: 'Player', familyName: String(index + 1), countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
    attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
  }).then((row: any) => row.dataValues)));
  submitted = [
    ...positions.map((position, index) => ({ playerId: players[index].id, role: 'STARTER', battingOrder: position === 'Pitcher' ? 9 : index, fieldingPosition: position })),
    ...players.slice(9).map((player: any) => ({ playerId: player.id, role: 'BENCH', battingOrder: null, fieldingPosition: null })),
  ];
  await db.models.LineupEntry.bulkCreate(submitted.map((entry) => ({ lineupId: lineup.id, ...entry })));
  before = await storedEntries();
};

beforeEach(async () => { await db.sync({ force: true }); teamId = 10; submitted = []; response = undefined; before = []; foreignPlayerId = undefined; });

autoBindSteps(feature, [({ given, when, then, and }: any) => {
  given(/^Team (\d+) has a valid active lineup$/, async (id: string) => { teamId = Number(id); await createActiveLineup(); });
  given(/^Team (\d+) has an eligible player outside Team (\d+)'s active lineup$/, async (foreignTeamId: string, activeTeamId: string) => {
    const otherTeamId = Number(foreignTeamId);
    await db.models.Team.create({ id: otherTeamId, gameWorldId: 1, config: { name: 'Other Club' } });
    foreignPlayerId = await db.models.Player.create({
      teamId: otherTeamId, gameWorldId: 1, givenName: 'Foreign', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
      attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
    }).then((row: any) => row.dataValues.id);
    teamId = Number(activeTeamId);
  });
  when('the client saves a valid active lineup with a bench player in a starter slot', async () => {
    const catcher = submitted.find((entry) => entry.fieldingPosition === 'Catcher');
    const bench = submitted.find((entry) => entry.role === 'BENCH');
    [catcher.playerId, bench.playerId] = [bench.playerId, catcher.playerId];
    await (handlers as any).updateTeamLineup(teamId, submitted);
  });
  when('the client saves an invalid active lineup with a duplicate player', async () => {
    submitted[1].playerId = submitted[0].playerId;
    try { await (handlers as any).updateTeamLineup(teamId, submitted); response = { statusCode: 200 }; }
    catch (error) { response = { statusCode: (error as any).statusCode ?? 500, error }; }
  });
  when(/^the client saves Team (\d+)'s active lineup with Team (\d+)'s player$/, async (activeTeamId: string) => {
    submitted[1].playerId = foreignPlayerId!;
    try { await (handlers as any).updateTeamLineup(Number(activeTeamId), submitted); response = { statusCode: 200 }; }
    catch (error) { response = { statusCode: (error as any).statusCode ?? 500, error }; }
  });
  when(/^the client saves Team (\d+)'s active lineup without a bench entry$/, async (activeTeamId: string) => {
    submitted = submitted.filter((entry) => entry.role !== 'BENCH');
    try { await (handlers as any).updateTeamLineup(Number(activeTeamId), submitted); response = { statusCode: 200 }; }
    catch (error) { response = { statusCode: (error as any).statusCode ?? 500, error }; }
  });
  then('the active lineup persists the submitted slot assignments', async () => expect(await storedEntries()).toEqual([...submitted].sort((left, right) => left.playerId - right.playerId)));
  then('the lineup save is rejected as invalid', () => expect(response?.statusCode).toBe(422));
  and('the stored active lineup remains unchanged', async () => expect(await storedEntries()).toEqual(before));
}]);
