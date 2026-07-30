import { CompetitionFormat } from '../../api/models';
import db from '../client';
import { shuffleTeams } from './knockout';

// @spec CUP-001,CUP-002,CUP-003,CUP-004,CUP-005,CUP-006,CUP-007,CUP-008
//
// Knockout round-advancement, tiebreak resolution, and champion recording. Lives in its own
// module so the shared game-completion path (`game.ts`) can call into it without creating a
// circular import with `division.ts` (which imports `GameFactory`). See
// `docs/llds/knockout-bracket.md` (Round-advancement / Tiebreak modes / Implementation notes).

const MAX_SLOT = Number.MAX_SAFE_INTEGER;

interface Tie {
  bye: boolean;
  teams: number[];        // [teamId] for a bye, [teamA, teamB] for a played tie
  legs: any[];            // the Game rows that make up this tie
  minSlot: number;        // bracket-ordering key (min bracketSlot among participants)
}

/** Completion-path entry point: resolves the division/year/round of a completed game. */
// @spec CUP-001
export const resolveKnockoutGameCompletion = async (gameId: number): Promise<void> => {
  const game = await db.models.Game.findByPk(gameId);
  if (!game) return;
  const round = game.dataValues.round;
  if (round == null) return;

  const dsg = await db.models.DivisionSeasonGame.findOne({
    where: { gameId },
    include: [{ model: db.models.DivisionSeason }],
  });
  if (!dsg) return;

  const dsNode: any = dsg.dataValues.DivisionSeason;
  const ds = dsNode?.dataValues ?? dsNode;
  if (!ds) return;

  await advanceKnockoutRound(ds.divisionId, ds.year, round);
};

/**
 * Resolve a single knockout round if it is complete. Idempotent: no-ops when the season is
 * already decided, the next round is already generated, the round is incomplete, or the
 * division is not a knockout bracket.
 */
// @spec CUP-001,CUP-002,CUP-003,CUP-004,CUP-005,CUP-006,CUP-007,CUP-008
export const advanceKnockoutRound = async (
  divisionId: number,
  year: number,
  round: number,
): Promise<void> => {
  const division = await db.models.Division.findByPk(divisionId);
  if (!division) return;
  const config = division.dataValues.config ?? {};
  const format: CompetitionFormat | undefined = config.format;
  if (!format || format.structure !== 'KNOCKOUT') return;

  // Idempotency guard (e6): never re-decide a champion once recorded.
  const decided = await db.models.SeasonResult.findOne({ where: { divisionId, year } });
  if (decided && decided.dataValues.championTeamId != null) return;

  const divisionSeasons = await db.models.DivisionSeason.findAll({ where: { divisionId, year } });
  if (divisionSeasons.length === 0) return;
  const dsIds = divisionSeasons.map((ds: any) => ds.dataValues.id);

  const allDsgs = await db.models.DivisionSeasonGame.findAll({ where: { divisionSeasonId: dsIds } });
  const allGameIds = [...new Set<number>(allDsgs.map((dsg: any) => dsg.dataValues.gameId))];
  const allGames = await db.models.Game.findAll({ where: { id: allGameIds } });

  const roundGames = allGames.filter((g: any) => g.dataValues.round === round);
  if (roundGames.length === 0) return;

  // Idempotency guard: this round already advanced.
  const alreadyAdvanced = allGames.some((g: any) => g.dataValues.round === round + 1);
  if (alreadyAdvanced) return;

  // Round completeness: every game COMPLETED with a home result. Byes satisfy this trivially
  // (created COMPLETED with homeTeamResult set); unplayed ties do not.
  const incomplete = roundGames.some(
    (g: any) => g.dataValues.status !== 'COMPLETED' || g.dataValues.homeTeamResult == null,
  );
  if (incomplete) return;

  const slotByTeam = new Map<number, number>(
    divisionSeasons.map((ds: any) => [ds.dataValues.teamId, ds.dataValues.bracketSlot ?? MAX_SLOT]),
  );

  const ties = groupTies(roundGames, slotByTeam);

  const winners: number[] = [];
  let fullyResolved = true;
  for (const tie of ties) {
    if (tie.bye) {
      // @spec CUP-003 — bye team advances without simulation.
      winners.push(tie.teams[0]);
      continue;
    }

    const agg = aggregateRuns(tie.legs);
    const [teamA, teamB] = tie.teams;
    const aggA = agg.get(teamA) ?? 0;
    const aggB = agg.get(teamB) ?? 0;

    if (aggA !== aggB) {
      winners.push(aggA > aggB ? teamA : teamB);
      continue;
    }

    // Aggregate level — apply the division's tiebreak mode.
    const mode = format.tiebreak ?? 'AGGREGATE_SCORE';
    if (mode === 'AGGREGATE_SCORE') {
      // @spec CUP-004 — accepted unresolved edge case, no fallback.
      fullyResolved = false;
    } else if (mode === 'OVERTIME') {
      // @spec CUP-005
      winners.push(await applyOvertime(tie));
    } else if (mode === 'ANOTHER_GAME_W_OVERTIME') {
      // @spec CUP-006
      winners.push(await applyTiebreakerGame(tie, round, divisionSeasons));
    }
  }

  if (!fullyResolved) return; // CUP-004: leave the round unresolved

  if (winners.length === 1) {
    // @spec CUP-002
    await recordChampion(divisionId, year, winners[0]);
  } else if (winners.length > 1) {
    // @spec CUP-007,CUP-008
    await generateNextRound(winners, format, config.schedulingConfig, divisionSeasons, round);
  }
};

