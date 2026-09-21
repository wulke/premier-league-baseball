// @spec LSNAP-001,LSNAP-002,LSNAP-003,LSNAP-004,LSNAP-005,LREAD-005,LEDIT-008
// Per-game lineup snapshot acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';
import { TeamFactory } from '../../../src/db/domain/team';
import { DomainError } from '../../../src/db/domain/errors';

const feature = loadFeature(path.resolve(__dirname, '../features/game-lineup-snapshot.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'] as const;
let activeAtSnapshot: any;
let response: { statusCode: number; body?: any; error?: unknown } | undefined;
let snapshotResponse: { statusCode: number; body?: any; error?: unknown } | undefined;
let existingLineup: { id: number; entries: any[] } | undefined;

const createPlayer = async (teamId: number, gameWorldId: number, index: number) => db.models.Player.create({
  teamId, gameWorldId, givenName: `Snapshot${index}`, familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
  attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
    positions: Object.fromEntries(positions.map((position) => [position, 50])), pitches: [] },
}).then((row: any) => row.dataValues);

const createActiveLineup = async (teamId: number, gameWorldId: number) => {
  const league = await db.models.League.create({ gameWorldId, config: {} }).then((row: any) => row.dataValues);
  await db.models.Team.create({ id: teamId, gameWorldId, homeLeagueId: league.id, config: { name: `Snapshot Team ${teamId}` } });
  const lineup = await db.models.Lineup.create({ teamId, gameWorldId }).then((row: any) => row.dataValues);
  const players = await Promise.all(Array.from({ length: 11 }, (_, index) => createPlayer(teamId, gameWorldId, index + 1)));
  await db.models.LineupEntry.bulkCreate([
    ...positions.map((position, index) => ({ lineupId: lineup.id, playerId: players[index].id, role: 'STARTER', battingOrder: index + 1, fieldingPosition: position })),
    { lineupId: lineup.id, playerId: players[9].id, role: 'BENCH', battingOrder: null, fieldingPosition: null },
    { lineupId: lineup.id, playerId: players[10].id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null },
  ]);
};

const capture = async (teamId: number, gameId?: number) => {
  try { response = { statusCode: 200, body: await (handlers as any).getTeamLineup(teamId, undefined, gameId) }; }
  catch (error) { response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error }; }
};

beforeEach(async () => { await db.sync({ force: true }); activeAtSnapshot = undefined; response = undefined; snapshotResponse = undefined; existingLineup = undefined; });

