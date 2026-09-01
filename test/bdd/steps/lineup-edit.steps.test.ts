// @spec LEDIT-001,LEDIT-002,LEDIT-003,LEDIT-004
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/lineup-edit.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
let entries: any[] = [];
let before: any[] = [];
let lineupId: number | undefined;
let response: { statusCode: number; body?: any; error?: any } | undefined;
let extraPlayerId: number | undefined;
let foreignPlayerId: number | undefined;

const storedEntries = async () => db.models.LineupEntry.findAll({ where: { lineupId } })
  .then((rows: any[]) => rows.map(({ dataValues }) => ({ playerId: dataValues.playerId, role: dataValues.role, battingOrder: dataValues.battingOrder, fieldingPosition: dataValues.fieldingPosition })).sort((a, b) => a.playerId - b.playerId));

const player = (teamId: number, index: number) => db.models.Player.create({
  teamId, gameWorldId: 1, givenName: 'Player', familyName: String(index), countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
  attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
}).then((row: any) => row.dataValues);

const save = async (teamId: number, proposed = entries) => {
  try { response = { statusCode: 200, body: await (handlers as any).saveTeamLineup(teamId, proposed) }; }
  catch (error) { response = { statusCode: (error as any).statusCode ?? 500, error }; }
};

beforeEach(async () => { await db.sync({ force: true }); delete process.env.DEV_MODE; entries = []; before = []; lineupId = undefined; response = undefined; extraPlayerId = undefined; foreignPlayerId = undefined; });

autoBindSteps(feature, [({ given, when, then, and }: any) => {
  given('managed Team 10 has a DH-on division and an active lineup', async () => {
    await db.models.GameWorld.create({ id: 1, year: 2025, managedTeamId: 10, config: {} });
    await db.models.Team.create({ id: 10, gameWorldId: 1, config: { name: 'Club' } });
    const league = await db.models.League.create({ gameWorldId: 1, year: 2025, config: { matchRules: { dhEnabled: false, benchSize: 5, bullpenSize: 7 } } });
    const division = await db.models.Division.create({ leagueId: league.dataValues.id, config: { name: 'DH Division', matchRules: { dhEnabled: true, benchSize: 1, bullpenSize: 1 } } });
    await db.models.DivisionSeason.create({ divisionId: division.dataValues.id, teamId: 10, year: 2025 });
    const lineup = await db.models.Lineup.create({ teamId: 10, gameWorldId: 1 }); lineupId = lineup.dataValues.id;
    const players = await Promise.all(Array.from({ length: 13 }, (_, index) => player(10, index + 1)));
    entries = [
      ...positions.map((fieldingPosition, index) => ({ playerId: players[index].id, role: 'STARTER', battingOrder: fieldingPosition === 'Pitcher' ? null : index, fieldingPosition })),
      { playerId: players[9].id, role: 'STARTER', battingOrder: 9, fieldingPosition: null },
      { playerId: players[10].id, role: 'BENCH', battingOrder: null, fieldingPosition: null },
      { playerId: players[11].id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null },
    ];
    extraPlayerId = players[12].id;
    await db.models.LineupEntry.bulkCreate(entries.map((entry) => ({ lineupId, ...entry })));
    before = await storedEntries();
  });
  given("Team 11 has a player outside Team 10's roster", async () => {
    await db.models.Team.create({ id: 11, gameWorldId: 1, config: { name: 'Other' } });
    foreignPlayerId = (await player(11, 99)).id;
  });
  given('Team 10 is not the managed club in development mode', async () => {
    await db.models.GameWorld.update({ managedTeamId: 11 }, { where: { id: 1 } });
    process.env.DEV_MODE = 'true';
  });
  when('the manager sends a PUT wholesale lineup save using another roster player', async () => {
    const bench = entries.find((entry) => entry.role === 'BENCH'); bench.playerId = extraPlayerId; await save(10);
  });
  when('Team 11 attempts the wholesale lineup save', async () => { await db.models.Team.create({ id: 11, gameWorldId: 1, config: { name: 'Other' } }); await save(11); });
  when("the manager saves Team 10's lineup with Team 11's player", async () => { entries[1].playerId = foreignPlayerId; await save(10); });
  when(/^the manager saves a lineup with an invalid (.*)$/, async (shape: string) => {
    if (shape === 'duplicate player') entries[1].playerId = entries[0].playerId;
    if (shape === 'batting order') entries[1].battingOrder = entries[2].battingOrder;
    if (shape === 'position coverage') entries[1].fieldingPosition = entries[2].fieldingPosition;
    if (shape === 'DH pitcher slot') entries[0].battingOrder = 1;
    if (shape === 'bench cap') entries.push({ playerId: extraPlayerId, role: 'BENCH', battingOrder: null, fieldingPosition: null });
    if (shape === 'bullpen cap') entries.push({ playerId: extraPlayerId, role: 'BULLPEN', battingOrder: null, fieldingPosition: null });
    await save(10);
  });
  then('the save returns the canonical TeamLineup card', () => {
    expect(response?.statusCode).toBe(200);
    expect(response?.body.startingPitcherId).toBe(entries[0].playerId);
    expect(response?.body.starters).toHaveLength(10);
    expect(response?.body.bench).toEqual([{ playerId: extraPlayerId }]);
    expect(response?.body.bullpen).toHaveLength(1);
  });
  then('the active Lineup row ID is unchanged', async () => expect((await db.models.Lineup.findOne({ where: { teamId: 10, gameId: null } }))?.dataValues.id).toBe(lineupId));
  then('the active lineup persists the submitted entries', async () => expect(await storedEntries()).toEqual([...entries].sort((a, b) => a.playerId - b.playerId)));
  then('the lineup save is rejected with 422', () => expect(response?.statusCode).toBe(422));
  then(/^the rejection says "(.*)"$/, (message: string) => expect(response?.error?.message).toBe(message));
  and('the stored active lineup remains unchanged', async () => expect(await storedEntries()).toEqual(before));
}]);
