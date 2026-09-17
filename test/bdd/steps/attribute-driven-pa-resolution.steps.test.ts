// @spec PARP-002,PARP-004,PARP-005,PARP-006,PARP-007,PARP-008,PARP-009,PARP-010,PARP-011,
// PARP-012,PARP-013,PARP-014,PARP-015,PARP-016,PARP-017,PARP-018
// (attribute-driven-pa-resolution acceptance — PARP-001/PARP-003 are unit-level only, see
// docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md)
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import * as identity from '../../../src/db/domain/identity';
import {
  AttributeDrivenSimulationEngine,
  advanceRunners,
  resolvePA,
  projectPlayerGameStats,
  persistPlayerGameStats,
  BaseState,
  RunnerTransition,
  PAOutcome,
  SyntheticLineup,
  SyntheticLineupEntry,
  EventEnvelope,
  PlateAppearanceResolutionContext,
  BaserunningContext,
  PlayerGameStatsProjection,
} from '../../../src/db/domain';
import { PlayerAttributes } from '../../../src/api/models';

const feature = loadFeature(path.resolve(__dirname, '../features/attribute-driven-pa-resolution.feature'));

const neutralAttributes = (): PlayerAttributes => ({
  contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
  positions: {} as any, pitches: [],
});

let nextPlayerId = 1;
const freshPlayerId = () => nextPlayerId++;

const buildLineup = (teamId: number): SyntheticLineup => {
  const pitcherId = freshPlayerId();
  const battingOrder: SyntheticLineupEntry[] = [
    { playerId: pitcherId, battingOrder: 9, fieldingPosition: 'Pitcher' as const, attributes: neutralAttributes() },
    ...Array.from({ length: 8 }, (_, i) => ({
      playerId: freshPlayerId(), battingOrder: i + 1, fieldingPosition: null, attributes: neutralAttributes(),
    })),
  ].sort((a, b) => a.battingOrder - b.battingOrder);
  return { teamId, battingOrder, startingPitcherId: pitcherId };
};

// @spec PARP-018 — persisting a projection requires real Player rows: PlayerGameStats.playerId
// is FK-enforced (unlike buildLineup's plain synthetic ids, fine for the pure-engine scenarios).
const createPlayer = async (teamId: number, gameWorldId: number, index: number) => (
  db.models.Player.create({
    teamId, gameWorldId, givenName: `Player${teamId}-${index}`, familyName: 'PA', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
    attributes: { positions: {}, pitches: [] },
  }).then(({ dataValues }: any) => dataValues)
);

const buildPersistedLineup = async (teamId: number, gameWorldId: number): Promise<SyntheticLineup> => {
  const players = await Promise.all(Array.from({ length: 9 }, (_, i) => createPlayer(teamId, gameWorldId, i + 1)));
  const battingOrder: SyntheticLineupEntry[] = players.map((player, i) => ({
    playerId: player.id, battingOrder: i + 1, fieldingPosition: i === 8 ? 'Pitcher' as const : null, attributes: neutralAttributes(),
  }));
  return { teamId, battingOrder, startingPitcherId: players[8].id };
};

const createGameFixture = async (): Promise<{ gameId: number; home: SyntheticLineup; away: SyntheticLineup }> => {
  const gameWorld = await db.models.GameWorld.create({ year: 2025, config: {} }).then(({ dataValues }: any) => dataValues);
  const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }: any) => dataValues);
  const homeTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  const awayTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  const game = await db.models.Game.create({ homeTeam: homeTeam.id, awayTeam: awayTeam.id, status: 'SCHEDULED' }).then(({ dataValues }: any) => dataValues);
  const home = await buildPersistedLineup(homeTeam.id, gameWorld.id);
  const away = await buildPersistedLineup(awayTeam.id, gameWorld.id);
  return { gameId: game.id, home, away };
};

// ─── shared scenario state ──────────────────────────────────────────────────
let batter: PlayerAttributes;
let pitcher: PlayerAttributes;
let batterId: number;
let pitcherId: number;
let bases: BaseState;
let outcome: PAOutcome;
let transitions: RunnerTransition[];
let paEvent: EventEnvelope<PlateAppearanceResolutionContext>;
let baserunningEvents: EventEnvelope<BaserunningContext>[];