/** Group a round's Game rows into ties (byes + unordered team-pair legs), ordered by bracket slot. */
const groupTies = (roundGames: any[], slotByTeam: Map<number, number>): Tie[] => {
  const byes: any[] = [];
  const tieMap = new Map<string, any[]>();

  for (const g of roundGames) {
    const dv = g.dataValues;
    if (dv.awayTeam == null) {
      byes.push(g);
      continue;
    }
    const key = [dv.homeTeam, dv.awayTeam].sort((x, y) => x - y).join('-');
    if (!tieMap.has(key)) tieMap.set(key, []);
    tieMap.get(key)!.push(g);
  }

  const ties: Tie[] = byes.map((g) => {
    const team = g.dataValues.homeTeam;
    return { bye: true, teams: [team], legs: [g], minSlot: slotByTeam.get(team) ?? MAX_SLOT };
  });

  for (const [key, legs] of tieMap) {
    const [a, b] = key.split('-').map(Number);
    ties.push({
      bye: false,
      teams: [a, b],
      legs,
      minSlot: Math.min(slotByTeam.get(a) ?? MAX_SLOT, slotByTeam.get(b) ?? MAX_SLOT),
    });
  }

  ties.sort((x, y) => x.minSlot - y.minSlot);
  return ties;
};

/** Sum runs per team across a tie's legs (handles home/away swapping between legs). */
const aggregateRuns = (legs: any[]): Map<number, number> => {
  const agg = new Map<number, number>();
  for (const leg of legs) {
    const dv = leg.dataValues ?? leg;
    agg.set(dv.homeTeam, (agg.get(dv.homeTeam) ?? 0) + (dv.homeTeamResult ?? 0));
    agg.set(dv.awayTeam, (agg.get(dv.awayTeam) ?? 0) + (dv.awayTeamResult ?? 0));
  }
  return agg;
};

/** OVERTIME: overwrite the last leg's existing Game row in place to a decisive, non-draw score. */
// @spec CUP-005
const applyOvertime = async (tie: Tie): Promise<number> => {
  const legs = [...tie.legs].sort((a, b) => a.dataValues.id - b.dataValues.id);
  const last = legs[legs.length - 1];
  const dv = last.dataValues;
  const winner = Math.random() < 0.5 ? dv.homeTeam : dv.awayTeam;

  const homeRuns = dv.homeTeamResult ?? 0;
  const awayRuns = dv.awayTeamResult ?? 0;
  const newHome = winner === dv.homeTeam ? Math.max(homeRuns, awayRuns + 1) : homeRuns;
  const newAway = winner === dv.awayTeam ? Math.max(awayRuns, homeRuns + 1) : awayRuns;

  await db.models.Game.update(
    { homeTeamResult: newHome, awayTeamResult: newAway },
    { where: { id: dv.id } },
  );
  return winner;
};

