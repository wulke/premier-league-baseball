// @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
// Player detail read API acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';
import { PlayerAttributes, PlayerPosition } from '../../../src/api/models';

const feature = loadFeature(path.resolve(__dirname, '../features/player-detail-read-api.feature'));

const positions = (overrides: Partial<Record<PlayerPosition, number>> = {}): Record<PlayerPosition, number> => ({
  Pitcher: 10, Catcher: 10, FirstBase: 10, SecondBase: 10, ThirdBase: 10,
  Shortstop: 10, LeftField: 10, CenterField: 10, RightField: 10, ...overrides,
});

const attributes = (positionRatings: Partial<Record<PlayerPosition, number>> = {}): PlayerAttributes => ({
  contact: 61, power: 62, armStrength: 63, accuracy: 64, reaction: 65, vision: 66, discipline: 67,
  positions: positions(positionRatings),
  pitches: [{ type: 'Fastball', velocity: 81, control: 72, spin: 68 }, { type: 'Slider', velocity: 70, control: 64, spin: 77 }],
});

interface ScenarioWorld { response?: { statusCode: number; body?: any; error?: unknown }; }
let scenarioWorld: ScenarioWorld = {};

const createPlayer = async (id: number, teamId: number | null = 10, positionRatings: Partial<Record<PlayerPosition, number>> = {}) => {
  return await db.models.Player.create({
    id, teamId, gameWorldId: 1, attributes: attributes(positionRatings), givenName: 'Marcus', familyName: 'Jones',
    countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-06-01T00:00:00.000Z'),
  }).then(({ dataValues }) => dataValues);
};

const createContract = async (playerId: number, startDate = '2025-03-01', endDate = '2025-10-31') => {
  await db.models.Contract.create({ playerId, teamId: 10, startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`) });
};

const captureDetail = async (playerId: number, gwId?: number) => {
  try {
    const body = await (handlers as any).getPlayerDetail(playerId, gwId);
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
  }
};

const detail = () => scenarioWorld.response?.body;
const errorText = () => scenarioWorld.response?.error instanceof Error ? scenarioWorld.response.error.message : '';

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+), year (\d+), and currentDate "([^"]+)"$/, async (id: string, year: string, currentDate: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: Number(year), currentDate, config: {} });
    await db.models.Team.create({ id: 10, gameWorldId: Number(id), config: { name: 'Detail Club' } });
  });
  given(/^Player 100 belongs to GameWorld 1 with identity, attributes, and a current Contract$/, async () => { await createPlayer(100); await createContract(100); });
  given(/^Player (\d+) belongs to GameWorld (\d+)$/, async (id: string) => { if (!await db.models.Player.findByPk(Number(id))) await createPlayer(Number(id)); });
  given(/^Player (\d+) has a Contract spanning "([^"]+)" to "([^"]+)"$/, async (id: string, start: string, end: string) => { if (!await db.models.Player.findByPk(Number(id))) await createPlayer(Number(id)); await createContract(Number(id), start, end); });
  given(/^GameWorld 1's currentDate is null$/, async () => { await db.models.GameWorld.update({ currentDate: null }, { where: { id: 1 } }); });
  given(/^Player (\d+) belongs to GameWorld 1 with no Contract covering "([^"]+)"$/, async (id: string) => { await createPlayer(Number(id)); });
  given(/^Player (\d+) is a free agent with teamId null$/, async (id: string) => { await createPlayer(Number(id), null); });
  given('a Player whose positions map has Shortstop and ThirdBase tied for the highest rating', async () => { await createPlayer(104, 10, { Shortstop: 90, ThirdBase: 90 }); });
  when(/^the player requests the detail for Player (\d+)$/, async (id: string) => { await captureDetail(Number(id)); });
  when(/^the player requests the detail for Player (\d+) with \?gwId=(\d+)$/, async (id: string, gwId: string) => { await captureDetail(Number(id), Number(gwId)); });
  when('the player requests the detail for that Player', async () => { await captureDetail(104); });
  then('the response includes the Player\'s identity fields', () => expect(detail()).toEqual(expect.objectContaining({ id: 100, givenName: 'Marcus', familyName: 'Jones', countryCode: 'US', bats: 'R', throws: 'R', birthDate: expect.any(String), age: 25 })));
  then('the response includes the full flat-7 ratings verbatim', () => expect(detail()).toEqual(expect.objectContaining({ contact: 61, power: 62, armStrength: 63, accuracy: 64, reaction: 65, vision: 66, discipline: 67 })));
  then('the response includes the full 9-key positions map verbatim', () => expect(detail().positions).toEqual(attributes().positions));
  then('the response includes the full pitches repertoire verbatim', () => expect(detail().pitches).toEqual(attributes().pitches));
  then('the response includes the current Contract', () => expect(detail().contract).toEqual({ team: { id: 10, name: 'Detail Club' }, startDate: '2025-03-01', endDate: '2025-10-31' }));
  then('the response does not include a stored or computed OVR', () => expect(detail()).not.toHaveProperty('ovr'));
  then('the response does not include Player.teamId', () => expect(detail()).not.toHaveProperty('teamId'));
  then('the response does not include Player.gameWorldId', () => expect(detail()).not.toHaveProperty('gameWorldId'));
  then('the team is reachable only via the contract field', () => expect(detail().contract.team).toEqual({ id: 10, name: 'Detail Club' }));
  then('the response indicates the Player was not found', () => { expect(scenarioWorld.response?.statusCode).toBe(404); expect(errorText()).toContain('Not found'); });
  then(/^the response's contract has startDate "([^"]+)" and endDate "([^"]+)"$/, (start: string, end: string) => expect(detail().contract).toEqual(expect.objectContaining({ startDate: start, endDate: end })));
  then('the response\'s contract is null', () => expect(detail().contract).toBeNull());
  then('the response includes the Player\'s identity and full attributes', () => expect(detail()).toEqual(expect.objectContaining({ givenName: 'Marcus', positions: attributes().positions, pitches: attributes().pitches })));
  then('the response includes no flag, listing, or writes', () => expect(Object.keys(detail())).not.toEqual(expect.arrayContaining(['freeAgent', 'listing'])));
  then('the derived primaryPosition is the first-listed of the tied positions in enum order', () => expect(detail().primaryPosition).toBe('ThirdBase'));
};

beforeEach(async () => { await db.sync({ force: true }); scenarioWorld = {}; });
autoBindSteps(feature, [registerSteps]);