let gameFixture: { gameId: number; home: SyntheticLineup; away: SyntheticLineup };
let engineResult: ReturnType<AttributeDrivenSimulationEngine['simulateGame']>;
let secondEngineResult: ReturnType<AttributeDrivenSimulationEngine['simulateGame']>;
let reprojected: PlayerGameStatsProjection[];
let rngCallCount: number;
let thrownError: unknown;
let persistError: unknown;

const buildContext = (fixture: { gameId: number; home: SyntheticLineup; away: SyntheticLineup }) => ({
  gameId: fixture.gameId,
  homeTeam: fixture.home.teamId,
  awayTeam: fixture.away.teamId,
  lineups: { home: fixture.home, away: fixture.away },
  matchRules: { dhEnabled: false, benchSize: 5, bullpenSize: 7, innings: 9 },
});

beforeEach(async () => {
  await db.sync({ force: true });
  nextPlayerId = 1;
  batter = neutralAttributes();
  pitcher = neutralAttributes();
  batterId = 100;
  pitcherId = 200;
  bases = { first: null, second: null, third: null };
  transitions = [];
  rngCallCount = 0;
  thrownError = undefined;
  persistError = undefined;
});

afterEach(() => jest.restoreAllMocks());

// executes a single plate appearance (resolvePA + advanceRunners), also constructing the
// PA + BaserunningEvent envelopes exactly as AttributeDrivenSimulationEngine does, so
// low-level scenarios exercise the same wiring the full engine uses.
const runPlateAppearance = (forcedOutcome?: PAOutcome) => {
  outcome = forcedOutcome ?? resolvePA({ batter, pitcher, rng: () => 0.5 });
  paEvent = {
    type: 'PlateAppearanceResolutionEvent', gameId: 1, sequence: 1, causedByEventId: null,
    context: { batterId, pitcherId, battingTeamId: 1, outcome },
  };
  const { bases: nextBases, transitions: nextTransitions } = advanceRunners(bases, outcome, batterId);
  bases = nextBases;
  transitions = nextTransitions;
  baserunningEvents = transitions.map((t, i) => ({
    type: 'BaserunningEvent', gameId: 1, sequence: 2 + i, causedByEventId: paEvent.sequence,
    context: { runnerId: t.playerId, fromBase: t.from, toBase: t.to },
  }));
};

const transitionFor = (playerId: number) => transitions.find((t) => t.playerId === playerId);

