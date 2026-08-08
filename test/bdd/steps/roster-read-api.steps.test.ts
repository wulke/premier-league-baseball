// @spec ROST-001,ROST-002,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010
// Roster read API acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';
import { PlayerAttributes, PlayerPosition } from '../../../src/api/models';

const feature = loadFeature(path.resolve(__dirname, '../features/roster-read-api.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  teamId?: number;
  playerIds: number[];
  response?: ResponseState;
}

const positions = (overrides: Partial<Record<PlayerPosition, number>> = {}): Record<PlayerPosition, number> => ({
  Pitcher: 10,
  Catcher: 10,
  FirstBase: 10,
  SecondBase: 10,
  ThirdBase: 10,
  Shortstop: 10,
  LeftField: 10,
  CenterField: 10,
  RightField: 10,
  ...overrides,
});

const attributes = (positionRatings: Partial<Record<PlayerPosition, number>> = {}): PlayerAttributes => ({
  contact: 61,
  power: 62,
  armStrength: 63,
  accuracy: 64,
  reaction: 65,
  vision: 66,
  discipline: 67,
  positions: positions(positionRatings),
  pitches: [],
});

let scenarioWorld: WorldState = { playerIds: [] };

const createPlayer = async (teamId: number, positionRatings: Partial<Record<PlayerPosition, number>> = {}) => {
  const player = await db.models.Player.create({
    teamId,
    gameWorldId: 1,
    attributes: attributes(positionRatings),
    givenName: `Player${scenarioWorld.playerIds.length + 1}`,
    familyName: 'Roster',
    countryCode: 'US',
    bats: 'R',
    throws: 'R',
    birthDate: new Date('2000-06-01T00:00:00.000Z'),
  }).then(({ dataValues }) => dataValues);
  await db.models.Contract.create({
    playerId: player.id,
    teamId,
    startDate: new Date('2025-03-01T00:00:00.000Z'),
    endDate: new Date('2025-10-31T00:00:00.000Z'),
  });
  scenarioWorld.playerIds.push(player.id);
  return player;
};

const captureRoster = async (teamId: number, gwId?: number) => {
  try {
    const body = await (handlers as any).getTeamRoster(teamId, gwId);
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = {
      statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500,
      error,
    };
  }
};

const roster = (): any[] => Array.isArray(scenarioWorld.response?.body) ? scenarioWorld.response!.body : [];
const errorText = (): string => scenarioWorld.response?.error instanceof Error ? scenarioWorld.response.error.message : '';

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (id: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: Number(year), config: {} });
  });

  given(/^Team (\d+) belongs to GameWorld (\d+)$/, async (teamId: string, gwId: string) => {
    await db.models.Team.findOrCreate({ where: { id: Number(teamId) }, defaults: { gameWorldId: Number(gwId), config: { name: 'Roster Team' } } });
    scenarioWorld.teamId = Number(teamId);
  });

  given(/^Team (\d+) has a roster of generated Players with identity and Contracts$/, async (teamId: string) => {
    await createPlayer(Number(teamId), { Shortstop: 80 });
  });

  given('a Player whose positions map has two positions at or above the threshold and a lower-rated primary', async () => {
    await createPlayer(scenarioWorld.teamId!, { Catcher: 60, FirstBase: 75, SecondBase: 80 });
  });

  given(/^Team (\d+)'s Players were created in a known id order$/, async () => {
    await createPlayer(scenarioWorld.teamId!, { LeftField: 75 });
    await createPlayer(scenarioWorld.teamId!, { CenterField: 80 });
  });

  given(/^Team (\d+) belongs to GameWorld (\d+) with no roster$/, async (teamId: string, gwId: string) => {
    await db.models.Team.create({ id: Number(teamId), gameWorldId: Number(gwId), config: { name: 'Empty Team' } });
  });

  given('a Player whose positions map has Shortstop and ThirdBase tied for the highest rating', async () => {
    await createPlayer(scenarioWorld.teamId!, { ThirdBase: 90, Shortstop: 90 });
  });

  when(/^the player requests the roster for Team (\d+)$/, async (teamId: string) => {
    await captureRoster(Number(teamId));
  });

  when(/^the player requests the roster for Team (\d+) with \?gwId=(\d+)$/, async (teamId: string, gwId: string) => {
    await captureRoster(Number(teamId), Number(gwId));
  });

  then('the response is a flat array of roster rows', () => {
    expect(Array.isArray(scenarioWorld.response?.body)).toBe(true);
  });

  then('each row corresponds to a Player on one of Team 10\'s Contracts', async () => {
    const contracts = await db.models.Contract.findAll({ where: { teamId: 10 } });
    expect(roster().map((row) => row.id)).toEqual(contracts.map(({ dataValues }) => dataValues.playerId));
  });

  then('each row includes identity fields', () => {
    expect(roster()[0]).toEqual(expect.objectContaining({
      id: expect.any(Number), givenName: expect.any(String), familyName: expect.any(String),
      countryCode: 'US', bats: 'R', throws: 'R', age: 25,
    }));
  });

  then('each row includes a derived primaryPosition', () => expect(roster()[0]?.primaryPosition).toBe('Shortstop'));
  then('each row includes the flat-7 ratings verbatim', () => expect(roster()[0]).toEqual(expect.objectContaining({ contact: 61, power: 62, armStrength: 63, accuracy: 64, reaction: 65, vision: 66, discipline: 67 })));
  then('no row includes a stored or computed OVR', () => expect(roster().every((row) => !('ovr' in row) && !('OVR' in row))).toBe(true));
  then('that Player\'s row includes a positionCoverage containing both above-threshold positions', () => expect(roster().at(-1)?.positionCoverage).toEqual(expect.arrayContaining(['FirstBase', 'SecondBase'])));
  then('the primaryPosition is always present in positionCoverage', () => expect(roster().at(-1)?.positionCoverage).toContain(roster().at(-1)?.primaryPosition));
  then('the rows are returned in Player.id order', () => expect(roster().map((row) => row.id)).toEqual([...roster().map((row) => row.id)].sort((a, b) => a - b)));
  then('the response indicates the Team was not found', () => {
    expect(scenarioWorld.response?.statusCode).toBe(404);
    expect(errorText()).toContain('Not found');
  });
  then('the response is an empty array', () => expect(scenarioWorld.response?.body).toEqual([]));
  then('that Player\'s derived primaryPosition is the first-listed of the tied positions in enum order', () => expect(roster().at(-1)?.primaryPosition).toBe('ThirdBase'));
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = { playerIds: [] };
});

autoBindSteps(feature, [registerSteps]);
