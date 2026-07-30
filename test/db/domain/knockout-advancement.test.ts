// @spec CUP-001..CUP-008 (knockout round-advancement acceptance)
//
// Black-box coverage for round-advancement, tiebreak resolution, seeding, and champion
// recording. Every scenario drives the behavior through the shared game-completion path
// (`GameFactory.simulate()` single + `simulateBatch()` batch) — the same hook point the
// production code wires round-advancement into. Scores are made deterministic by sequencing
// `Math.random` so each simulated leg produces a known result.

import { LeagueType, TeamConfig } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, GameFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';

const ONE_LEG_FIXED = { structure: 'KNOCKOUT' as const, legs: 'ONE_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const };
const ONE_LEG_REDRAW = { structure: 'KNOCKOUT' as const, legs: 'ONE_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'REDRAW' as const };
const TWO_LEG_AGGREGATE = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'AGGREGATE_SCORE' as const };
const TWO_LEG_OVERTIME = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'OVERTIME' as const };
const TWO_LEG_ANOTHER_GAME = { structure: 'KNOCKOUT' as const, legs: 'TWO_LEG' as const, seriesLength: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'ANOTHER_GAME_W_OVERTIME' as const };

interface Bracket {
  gw: any;
  teams: any[];
  divId: number;
  year: number;
  leagueId: number;
}

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

const pendingInRound = async (divId: number, year: number, round: number) =>
  (await gamesInRound(divId, year, round)).filter((g) => g.status !== 'COMPLETED');

const getChampion = async (divId: number, year: number) => {
  const row = await db.models.SeasonResult.findOne({ where: { divisionId: divId, year } });
  return row ? row.dataValues : null;
};

// Sequences `Math.random` through `values`, then returns `fallback` for any extra calls
// (e.g. advancement-internal randomness such as overtime winner / redraw shuffle).
const mockRandomSequence = (values: number[], fallback = 0.99) => {
  let i = 0;
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    const v = i < values.length ? values[i] : fallback;
    i += 1;
    return v;
  });
};

// Each simulated leg consumes two random draws (home, away). To produce a decisive
// "home wins N-0" leg, feed [N/10, 0] for that leg.
const homeWinLeg = (runs: number): [number, number] => [runs / 10, 0];

// Recompute the aggregate-run leader across a set of legs (used to assert the recorded
// champion really is the on-field winner after tiebreak resolution).
const aggregateLeader = (games: any[]): number => {
  const agg = new Map<number, number>();
  for (const g of games) {
    agg.set(g.homeTeam, (agg.get(g.homeTeam) ?? 0) + (g.homeTeamResult ?? 0));
    agg.set(g.awayTeam, (agg.get(g.awayTeam) ?? 0) + (g.awayTeamResult ?? 0));
  }
  const teams = [...agg.keys()];
  return (agg.get(teams[0]) ?? 0) >= (agg.get(teams[1]) ?? 0) ? teams[0] : teams[1];
};

// Simulate every pending game in a round, lowest id first, via the single-game path.
const simulateRoundSingle = async (divId: number, year: number, round: number) => {
  const pending = (await pendingInRound(divId, year, round)).sort((a, b) => a.id - b.id);
  for (const g of pending) {
    await GameFactory(g.id).simulate();
  }
};

