// @spec CUP-001..CUP-008 (knockout round-advancement acceptance)
//
// Coverage for round-advancement, tiebreak resolution, seeding, and champion recording.
//
// Two complementary strategies keep the suite deterministic despite `source-map-support`
// calling `Math.random` (quicksort) during Sequelize SQLite queries — which makes a plain
// finite-queue mock unreliable:
//   • Integration scenarios drive the shared completion path (`GameFactory.simulate()` single
//     and `simulateBatch()` batch) with `mockHomeWins`, which routes only the scoring draws
//     originating in `game.ts` (every other call is left alone). This proves the advancement
//     hook actually fires from both completion paths.
//   • Detail scenarios (tiebreaks, seeding) set game results directly and invoke
//     `advanceKnockoutRound` directly for full score/pairing control.

import { LeagueType, TeamConfig } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, GameFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';
import { advanceKnockoutRound } from '../../../src/db/domain/knockout-advancement';
import * as knockout from '../../../src/db/domain/knockout';

const ONE_LEG_FIXED = { structure: 'KNOCKOUT' as const, legs: 'ONE_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const };
const ONE_LEG_REDRAW = { structure: 'KNOCKOUT' as const, legs: 'ONE_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'REDRAW' as const };
const TWO_LEG_AGGREGATE = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'AGGREGATE_SCORE' as const };
const TWO_LEG_OVERTIME = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'OVERTIME' as const };
const TWO_LEG_ANOTHER_GAME = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'ANOTHER_GAME_W_OVERTIME' as const };

interface Bracket { gw: any; teams: any[]; divId: number; year: number; leagueId: number; }

const setupBracket = async (teamCount: number, format: any): Promise<Bracket> => {
  const gw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
  const teamConfigs: TeamConfig[] = [...Array(teamCount).keys()].map((i) => ({ name: `KO Team ${i}` }));
  const teams = await Promise.all(teamConfigs.map((cfg) => TeamFactory().create(gw.id, cfg)));
  const league = await LeagueFactory().create(gw.id, {
    name: `${format.seeding ?? 'FIXED'} Cup`,
    type: LeagueType.LeagueCup,
    divisions: [{ name: 'Knockout', defaultTeams: [...Array(teamCount).keys()], format }],
  }, teams.map(({ id }) => id));
  const divId = await db.models.League.findByPk(league.id, { include: db.models.Division })
    .then((l) => { if (!l) throw Error(); return l.dataValues.Divisions[0].id; });
  const currentYear = gw.year;
  await DivisionFactory(divId).newSeason(currentYear);
  return { gw, teams, divId, year: currentYear + 1, leagueId: league.id };
};

const getGames = async (divId: number, year: number) => {
  const seasons = await db.models.DivisionSeason.findAll({
    where: { divisionId: divId, year },
    include: [{ model: db.models.Game, through: { attributes: [] } }],
  });
  const seen = new Set<number>();
  return seasons
    .flatMap((ds) => (ds.dataValues.Games ?? []) as any[])
    .filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
};

const gamesInRound = async (divId: number, year: number, round: number) =>
  (await getGames(divId, year)).filter((g) => g.round === round);

const getChampion = async (divId: number, year: number) => {
  const row = await db.models.SeasonResult.findOne({ where: { divisionId: divId, year } });
  return row ? row.dataValues : null;
};

// Recompute the aggregate-run leader across a set of legs (asserts the recorded champion is
// the on-field winner after tiebreak resolution).
const aggregateLeader = (games: any[]): number => {
  const agg = new Map<number, number>();
  for (const g of games) {
    agg.set(g.homeTeam, (agg.get(g.homeTeam) ?? 0) + (g.homeTeamResult ?? 0));
    agg.set(g.awayTeam, (agg.get(g.awayTeam) ?? 0) + (g.awayTeamResult ?? 0));
  }
  const teams = [...agg.keys()];
  return (agg.get(teams[0]) ?? 0) >= (agg.get(teams[1]) ?? 0) ? teams[0] : teams[1];
};

// Completes every still-unplayed, non-bye game in a round with results from `scoreFn`.
const completeRoundGames = async (
  divId: number, year: number, round: number,
  scoreFn: (homeTeam: number, awayTeam: number) => [number, number],
) => {
  const games = (await gamesInRound(divId, year, round))
    .filter((g) => g.awayTeam !== null && g.status !== 'COMPLETED');
  for (const g of games) {
    const [hr, ar] = scoreFn(g.homeTeam, g.awayTeam);
    await db.models.Game.update(
      { homeTeamResult: hr, awayTeamResult: ar, status: 'COMPLETED' },
      { where: { id: g.id } },
    );
  }
};

// Makes every simulated game decisive. `simulate()` / `simulateBatch()` draw home then away
// scores on two ADJACENT `Math.random()` calls (no DB call between them), so a repeating
// [winScore, 0] cycle always lands the pair on (winScore, 0) or (0, winScore) — a strict
// win, never a draw — regardless of source-map-support's own Math.random noise. The winner
// (home vs away) is non-deterministic, so callers assert against the computed result.
const mockDecisiveGames = (winScore = 5) => {
  let i = 0;
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    const v = i % 2 === 0 ? winScore / 10 : 0;
    i += 1;
    return v;
  });
};