/** ANOTHER_GAME_W_OVERTIME: create a new decisive tiebreaker Game row in the same round. */
// @spec CUP-006
const applyTiebreakerGame = async (
  tie: Tie,
  round: number,
  divisionSeasons: any[],
): Promise<number> => {
  const [homeTeam, awayTeam] = tie.teams;
  const winner = Math.random() < 0.5 ? homeTeam : awayTeam;
  const winnerRuns = Math.floor(Math.random() * 10) + 1;            // 1..10
  const loserRuns = Math.floor(Math.random() * winnerRuns);          // 0..winnerRuns-1 → decisive
  const homeTeamResult = winner === homeTeam ? winnerRuns : loserRuns;
  const awayTeamResult = winner === awayTeam ? winnerRuns : loserRuns;

  const game = await db.models.Game.create({
    homeTeam,
    awayTeam,
    round,
    status: 'COMPLETED',
    homeTeamResult,
    awayTeamResult,
  }).then((r) => r.dataValues);

  const links = [homeTeam, awayTeam]
    .map((teamId) => divisionSeasons.find((ds: any) => ds.dataValues.teamId === teamId)?.dataValues.id)
    .filter((id): id is number => id != null)
    .map((divisionSeasonId) => ({ gameId: game.id, divisionSeasonId }));
  await db.models.DivisionSeasonGame.bulkCreate(links);

  return winner;
};

/** Write (without overwriting) the champion SeasonResult row for (divisionId, year). */
// @spec CUP-002
const recordChampion = async (
  divisionId: number,
  year: number,
  championTeamId: number,
): Promise<void> => {
  const existing = await db.models.SeasonResult.findOne({ where: { divisionId, year } });
  if (existing) {
    if (existing.dataValues.championTeamId == null) {
      await existing.update({ championTeamId });
    }
    return; // never overwrite a decided champion
  }
  await db.models.SeasonResult.create({ divisionId, year, championTeamId });
};

/** Generate the next round's pairings from this round's winners. */
// @spec CUP-007,CUP-008
const generateNextRound = async (
  winners: number[],
  format: CompetitionFormat,
  schedulingConfig: any,
  divisionSeasons: any[],
  currentRound: number,
): Promise<void> => {
  const nextRound = currentRound + 1;
  // @spec CUP-007 REDRAW re-shuffles every round; @spec CUP-008 FIXED keeps bracket order.
  const ordered = format.structure === 'KNOCKOUT' && format.seeding === 'REDRAW'
    ? shuffleTeams(winners)
    : [...winners];

  const pairings: [number, number][] = [];
  for (let i = 0; i < ordered.length - 1; i += 2) {
    pairings.push([ordered[i], ordered[i + 1]]);
  }
  if (pairings.length === 0) return;

  const homeDate = scheduleDate(schedulingConfig, nextRound - 1);
  await createKnockoutGames(pairings, nextRound, homeDate, divisionSeasons);

  if (format.legs === 'TWO_LEG') {
    const returnLegs = pairings.map(([h, a]) => [a, h] as [number, number]);
    const awayDate = scheduleDate(schedulingConfig, nextRound);
    await createKnockoutGames(returnLegs, nextRound, awayDate, divisionSeasons);
  }
};

/** Bulk-create Game rows + DivisionSeasonGame links for a set of pairings in one round. */
const createKnockoutGames = async (
  pairings: [number, number][],
  round: number,
  scheduledDate: Date | undefined,
  divisionSeasons: any[],
): Promise<void> => {
  const games = await db.models.Game.bulkCreate(
    pairings.map(([homeTeam, awayTeam]) => ({
      homeTeam,
      awayTeam,
      round,
      ...(scheduledDate ? { scheduledDate } : {}),
    })),
  ).then((rs) => rs.map((r) => r.dataValues));

  await db.models.DivisionSeasonGame.bulkCreate(
    games.reduce((acc: any[], g) => {
      for (const teamId of [g.homeTeam, g.awayTeam]) {
        const ds = divisionSeasons.find((d: any) => d.dataValues.teamId === teamId);
        if (ds) acc.push({ gameId: g.id, divisionSeasonId: ds.dataValues.id });
      }
      return acc;
    }, []),
  );
};

/** Compute a round's scheduledDate from the division's schedulingConfig (mirrors `division.ts`). */
const scheduleDate = (schedulingConfig: any, roundOffset: number): Date | undefined => {
  if (!schedulingConfig) return undefined;
  const d = new Date(schedulingConfig.startDate);
  d.setDate(d.getDate() + roundOffset * schedulingConfig.intervalDays);
  return d;
};