describe('Knockout round-advancement (CUP-001..008)', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // @spec CUP-001 @spec CUP-002
  it('@spec CUP-001 @spec CUP-002 advances rounds and records a champion via single-game simulate', async () => {
    // 4-team ONE_LEG FIXED bracket: round 1 = 2 semifinals, round 2 = 1 final.
    // FIXED seeding makes zero Math.random calls during generation, so the queue only
    // feeds the three simulated games (home wins each): t0 and t2 reach the final, t0 wins.
    const { divId, year, teams } = await setupBracket(4, ONE_LEG_FIXED);
    const spy = mockRandomSequence([
      ...homeWinLeg(5), ...homeWinLeg(5), ...homeWinLeg(5),
    ]);

    await simulateRoundSingle(divId, year, 1); // both semifinals → generates the final
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);

    await simulateRoundSingle(divId, year, 2); // the final → champion
    spy.mockRestore();

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    expect(champion.championTeamId).toBe(teams[0].id);
  });

  // @spec CUP-001 @spec CUP-002
  it('@spec CUP-001 @spec CUP-002 advances rounds and records a champion via batch simulate', async () => {
    const { gw, divId, year, teams } = await setupBracket(4, ONE_LEG_FIXED);
    mockRandomSequence([
      ...homeWinLeg(5), ...homeWinLeg(5), ...homeWinLeg(5),
    ]);

    // First batch: round 1 (2 games) → advancement generates the final.
    await GameFactory().simulateBatch(gw.id, '2030-01-01');
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);

    // Second batch: the final → champion.
    await GameFactory().simulateBatch(gw.id, '2030-01-01');

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    expect(champion.championTeamId).toBe(teams[0].id);
  });

  // @spec CUP-001
  it('@spec CUP-001 round-advancement only fires once per round when multiple games complete in one batch', async () => {
    const { gw, divId, year } = await setupBracket(4, ONE_LEG_FIXED);
    mockRandomSequence([...homeWinLeg(5), ...homeWinLeg(5)]);

    await GameFactory().simulateBatch(gw.id, '2030-01-01');

    // Both semifinals completed in one batch → exactly one final generated (not two).
    expect((await gamesInRound(divId, year, 2))).toHaveLength(1);
    expect((await gamesInRound(divId, year, 3))).toHaveLength(0);
  });

  // @spec CUP-003
  it('@spec CUP-003 advances a bye team into the next round without simulating it', async () => {
    // 3-team FIXED: round 1 = 1 bye (top seed teams[0]) + 1 tie (teams[1] vs teams[2]).
    const { divId, year, teams } = await setupBracket(3, ONE_LEG_FIXED);
    mockRandomSequence([...homeWinLeg(5)]); // the single tie, home (teams[1]) wins

    await simulateRoundSingle(divId, year, 1);

    const round2 = await gamesInRound(divId, year, 2);
    expect(round2).toHaveLength(1);
    // Bye team (lowest bracketSlot) paired with the tie winner, bye team is home in bracket order.
    expect([round2[0].homeTeam, round2[0].awayTeam].sort((a, b) => a - b))
      .toEqual([teams[0].id, teams[1].id].sort((a, b) => a - b));
    // The bye team was never simulated: still only its created-bye game exists for it in round 1.
    const byeRound1 = (await gamesInRound(divId, year, 1))
      .filter((g) => g.awayTeam === null && g.homeTeam === teams[0].id);
    expect(byeRound1).toHaveLength(1);
    expect(byeRound1[0].status).toBe('COMPLETED');
  });

  // @spec CUP-004
  it('@spec CUP-004 leaves an AGGREGATE_SCORE tie unresolved when level on aggregate (no error, no fallback)', async () => {
    // 2-team TWO_LEG: both legs home-win 3-0 → aggregate 3-3 level.
    const { divId, year } = await setupBracket(2, TWO_LEG_AGGREGATE);
    mockRandomSequence([...homeWinLeg(3), ...homeWinLeg(3)]);

    await expect(simulateRoundSingle(divId, year, 1)).resolves.toBeUndefined();

    expect(await getChampion(divId, year)).toBeNull();
    expect((await gamesInRound(divId, year, 2))).toHaveLength(0);
    // Both legs remain as-simulated (no overtime overwrite, no tiebreaker game).
    const round1 = await gamesInRound(divId, year, 1);
    expect(round1.filter((g) => g.awayTeam !== null)).toHaveLength(2);
    round1.forEach((g) => expect(g.homeTeamResult).toBe(3));
  });

  // @spec CUP-005
  it('@spec CUP-005 resolves a level TWO_LEG tie with OVERTIME by making the last leg decisive', async () => {
    const { divId, year, teams } = await setupBracket(2, TWO_LEG_OVERTIME);
    // Both legs 3-0 home → aggregate level → overtime fires (fallback 0.99 picks the away team of the last leg).
    mockRandomSequence([...homeWinLeg(3), ...homeWinLeg(3)], 0.99);

    await simulateRoundSingle(divId, year, 1);

    const legs = (await gamesInRound(divId, year, 1))
      .filter((g) => g.awayTeam !== null)
      .sort((a, b) => a.id - b.id);
    const lastLeg = legs[legs.length - 1];
    // Last leg overwritten to a decisive, non-draw score.
    expect(lastLeg.homeTeamResult).not.toBe(lastLeg.awayTeamResult);

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    // Champion is the on-field aggregate leader once overtime has broken the tie.
    expect(champion.championTeamId).toBe(aggregateLeader(legs));
    // No extra tiebreaker game created (OVERTIME edits in place).
    expect(legs).toHaveLength(2);
  });

  // @spec CUP-006
  it('@spec CUP-006 resolves a level TWO_LEG tie with ANOTHER_GAME_W_OVERTIME via a new decisive tiebreaker game', async () => {
    const { divId, year, teams } = await setupBracket(2, TWO_LEG_ANOTHER_GAME);
    mockRandomSequence([...homeWinLeg(3), ...homeWinLeg(3)], 0.99);

    await simulateRoundSingle(divId, year, 1);

    const round1 = await gamesInRound(divId, year, 1);
    const played = round1.filter((g) => g.awayTeam !== null);
    // A third, decisive tiebreaker game shares round 1 (2 original legs + 1 tiebreaker).
    expect(played.length).toBe(3);
    const tiebreaker = played
      .sort((a, b) => a.id - b.id)
      .pop()!;
    expect(tiebreaker.homeTeamResult).not.toBe(tiebreaker.awayTeamResult);
    expect([tiebreaker.homeTeam, tiebreaker.awayTeam].sort((a, b) => a - b))
      .toEqual([teams[0].id, teams[1].id].sort((a, b) => a - b));

    const champion = await getChampion(divId, year);
    expect(champion).not.toBeNull();
    // Champion is the on-field aggregate leader once the decisive tiebreaker is counted.
    expect(champion.championTeamId).toBe(aggregateLeader(played));
  });

  // @spec CUP-008
  it('@spec CUP-008 FIXED pairs winners in bracket order with no shuffle', async () => {
    // 4-team FIXED: round 1 [t0,t1],[t2,t3], home wins → t0,t2 advance.
    // Bracket order pairs them [t0,t2] for the final (t0 home, lower bracketSlot).
    const { divId, year, teams } = await setupBracket(4, ONE_LEG_FIXED);
    mockRandomSequence([...homeWinLeg(5), ...homeWinLeg(5)]);

    await simulateRoundSingle(divId, year, 1);

    const round2 = await gamesInRound(divId, year, 2);
    expect(round2).toHaveLength(1);
    expect(round2[0].homeTeam).toBe(teams[0].id);
    expect(round2[0].awayTeam).toBe(teams[2].id);
  });

  // @spec CUP-007
  it('@spec CUP-007 REDRAW re-shuffles winner pairings each round without changing round sizes', async () => {
    // 4-team REDRAW. Math.random sequence (FIXED-like identity shuffle for round 1 keeps
    // pairings predictable; decisive home wins; then the round-2 shuffle reads 0.0 which
    // reverses the two winners so the final pairing is flipped vs. bracket order):
    //   round-1 shuffleTeams(4) -> 3 draws of 0.9 (identity)
    //   simulate 2 legs          -> [0.5,0.0] x2 (home wins -> t0, t2 advance)
    //   round-2 shuffleTeams(2)  -> 1 draw of 0.0 (reverses [t0,t2] -> [t2,t0])
    const { divId, year, teams } = await setupBracket(4, ONE_LEG_REDRAW);
    mockRandomSequence([0.9, 0.9, 0.9, ...homeWinLeg(5), ...homeWinLeg(5), 0.0]);

    await simulateRoundSingle(divId, year, 1);

    const round1 = await gamesInRound(divId, year, 1);
    const round2 = await gamesInRound(divId, year, 2);
    // Round sizes fixed by the power-of-2 reduction (2 semifinals, 1 final).
    expect(round1.filter((g) => g.awayTeam !== null)).toHaveLength(2);
    expect(round2).toHaveLength(1);
    // REDRAW reshuffled the final away from bracket order: home is t2, not t0.
    expect(round2[0].homeTeam).toBe(teams[2].id);
    expect(round2[0].awayTeam).toBe(teams[0].id);
  });

});