// Winner (teamId) of the final game in a bracket, computed from the actual (decisive) result.
const finalWinner = async (divId: number, year: number): Promise<number> => {
  const games = await getGames(divId, year);
  const maxRound = Math.max(...games.map((g) => g.round));
  const final = games.find((g) => g.round === maxRound && g.awayTeam !== null)!;
  return (final.homeTeamResult ?? 0) > (final.awayTeamResult ?? 0) ? final.homeTeam : final.awayTeam;
};

// Simulate every pending game in a round (lowest id first) via the single-game path.
const simulateRoundSingle = async (divId: number, year: number, round: number) => {
  const pending = (await gamesInRound(divId, year, round))
    .filter((g) => g.status !== 'COMPLETED')
    .sort((a, b) => a.id - b.id);
  for (const g of pending) {
    await GameFactory(g.id).simulate();
  }
};

describe('Knockout round-advancement (CUP-001..008)', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  afterEach(() => { jest.restoreAllMocks(); });

  // ── Completion-path integration (single + batch) ─────────────────────────────────

  // @spec CUP-001 @spec CUP-002
  it('@spec CUP-001 @spec CUP-002 advances rounds and records a champion via single-game simulate', async () => {
    // 4-team ONE_LEG FIXED: every simulated game is decisive (winner computed from results).
    const { divId, year } = await setupBracket(4, ONE_LEG_FIXED);
    mockDecisiveGames();

    await simulateRoundSingle(divId, year, 1); // 2 semifinals → generates the final
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);

    await simulateRoundSingle(divId, year, 2); // the final → champion
    expect((await getChampion(divId, year))?.championTeamId).toBe(await finalWinner(divId, year));
  });

  // @spec CUP-001 @spec CUP-002
  it('@spec CUP-001 @spec CUP-002 advances rounds and records a champion via batch simulate', async () => {
    const { gw, divId, year } = await setupBracket(4, ONE_LEG_FIXED);
    mockDecisiveGames();

    await GameFactory().simulateBatch(gw.id, '2030-01-01'); // round 1 → generates the final
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);

    await GameFactory().simulateBatch(gw.id, '2030-01-01'); // the final → champion
    expect((await getChampion(divId, year))?.championTeamId).toBe(await finalWinner(divId, year));
  });

  // @spec CUP-001
  it('@spec CUP-001 round-advancement only fires once per round when multiple games complete in one batch', async () => {
    const { gw, divId, year } = await setupBracket(4, ONE_LEG_FIXED);
    mockDecisiveGames();

    await GameFactory().simulateBatch(gw.id, '2030-01-01'); // both semifinals in one batch

    expect((await gamesInRound(divId, year, 2))).toHaveLength(1); // exactly one final
    expect((await gamesInRound(divId, year, 3))).toHaveLength(0);
  });

  // ── Bye advancement (CUP-003) ────────────────────────────────────────────────────

  // @spec CUP-003
  it('@spec CUP-003 advances a bye team into the next round without simulating it', async () => {
    // 3-team FIXED: round 1 = 1 bye (top seed teams[0]) + 1 tie (teams[1] vs teams[2]).
    const { divId, year, teams } = await setupBracket(3, ONE_LEG_FIXED);
    // The tie's home team (teams[1]) wins.
    await completeRoundGames(divId, year, 1, () => [3, 0]);
    await advanceKnockoutRound(divId, year, 1);

    const round2 = await gamesInRound(divId, year, 2);
    expect(round2).toHaveLength(1);
    expect([round2[0].homeTeam, round2[0].awayTeam].sort((a, b) => a - b))
      .toEqual([teams[0].id, teams[1].id].sort((a, b) => a - b));

    // The bye row was never simulated: already COMPLETED at creation with a home result only.
    const byeRow = (await gamesInRound(divId, year, 1))
      .find((g) => g.awayTeam === null && g.homeTeam === teams[0].id);
    expect(byeRow.status).toBe('COMPLETED');
    expect(byeRow.homeTeamResult).not.toBeNull();
    expect(byeRow.awayTeamResult).toBeNull();
  });

  // ── Tiebreak modes (CUP-004 / CUP-005 / CUP-006) ─────────────────────────────────

  // @spec CUP-004
  it('@spec CUP-004 leaves an AGGREGATE_SCORE tie unresolved when level on aggregate (no error, no fallback)', async () => {
    // 2-team TWO_LEG: both legs home-win 3-0 → aggregate 3-3 level.
    const { divId, year } = await setupBracket(2, TWO_LEG_AGGREGATE);
    await completeRoundGames(divId, year, 1, () => [3, 0]);

    await expect(advanceKnockoutRound(divId, year, 1)).resolves.toBeUndefined();

    expect(await getChampion(divId, year)).toBeNull();
    expect((await gamesInRound(divId, year, 2))).toHaveLength(0);
    // No overtime overwrite / tiebreaker game: legs stay as completed.
    const legs = (await gamesInRound(divId, year, 1)).filter((g) => g.awayTeam !== null);
    expect(legs).toHaveLength(2);
    legs.forEach((g) => expect(g.homeTeamResult).toBe(3));
  });

  // @spec CUP-005
  it('@spec CUP-005 resolves a level TWO_LEG tie with OVERTIME by making the last leg decisive', async () => {
    const { divId, year } = await setupBracket(2, TWO_LEG_OVERTIME);
    await completeRoundGames(divId, year, 1, () => [3, 0]); // aggregate 3-3 → overtime
    jest.spyOn(Math, 'random').mockReturnValue(0.99);      // deterministic overtime winner

    await advanceKnockoutRound(divId, year, 1);

    const legs = (await gamesInRound(divId, year, 1))
      .filter((g) => g.awayTeam !== null)
      .sort((a, b) => a.id - b.id);
    const lastLeg = legs[legs.length - 1];
    expect(lastLeg.homeTeamResult).not.toBe(lastLeg.awayTeamResult); // decisive, non-draw
    expect(legs).toHaveLength(2); // OVERTIME edits in place — no extra game

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    expect(champion.championTeamId).toBe(aggregateLeader(legs)); // aggregate winner
  });

  // @spec CUP-006
  it('@spec CUP-006 resolves a level TWO_LEG tie with ANOTHER_GAME_W_OVERTIME via a new decisive tiebreaker game', async () => {
    const { divId, year, teams } = await setupBracket(2, TWO_LEG_ANOTHER_GAME);
    await completeRoundGames(divId, year, 1, () => [3, 0]); // aggregate 3-3 → tiebreaker
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    await advanceKnockoutRound(divId, year, 1);

    const played = (await gamesInRound(divId, year, 1)).filter((g) => g.awayTeam !== null);
    expect(played.length).toBe(3); // 2 original legs + 1 decisive tiebreaker sharing round 1
    const tiebreaker = [...played].sort((a, b) => a.id - b.id)[2];
    expect(tiebreaker.homeTeamResult).not.toBe(tiebreaker.awayTeamResult);
    expect([tiebreaker.homeTeam, tiebreaker.awayTeam].sort((a, b) => a - b))
      .toEqual([teams[0].id, teams[1].id].sort((a, b) => a - b));

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    expect(champion.championTeamId).toBe(aggregateLeader(played));
  });

  // ── Seeding (CUP-007 / CUP-008) ──────────────────────────────────────────────────

  // @spec CUP-008
  it('@spec CUP-008 FIXED pairs winners in bracket order every round (no shuffle)', async () => {
    const { divId, year, teams } = await setupBracket(4, ONE_LEG_FIXED);
    const shuffleSpy = jest.spyOn(knockout, 'shuffleTeams');
    await completeRoundGames(divId, year, 1, () => [5, 0]); // home wins → t0, t2 advance
    const callsBefore = shuffleSpy.mock.calls.length;

    await advanceKnockoutRound(divId, year, 1);

    expect(shuffleSpy.mock.calls.length).toBe(callsBefore); // FIXED never shuffles
    const round2 = await gamesInRound(divId, year, 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].homeTeam).toBe(teams[0].id); // bracket order: lower slot is home
    expect(round2[0].awayTeam).toBe(teams[2].id);
  });

  // @spec CUP-007
  it('@spec CUP-007 REDRAW re-shuffles winner pairings each round without changing round sizes', async () => {
    const { divId, year } = await setupBracket(4, ONE_LEG_REDRAW);
    const shuffleSpy = jest.spyOn(knockout, 'shuffleTeams'); // pass-through; counts calls
    await completeRoundGames(divId, year, 1, () => [5, 0]); // home wins each → 2 winners
    const callsBefore = shuffleSpy.mock.calls.length;

    await advanceKnockoutRound(divId, year, 1);

    // REDRAW re-shuffles winners before pairing the next round.
    expect(shuffleSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    // Round sizes stay fixed by the power-of-2 reduction (2 semifinals → 1 final).
    expect((await gamesInRound(divId, year, 1)).filter((g) => g.awayTeam !== null)).toHaveLength(2);
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);
  });

  // ── SeasonResult write (CUP-002) idempotency ────────────────────────────────────

  // @spec CUP-002
  it('@spec CUP-002 records the champion in a single SeasonResult row and never overwrites it', async () => {
    const { divId, year, teams } = await setupBracket(2, ONE_LEG_FIXED);
    await completeRoundGames(divId, year, 1, () => [5, 0]); // home wins → champion
    await advanceKnockoutRound(divId, year, 1);

    expect(await getChampion(divId, year)).not.toBeNull();
    const champion = await getChampion(divId, year);
    expect(champion.championTeamId).toBe(teams[0].id);

    // A defensive re-advance must not create a second row or flip the champion.
    await advanceKnockoutRound(divId, year, 1);
    const rows = await db.models.SeasonResult.findAll({ where: { divisionId: divId, year } });
    expect(rows).toHaveLength(1);
    expect(rows[0].dataValues.championTeamId).toBe(teams[0].id);
  });
});