autoBindSteps(feature, [({ given, when, then, and }: any) => {
  // ── Plate Appearance Resolution ──
  given('a batter and a pitcher with attributes', () => { /* neutral fixtures from beforeEach */ });
  when('the engine resolves a plate appearance with pinned seed 4242', () => {
    outcome = resolvePA({ batter, pitcher, rng: () => (4242 % 100) / 100 });
  });
  then('the outcome is one of out, 1B, 2B, 3B, HR, BB, SO', () => {
    expect(['out', '1B', '2B', '3B', 'HR', 'BB', 'SO']).toContain(outcome);
  });

  // ── Baserunner Advancement ──
  given('a batter at the plate with runners on first, second, and third', () => {
    bases = { first: 1, second: 2, third: 3 };
  });
  given('a batter at the plate with a runner on second and the other bases empty', () => {
    bases = { first: null, second: 2, third: null };
  });
  given('a batter at the plate with runners on second and third', () => {
    bases = { first: null, second: 2, third: 3 };
  });
  given('a batter at the plate with runners on first and second', () => {
    bases = { first: 1, second: 2, third: null };
  });
  given('a batter at the plate with runners on first and third', () => {
    bases = { first: 1, second: null, third: 3 };
  });
  given('a batter at the plate with a runner on second', () => {
    bases = { first: null, second: 2, third: null };
  });
  given('a batter at the plate with a runner on third', () => {
    bases = { first: null, second: null, third: 3 };
  });
  given('a batter at the plate with the bases empty', () => {
    bases = { first: null, second: null, third: null };
  });

  when(/^the plate appearance resolves to "(.+)"$/, (forced: string) => {
    runPlateAppearance(forced as PAOutcome);
  });

  then('the runner on third scores', () => expect(transitionFor(3)?.to).toBe('home'));
  then('the runner on second advances to third', () => expect(transitionFor(2)?.to).toBe('third'));
  then('the runner on first advances to second', () => expect(transitionFor(1)?.to).toBe('second'));
  then('the runner on first advances to third', () => expect(transitionFor(1)?.to).toBe('third'));
  then('the runner on second remains on second', () => {
    expect(transitions.find((t) => t.playerId === 2)).toBeUndefined();
    expect(bases.second).toBe(2);
  });
  then('the runner on second scores', () => expect(transitionFor(2)?.to).toBe('home'));
  then('the runner on first scores', () => expect(transitionFor(1)?.to).toBe('home'));
  then('the batter is placed on first', () => expect(bases.first).toBe(batterId));
  then('the batter is placed on second', () => expect(bases.second).toBe(batterId));
  then('the batter scores', () => expect(transitionFor(batterId)?.to).toBe('home'));
  then('the bases are empty', () => expect(bases).toStrictEqual({ first: null, second: null, third: null }));

  then('two BaserunningEvent instances are emitted', () => expect(baserunningEvents.length).toBe(2));
  and("each BaserunningEvent's causedByEventId is the triggering PlateAppearanceResolutionEvent's sequence", () => {
    baserunningEvents.forEach((e) => expect(e.causedByEventId).toBe(paEvent.sequence));
  });

  // ── Inning & Game Structure ──
  given('a synthetic lineup of 9 batters', () => { gameFixture = { gameId: 1, home: buildLineup(1), away: buildLineup(2) }; });
  when('the engine resolves 10 consecutive plate appearances for that lineup with pinned seed 4242', () => {
    const lineup = gameFixture.home;
    const result = new AttributeDrivenSimulationEngine(4242).simulateGame({
      gameId: 1, homeTeam: lineup.teamId, awayTeam: gameFixture.away.teamId,
      lineups: { home: lineup, away: gameFixture.away },
      matchRules: { dhEnabled: false, benchSize: 5, bullpenSize: 7, innings: 20 },   // enough innings to guarantee ≥10 home PAs
    });
    engineResult = result;
  });
  then('the 10th plate appearance\'s batter is the same player as the 1st', () => {
    const homePAs = engineResult.eventChain!.filter(
      (e) => e.type === 'PlateAppearanceResolutionEvent' && (e.context as PlateAppearanceResolutionContext).battingTeamId === gameFixture.home.teamId,
    );
    expect(homePAs.length).toBeGreaterThanOrEqual(10);
    expect((homePAs[9].context as PlateAppearanceResolutionContext).batterId)
      .toBe((homePAs[0].context as PlateAppearanceResolutionContext).batterId);
  });

  given('a half-inning is simulated with pinned seed 4242', () => {
    gameFixture = { gameId: 1, home: buildLineup(1), away: buildLineup(2) };
    engineResult = new AttributeDrivenSimulationEngine(4242).simulateGame({
      gameId: 1, homeTeam: gameFixture.home.teamId, awayTeam: gameFixture.away.teamId,
      lineups: { home: gameFixture.home, away: gameFixture.away },
      matchRules: { dhEnabled: false, benchSize: 5, bullpenSize: 7, innings: 1 },
    });
  });
  then(/^the half-inning ends once three "out" or "SO" outcomes have occurred$/, () => {
    const firstHalfPAs = engineResult.eventChain!.filter(
      (e) => e.type === 'PlateAppearanceResolutionEvent' && (e.context as PlateAppearanceResolutionContext).battingTeamId === gameFixture.away.teamId,
    );
    const outCount = firstHalfPAs.filter((e) => ['out', 'SO'].includes((e.context as PlateAppearanceResolutionContext).outcome)).length;
    expect(outCount).toBe(3);
  });
  and('no further plate appearance occurs in that half-inning', () => {
    const firstHalfPAs = engineResult.eventChain!.filter(
      (e) => e.type === 'PlateAppearanceResolutionEvent' && (e.context as PlateAppearanceResolutionContext).battingTeamId === gameFixture.away.teamId,
    );
    const outsSoFar = (index: number) => firstHalfPAs.slice(0, index + 1)
      .filter((e) => ['out', 'SO'].includes((e.context as PlateAppearanceResolutionContext).outcome)).length;
    const thirdOutIndex = firstHalfPAs.findIndex((_, i) => outsSoFar(i) === 3);
    expect(thirdOutIndex).toBe(firstHalfPAs.length - 1);
  });

  given('a Game exists between a home team and an away team with matchRules innings 9', async () => {
    gameFixture = await createGameFixture();
  });
  when('the engine simulates the game with pinned seed 4242', () => {
    engineResult = new AttributeDrivenSimulationEngine(4242).simulateGame(buildContext(gameFixture));
  });
  then('exactly 18 half-innings are played', () => {
    // 9 innings × 2 halves; the away team's 9th half batted first each inning, so both teams'
    // outsRecorded-worth of half-innings occurred exactly 9 times each.
    const paByTeam = new Map<number, number>();
    engineResult.eventChain!.forEach((e) => {
      if (e.type !== 'PlateAppearanceResolutionEvent') return;
      const { battingTeamId, outcome: paOutcome } = e.context as PlateAppearanceResolutionContext;
      if (paOutcome === 'out' || paOutcome === 'SO') paByTeam.set(battingTeamId, (paByTeam.get(battingTeamId) ?? 0) + 1);
    });
    // Every half-inning ends at exactly 3 outs (PARP-009); 9 half-innings per team ⇒ 27 outs per team.
    expect(paByTeam.get(gameFixture.home.teamId)).toBe(27);
    expect(paByTeam.get(gameFixture.away.teamId)).toBe(27);
  });
  and('a tied final score is accepted as a valid result', () => {
    expect(typeof engineResult.homeTeamResult).toBe('number');
    expect(typeof engineResult.awayTeamResult).toBe('number');
    // No assertion that the score differs — a tie (homeTeamResult === awayTeamResult) is not rejected.
  });

  then("homeTeamResult equals the sum of R across the home team's projected PlayerGameStats rows", () => {
    const homeIds = new Set(gameFixture.home.battingOrder.map((e) => e.playerId));
    const sum = engineResult.playerGameStats!.filter((r) => homeIds.has(r.playerId)).reduce((s, r) => s + r.R, 0);
    expect(engineResult.homeTeamResult).toBe(sum);
  });
  and("awayTeamResult equals the sum of R across the away team's projected PlayerGameStats rows", () => {
    const awayIds = new Set(gameFixture.away.battingOrder.map((e) => e.playerId));
    const sum = engineResult.playerGameStats!.filter((r) => awayIds.has(r.playerId)).reduce((s, r) => s + r.R, 0);
    expect(engineResult.awayTeamResult).toBe(sum);
  });

  and('PlayerGameStats rows are projected a second time from the same returned event chain', () => {
    reprojected = projectPlayerGameStats(engineResult.eventChain! as any, { home: gameFixture.home, away: gameFixture.away });
  });
  then('the two projections are identical', () => {
    expect(reprojected).toStrictEqual(engineResult.playerGameStats);
  });

  then("the batter's projected RBI increases by 1", () => {
    const projection = projectPlayerGameStats([paEvent, ...baserunningEvents] as any, {
      home: { teamId: 1, battingOrder: [], startingPitcherId: pitcherId },
      away: { teamId: 2, battingOrder: [], startingPitcherId: pitcherId },
    });
    expect(projection.find((r) => r.playerId === batterId)?.RBI).toBe(1);
  });
  and("the batter's projected R increases by 1", () => {
    const projection = projectPlayerGameStats([paEvent, ...baserunningEvents] as any, {
      home: { teamId: 1, battingOrder: [], startingPitcherId: pitcherId },
      away: { teamId: 2, battingOrder: [], startingPitcherId: pitcherId },
    });
    expect(projection.find((r) => r.playerId === batterId)?.R).toBe(1);
  });

  then("every pitching stat recorded against the away team's batters is attributed to the home starting pitcher", () => {
    const awayIds = new Set(gameFixture.away.battingOrder.map((e) => e.playerId));
    const nonPitcherRows = engineResult.playerGameStats!.filter((r) => !awayIds.has(r.playerId) && r.playerId !== gameFixture.home.startingPitcherId);
    nonPitcherRows.forEach((r) => {
      expect(r.pitchingH + r.pitchingBB + r.pitchingSO + r.outsRecorded).toBe(0);
    });
  });
  and("the home starting pitcher's outsRecorded reflects every out recorded against the away team", () => {
    const homePitcherRow = engineResult.playerGameStats!.find((r) => r.playerId === gameFixture.home.startingPitcherId)!;
    const awayOuts = engineResult.eventChain!.filter(
      (e) => e.type === 'PlateAppearanceResolutionEvent'
        && (e.context as PlateAppearanceResolutionContext).battingTeamId === gameFixture.away.teamId
        && ['out', 'SO'].includes((e.context as PlateAppearanceResolutionContext).outcome),
    ).length;
    expect(homePitcherRow.outsRecorded).toBe(awayOuts);
  });
  and('no projected PlayerGameStats row sets IP', () => {
    engineResult.playerGameStats!.forEach((row) => expect((row as any).IP).toBeUndefined());
  });

  then('the number of RNG draws consumed equals the number of PlateAppearanceResolutionEvent instances in the returned event chain', () => {
    const realMulberry32 = identity.mulberry32;
    jest.spyOn(identity, 'mulberry32').mockImplementation((seed: number) => {
      const real = realMulberry32(seed);
      return () => { rngCallCount += 1; return real(); };
    });
    const result = new AttributeDrivenSimulationEngine(4242).simulateGame(buildContext(gameFixture));
    const paCount = result.eventChain!.filter((e) => e.type === 'PlateAppearanceResolutionEvent').length;
    expect(rngCallCount).toBe(paCount);
  });

  and('the engine simulates the same game again with pinned seed 4242', () => {
    secondEngineResult = new AttributeDrivenSimulationEngine(4242).simulateGame(buildContext(gameFixture));
  });
  then('the two event chains are identical', () => {
    expect(secondEngineResult.eventChain).toStrictEqual(engineResult.eventChain);
  });
  and('the two PlayerGameStats projections are identical', () => {
    expect(secondEngineResult.playerGameStats).toStrictEqual(engineResult.playerGameStats);
  });

  // ── Invalid Input ──
  given('a synthetic lineup with only 8 batting-order entries', () => {
    const lineup = buildLineup(1);
    lineup.battingOrder = lineup.battingOrder.slice(0, 8);
    gameFixture = { gameId: 1, home: lineup, away: buildLineup(2) };
  });
  given("a synthetic lineup whose startingPitcherId is not present among its batting order", () => {
    const lineup = buildLineup(1);
    lineup.startingPitcherId = 999999;
    gameFixture = { gameId: 1, home: lineup, away: buildLineup(2) };
  });
  when('the engine simulates a game with that lineup', () => {
    const realMulberry32 = identity.mulberry32;
    jest.spyOn(identity, 'mulberry32').mockImplementation((seed: number) => {
      const real = realMulberry32(seed);
      return () => { rngCallCount += 1; return real(); };
    });
    try {
      new AttributeDrivenSimulationEngine(4242).simulateGame(buildContext(gameFixture));
    } catch (error) { thrownError = error; }
  });
  then('a plain Error is thrown', () => {
    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError).not.toHaveProperty('statusCode');
  });
  and('no RNG state is consumed', () => expect(rngCallCount).toBe(0));

  // ── Persistence ──
  and('the engine has simulated the game and its PlayerGameStats rows have been persisted', async () => {
    engineResult = new AttributeDrivenSimulationEngine(4242).simulateGame(buildContext(gameFixture));
    await persistPlayerGameStats(engineResult.playerGameStats!);
  });
  when('the same PlayerGameStats rows are persisted again for that game', async () => {
    try { await persistPlayerGameStats(engineResult.playerGameStats!); } catch (error) { persistError = error; }
  });
  then('the write is rejected by the existing unique index on playerId and gameId', () => {
    expect(persistError).toBeDefined();
  });
}]);