autoBindSteps(feature, [({ given, when, then }: any) => {
  given(/^GameWorld (\d+) exists for game lineup snapshots$/, async (gwId: string) => { await db.models.GameWorld.create({ id: Number(gwId), year: 2025, config: {} }); });
  given(/^Team (\d+) in GameWorld (\d+) has an active lineup for snapshots$/, async (teamId: string, gwId: string) => createActiveLineup(Number(teamId), Number(gwId)));
  // @spec LREAD-005 — this separate team owns the game; Team 10 must not cause a snapshot
  // under its own ID merely by passing the foreign game ID to the game-scoped read.
  given(/^Game (\d+) belongs to Team (\d+) in GameWorld (\d+)$/, async (gameId: string, teamId: string, gwId: string) => {
    const homeLeagueId = (await db.models.Team.findByPk(10).then((row: any) => row.dataValues)).homeLeagueId;
    await db.models.Team.create({ id: Number(teamId), gameWorldId: Number(gwId), homeLeagueId, config: { name: `Foreign Team ${teamId}` } });
    await db.models.Game.create({ id: Number(gameId), homeTeam: Number(teamId), awayTeam: Number(teamId), status: 'SCHEDULED' });
  });
  given(/^Team (\d+) has an existing per-game override lineup for Game (\d+)$/, async (teamId: string, gameId: string) => {
    const team = await db.models.Team.findByPk(Number(teamId)).then((row: any) => row.dataValues);
    await db.models.Game.create({ id: Number(gameId), homeTeam: Number(teamId), awayTeam: Number(teamId) });
    const active = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } }).then((row: any) => row.dataValues);
    const entries = await db.models.LineupEntry.findAll({ where: { lineupId: active.id } }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
    const lineup = await db.models.Lineup.create({ teamId: Number(teamId), gameWorldId: team.gameWorldId, gameId: Number(gameId) }).then((row: any) => row.dataValues);
    const overrideEntries = entries.map((entry: any) => ({ lineupId: lineup.id, playerId: entry.playerId, role: entry.role, battingOrder: entry.battingOrder, fieldingPosition: entry.fieldingPosition }));
    overrideEntries[0].battingOrder = 9;
    overrideEntries[8].battingOrder = 1;
    await db.models.LineupEntry.bulkCreate(overrideEntries);
    existingLineup = { id: lineup.id, entries: overrideEntries };
  });
  // @spec LEDIT-008
  given(/^Team (\d+)'s active lineup has a player no longer on its roster$/, async (teamId: string) => {
    const active = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } }).then((row: any) => row.dataValues);
    const entry = await db.models.LineupEntry.findOne({ where: { lineupId: active.id } }).then((row: any) => row.dataValues);
    await db.models.Player.update({ teamId: null }, { where: { id: entry.playerId } });
  });
  when(/^Team (\d+) snapshots its lineup for Game (\d+)$/, async (teamId: string, gameId: string) => {
    activeAtSnapshot = await (handlers as any).getTeamLineup(Number(teamId));
    await db.models.Game.findOrCreate({ where: { id: Number(gameId) }, defaults: { homeTeam: Number(teamId), awayTeam: Number(teamId) } });
    await (TeamFactory(Number(teamId)) as any).snapshotForGame(Number(gameId));
  });
  when(/^Team (\d+) attempts to snapshot missing Game (\d+)$/, async (teamId: string, gameId: string) => {
    try { snapshotResponse = { statusCode: 200, body: await (TeamFactory(Number(teamId)) as any).snapshotForGame(Number(gameId)) }; }
    catch (error) { snapshotResponse = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error }; }
  });
  // @spec LEDIT-008
  when(/^the client requests Team (\d+)'s next-game lineup for Game (\d+)$/, async (teamId: string, gameId: string) => {
    await db.models.Game.create({ id: Number(gameId), homeTeam: Number(teamId), awayTeam: Number(teamId), status: 'SCHEDULED' });
    try { snapshotResponse = { statusCode: 200, body: await (handlers as any).getNextTeamGameLineup(Number(teamId)) }; }
    catch (error) { snapshotResponse = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error }; }
  });
  when(/^the client reads Team (\d+)'s lineup for Game (\d+)$/, async (teamId: string, gameId: string) => capture(Number(teamId), Number(gameId)));
  when(/^the client reads Team (\d+)'s active lineup$/, async (teamId: string) => capture(Number(teamId)));
  when(/^Team (\d+)'s active lineup is edited after the snapshot$/, async (teamId: string) => {
    const active = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } }).then((row: any) => row.dataValues);
    const starter = await db.models.LineupEntry.findOne({ where: { lineupId: active.id, battingOrder: 1 } });
    const newPlayer = await createPlayer(Number(teamId), 1, 99);
    await starter!.update({ playerId: newPlayer.id });
  });
  then('the per-game lineup equals the active lineup at snapshot time', () => expect(response?.body).toEqual(activeAtSnapshot));
  then('the active lineup is returned', () => expect(response?.body).toEqual(activeAtSnapshot));
  then(/^the existing per-game lineup for Game (\d+) is unchanged$/, async (gameId: string) => {
    const lineup = await db.models.Lineup.findOne({ where: { teamId: 10, gameId: Number(gameId) } }).then((row: any) => row.dataValues);
    const entries = await db.models.LineupEntry.findAll({ where: { lineupId: lineup.id } }).then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
    expect(lineup.id).toBe(existingLineup?.id);
    expect(entries.map(({ lineupId, playerId, role, battingOrder, fieldingPosition }: any) => ({ lineupId, playerId, role, battingOrder, fieldingPosition }))).toEqual(existingLineup?.entries);
  });
  then('the game lineup response indicates the lineup was not found', () => expect(response?.statusCode).toBe(404));
  // @spec LREAD-005
  then(/^no per-game lineup exists for Team (\d+) and Game (\d+)$/, async (teamId: string, gameId: string) => {
    await expect(db.models.Lineup.count({ where: { teamId: Number(teamId), gameId: Number(gameId) } })).resolves.toBe(0);
  });
  then('the snapshot response indicates the Game was not found', async () => {
    expect(snapshotResponse?.statusCode).toBe(404);
    await expect(db.models.Lineup.count({ where: { teamId: 10, gameId: 44 } })).resolves.toBe(0);
  });
  // @spec LEDIT-008
  then('the snapshot response is rejected with 422', () => expect(snapshotResponse?.statusCode).toBe(422));
  // @spec LEDIT-008
  then(/^no per-game lineup exists for Game (\d+)$/, async (gameId: string) => {
    await expect(db.models.Lineup.count({ where: { teamId: 10, gameId: Number(gameId) } })).resolves.toBe(0);
    await expect(db.models.LineupEntry.count()).resolves.toBe(11);
  });
}]);
