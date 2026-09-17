// @spec BADGE-009 — real 92-club English pyramid, replacing the england-44 fictional stub.
import { England92Teams } from './team-pools/england-92';

// @spec GWT-001 — `GameWorldType` is the *runnable* identity (only worlds that
// actually simulate get an arm). The old Champions League graduates from a
// registry-only pressure-test config (#85) to a pickable world here (#87).
enum GameWorldType {
  PremierLeague = 'Premier League',
  ChampionsLeague = 'Champions League',
};

interface StandingsConfig {
  mode: 'table' | 'elimination';
  points: {
    win: number;
    loss: number;
    draw?: number;
  };
}

const DefaultStandingsConfig: StandingsConfig = {
  mode: 'table',
  points: { win: 3, draw: 1, loss: 0 }
};

interface TeamStanding {
  teamId: number;
  teamName: string;
  teamBadge?: string; // @spec BADGEUI-005
  played: number;
  won: number;
  drawn: number;
  lost: number;
  runsFor: number;
  runsAgainst: number;
  runDifference: number;
  points: number;
}

interface TeamSeasonGame {
  gameId: number;
  year: number;
  scheduledDate: string | null;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamBadge?: string; // @spec BADGEUI-005
  awayTeamId: number | null;
  awayTeamName: string;
  awayTeamBadge?: string | null; // @spec BADGEUI-005
  divisionId: number;
  divisionName: string;
  leagueId: number; // @spec CALW-003
  leagueName: string; // @spec CALW-003
  roundLabel?: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface TeamSeasonSchedule {
  teamId: number;
  teamName: string;
  teamBadge?: string; // @spec BADGEUI-005
  games: TeamSeasonGame[];
  seasonStart: string | null; // @spec CALW-002,CALW-009
  seasonEnd: string | null; // @spec CALW-002,CALW-009
}

type TeamSeasonCalendar = TeamSeasonSchedule;

type PlayerPosition =
  | 'Pitcher'
  | 'Catcher'
  | 'FirstBase'
  | 'SecondBase'
  | 'ThirdBase'
  | 'Shortstop'
  | 'LeftField'
  | 'CenterField'
  | 'RightField';

type PlayerPitchType = 'Fastball' | 'Curveball' | 'Slider' | 'Changeup';

interface PlayerPitch {
  type: PlayerPitchType;
  velocity: number;
  control: number;
  spin: number;
}

interface PlayerAttributes {
  contact: number;
  power: number;
  armStrength: number;
  accuracy: number;
  reaction: number;
  vision: number;
  discipline: number;
  positions: Record<PlayerPosition, number>;
  pitches: PlayerPitch[];
}

interface PlayerRecord {
  id?: number;
  teamId: number | null;
  gameWorldId: number;
  attributes: PlayerAttributes;
  givenName: string;
  familyName: string;
  countryCode: string;
  bats: 'R' | 'L' | 'S';
  throws: 'R' | 'L';
  birthDate: Date;
}

interface RosterPlayer {
  id: number;
  givenName: string;
  familyName: string;
  countryCode: string;
  bats: 'R' | 'L' | 'S';
  throws: 'R' | 'L';
  age: number;
  primaryPosition: PlayerPosition;
  positionCoverage: PlayerPosition[];
  positions: Record<PlayerPosition, number>; // @spec ROST-011
  contact: number;
  power: number;
  armStrength: number;
  accuracy: number;
  reaction: number;
  vision: number;
  discipline: number;
}

interface LineupStarter {
  playerId: number;
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
  valid: boolean;
}

interface TeamLineup {
  starters: LineupStarter[];
  startingPitcherId: number | null;
  bench: Array<{ playerId: number; valid: boolean }>;
  bullpen: Array<{ playerId: number; valid: boolean }>;
}

interface ActiveLineupEntry {
  playerId: number;
  role: 'STARTER' | 'BENCH' | 'BULLPEN';
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
}

interface GameLineupSnapshot {
  id: number;
  teamId: number;
  gameWorldId: number;
  gameId: number;
}

interface PlayerDetail {
  id: number;
  givenName: string;
  familyName: string;
  countryCode: string;
  bats: 'R' | 'L' | 'S';
  throws: 'R' | 'L';
  birthDate: string;
  age: number;
  primaryPosition: PlayerPosition;
  contact: number;
  power: number;
  armStrength: number;
  accuracy: number;
  reaction: number;
  vision: number;
  discipline: number;
  positions: Record<PlayerPosition, number>;
  pitches: PlayerPitch[];
  contract: { team: { id: number; name: string }; startDate: string; endDate: string } | null;
}

interface PlayerStatsSummary {
  batting: Record<string, number | null>;
  pitching: Record<string, number | null>;
}

// @spec NOTIF-007,NOTIF-010
interface NotificationRow {
  id: number;
  gameWorldId: number;
  teamId: number | null;
  type: string;
  payload: Record<string, any>;
  createdAt: string | Date;
}

interface DivisionStandings {
  divisionId: number;
  divisionName: string;
  standings: TeamStanding[];
}

interface BracketTeam {
  teamId: number | null;
  teamName: string | null;
}

interface BracketGame {
  gameId: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number | null;
  awayTeamName: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
}

type BracketTie =
  | {
      kind: 'BYE';
      teamA: BracketTeam;
      teamB: null;
      winnerTeamId: number;
      games: BracketGame[];
    }
  | {
      kind: 'SERIES';
      teamA: BracketTeam;
      teamB: BracketTeam;
      winnerTeamId?: number;
      games: BracketGame[];
    };

interface BracketRound {
  round: number;
  label: string;
  status: 'COMPLETE' | 'IN_PROGRESS' | 'PENDING';
  ties: BracketTie[];
}

interface DivisionBracket {
  divisionId: number;
  year: number;
  champion?: { teamId: number };
  rounds: BracketRound[];
}

interface LeagueDivisionBracket {
  divisionId: number;
  divisionName: string;
  structure: 'ROUND_ROBIN' | 'KNOCKOUT';
  champion?: { teamId: number };
  rounds: BracketRound[];
}

// --- Competition format ------------------------------------------------------
//
// #83: `winsToAdvance` is the per-division series length (Bo1/Bo3/Bo5/Bo7).
// #82: `SWISS` is a third structure arm — league-phase only, no legs/winsToAdvance
//      (no consumer reads them); carries `gamesPerTeam` + `qualificationTiers`.
type CompetitionLegs = 'ONE_LEG' | 'TWO_LEG';
type CompetitionSeriesLength = 'Bo1' | 'Bo3' | 'Bo5' | 'Bo7';
type CompetitionTiebreak = 'AGGREGATE_SCORE' | 'OVERTIME' | 'ANOTHER_GAME_W_OVERTIME';
type CompetitionSeeding = 'FIXED' | 'REDRAW';

// @spec CFG-002,CFG-003,CFG-006
type CompetitionFormat =
  | { structure: 'ROUND_ROBIN'; legs: CompetitionLegs; winsToAdvance: CompetitionSeriesLength; tiebreak?: CompetitionTiebreak }
  | { structure: 'KNOCKOUT'; legs: CompetitionLegs; winsToAdvance: CompetitionSeriesLength; tiebreak?: CompetitionTiebreak; seeding: CompetitionSeeding }
  | { structure: 'SWISS'; gamesPerTeam: number; qualificationTiers: SwissTier[] };

// #82 — a tier is an id + an absolute rank range; tiers partition the field
// (1..defaultTeams.length). An `eliminated` tier has no downstream consumer.
interface SwissTier {
  id: string;
  rankRange: [number, number];
}

const STANDARD_LEAGUE_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN',
  legs: 'TWO_LEG',
  winsToAdvance: 'Bo1',
  tiebreak: 'AGGREGATE_SCORE',
};

const STANDARD_CUP_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT',
  legs: 'ONE_LEG',
  winsToAdvance: 'Bo3',
  seeding: 'REDRAW',
};

interface SchedulingConfig {
  startDate: string;
  intervalDays: number;
}

interface MatchRules {
  dhEnabled: boolean;
  benchSize: number;
  bullpenSize: number;
  innings?: number;   // @spec PARP-010 — Depth 0 config-driven inning boundary (map #136 decision #12); optional, defaults to 9 at the consumer
}

const DefaultMatchRules: MatchRules = { dhEnabled: false, benchSize: 5, bullpenSize: 7, innings: 9 };

// #80,#84,#95 — `seedingSelection` lives on the *consuming* division and points,
// by id only, at its source stage (and, for TIERED_RANK, the source tier). No
// selector carries rank ranges or overrides — the producer is the single source
// of truth (#95).
// @spec CFG-007
type SeedingSelection =
  | { kind: 'TOP_N_PER_DIVISION'; fromStage: string; topN: number }
  | { kind: 'BEST_OF_REST'; fromStage: string; count: number; excluding: 'DIVISION_WINNERS'; conference?: string }
  | { kind: 'TIERED_RANK'; fromStage: string; tierId: string };

interface DivisionConfig {
  name: string;
  defaultTeams: any[];            // pool-allocation indices; [] on a cross-stage-seeded division
  stageId?: string;               // stamped at League creation from its enclosing Stage (#87)
  stageOrder?: number;            // declaration order within that Stage (#87)
  format: CompetitionFormat;      // required per-division (#83)
  isTopTier?: boolean;            // this division's winner is the League champion (#81)
  seedingSelection?: SeedingSelection;
  conference?: string;            // #84 producer label (AL/NL) — not a node or Stage
  schedulingConfig?: SchedulingConfig;
  matchRules?: Partial<MatchRules>;
};

// #79 — a Stage is a config-only grouping layer above Division; array order on
// League.stages[] is the phase sequence.
// @spec CFG-005
interface Stage {
  id: string;
  name: string;
  divisions: DivisionConfig[];
}

// #283 — a League owns its team pool (`teams`) or takes all of an earlier-declared
// League's Teams (`externalTeams`, matched by `key`). Division `defaultTeams` indices
// resolve against the owning (or external source) League's pool, not a world-level array.
// @spec TLO-002,TLO-003
interface LeagueConfig {
  key?: string;                  // stable identity for externalTeams references
  name: string;
  type: LeagueType;
  teams?: TeamConfig[];          // this League owns and creates exactly these Teams
  externalTeams?: string;        // ...or takes ALL of a strictly-prior League's Teams
  stages: Stage[];                // array order = phase sequence
  standingsConfig?: StandingsConfig;
  compositionKey?: string;
  matchRules?: Partial<MatchRules>;
};

// @spec CFG-011,CFG-012,CFG-013,CFG-014,CFG-015,CFG-016,CFG-017
const validateLeagueConfig = (config: LeagueConfig): void => {
  const stages = config.stages;
  if (!Array.isArray(stages) || stages.length === 0) throw Error('League config requires stages');

  const stageIndexes = new Map<string, number>();
  stages.forEach((stage, index) => {
    if (!stage.id?.trim() || stageIndexes.has(stage.id)) throw Error('Stage ids must be non-empty and unique');
    stageIndexes.set(stage.id, index);
  });

  const topTierStageIndexes: number[] = [];
  stages.forEach((stage, stageIndex) => stage.divisions.forEach((division) => {
    const hasPool = Array.isArray(division.defaultTeams) && division.defaultTeams.length > 0;
    const hasSelection = division.seedingSelection != null;
    if (hasPool === hasSelection) throw Error(`Division '${division.name}' must declare exactly one team source`);
    if (!division.format) throw Error(`Division '${division.name}' requires a format`);
    if (division.isTopTier) topTierStageIndexes.push(stageIndex);

    const selection = division.seedingSelection;
    if (selection) {
      const sourceIndex = stageIndexes.get(selection.fromStage);
      if (sourceIndex == null || sourceIndex >= stageIndex) throw Error(`Division '${division.name}' must seed from a strictly-prior stage`);
      if (division.format.structure === 'SWISS') throw Error('SWISS divisions cannot declare seedingSelection');
      if (selection.kind === 'TIERED_RANK') {
        const source = stages[sourceIndex];
        const matchesTier = source.divisions.some((sourceDivision) =>
          sourceDivision.format.structure === 'SWISS'
          && sourceDivision.format.qualificationTiers.some((tier) => tier.id === selection.tierId),
        );
        if (!matchesTier) throw Error(`Unknown SWISS tier '${selection.tierId}'`);
      }
    }
    if (division.format.structure !== 'SWISS'
      && division.format.legs === 'TWO_LEG'
      && division.format.winsToAdvance !== 'Bo1') {
      throw Error('TWO_LEG formats require winsToAdvance Bo1');
    }
  }));

  if (stages.some((stage) => stage.divisions.length > 0)
    && (topTierStageIndexes.length !== 1 || topTierStageIndexes[0] !== stages.length - 1)) {
    throw Error('League config requires exactly one final-stage isTopTier division');
  }
};
// @spec BADGE-007,BADGE-008 — `key`/`badge` are optional so every other pool (e.g. `europe-32`)
// compiles unchanged. `badge` is a pure function of `key` (`/badges/<key>.png`) computed wherever
// a TeamConfig is authored — its file's actual existence on disk is a build/script-time concern,
// never encoded here (see team-badges-pyramid.md's Key Decisions).
interface TeamConfig {
  name: string;
  key?: string;
  badge?: string;
};

enum LeagueType {
  League = 'League',
  LeagueCup = 'League Cup'
};

// --- Named team pools (#85) --------------------------------------------------
// Decoupled from `GameWorldType`, symmetric with LeagueTemplates. `england-92`
// backs the Premier League world; `europe-32` backs the old Champions League
// world (#87 pickability). `mlb-30` populates when its world runs (builder map).
// #283: pools are referenced by the League templates that own them (TLO-002),
// so this map is declared before LeagueTemplates.
// @spec GWT-001,BADGE-009 — real top-4-tier English pyramid (92 clubs), replacing the
// fictional/misspelled 'england-44' stub. Club/crest data lives in ./team-pools/england-92.ts.
const TeamPools: Record<string, TeamConfig[]> = {
  'england-92': England92Teams,
  // @spec GWT-001 — 32 stub European clubs; group divisions reference indices 0..31.
  // Name-only (no key/badge) — roster realism is the factory's concern.
  'europe-32': [
    'Real Madrid',
    'FC Barcelona',
    'Atletico Madrid',
    'Sevilla',
    'Manchester City',
    'Liverpool',
    'Chelsea',
    'Arsenal',
    'Bayern Munich',
    'Borussia Dortmund',
    'RB Leipzig',
    'Bayer Leverkusen',
    'Inter Milan',
    'AC Milan',
    'Juventus',
    'Napoli',
    'Paris Saint-Germain',
    'Marseille',
    'Monaco',
    'Lyon',
    'Benfica',
    'Porto',
    'Sporting CP',
    'Braga',
    'Ajax',
    'PSV Eindhoven',
    'Feyenoord',
    'Celtic',
    'Rangers',
    'Shakhtar Donetsk',
    'Dinamo Zagreb',
    'Red Star Belgrade',
  ].map((name): TeamConfig => ({ name })),
};

// --- Named competition-config templates (#85) --------------------------------
//
// Decision (#85): competition configs live in a named registry decoupled from
// `GameWorldType`. This is the seam the future "game-world builder" map needs —
// teams and league configs become independently composable.
//
// - `premier-league` / `league-cup` are the live configs, RELOCATED here from
//   the old `DefaultLeagues`. They use one explicit stage.
// - `champions-league` (old CL) / `champions-league-swiss` (new CL) / `mlb` are
//   the **pressure-test configs** this map exists to validate. They are authored
//   in the generalized `stages` shape; only old-CL ever runs (its run path is
//   #87). new-CL + MLB are config-surface only (no Swiss scheduler, no best-of-N
//   engine, no MLB fixture matrix — all out of scope per map #78).

// Format constants for the pressure-test configs (CFG-004 philosophy: named, not
// hand-authored inline). #83: winner-rule is exactly one — aggregate (TWO_LEG +
// Bo1) XOR best-of-wins (BoN + ONE_LEG); the TWO_LEG+BoN combination is rejected
// by #86's validation.
const OLD_CL_GROUP_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN', legs: 'TWO_LEG', winsToAdvance: 'Bo1', tiebreak: 'AGGREGATE_SCORE',
};
const OLD_CL_KNOCKOUT_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'TWO_LEG', winsToAdvance: 'Bo1', tiebreak: 'OVERTIME', seeding: 'REDRAW',
};
const OLD_CL_SCHEDULING = { startDate: '2027-08-01', intervalDays: 7 };
// Group games occupy six weekly rounds; the dependent knockout begins after them
// so day-by-day simulation never exposes a fixture dated before its source stage.
const OLD_CL_KNOCKOUT_SCHEDULING = { startDate: '2027-09-12', intervalDays: 7 };
const NEW_CL_SWISS_FORMAT: CompetitionFormat = {
  structure: 'SWISS', gamesPerTeam: 8, qualificationTiers: [
    { id: 'direct', rankRange: [1, 8] },
    { id: 'playoff', rankRange: [9, 24] },
    { id: 'eliminated', rankRange: [25, 36] },
  ],
};
const NEW_CL_KNOCKOUT_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'TWO_LEG', winsToAdvance: 'Bo1', tiebreak: 'AGGREGATE_SCORE', seeding: 'REDRAW',
};
const MLB_REGULAR_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN', legs: 'ONE_LEG', winsToAdvance: 'Bo1',
};
const MLB_WILDCARD_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'ONE_LEG', winsToAdvance: 'Bo3', seeding: 'FIXED',
};
const MLB_LCS_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'ONE_LEG', winsToAdvance: 'Bo7', seeding: 'FIXED',
};
const MLB_WORLD_SERIES_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'ONE_LEG', winsToAdvance: 'Bo7', seeding: 'FIXED',
};

// @spec GWT-005 — live-template scheduling. The live configs predate schedulingConfig;
// without one on every first-stage Division, LeagueFactory.start() leaves the GameWorld's
// currentDate null (SCL-006), so /today always 422s (TODAY-002) and rapid-simulate stays
// disabled (SCL-014). The 3-day league interval keeps the Today ±3-day window continuously
// populated (weekly gaps would leave 3 empty days per round); the cup starts a month later
// so the sequential DefaultWorlds start order (premier-league, then league-cup) passes
// SCL-004's strictly-after gate on the already-seeded currentDate.
const PL_SCHEDULING = { startDate: '2025-04-01', intervalDays: 3 };
const LC_SCHEDULING = { startDate: '2025-05-01', intervalDays: 14 };

const LeagueTemplates: Record<string, LeagueConfig> = {
  // --- live configs ---
  // @spec TLO-002 — the Premier League owns its pool; the cup borrows it whole via
  // externalTeams (strictly-prior key reference), replacing the old index-overlapping
  // of a world-level flat array (#283).
  // @spec BADGE-006,BADGE-009 — real top-4-tier English pyramid (92 clubs), replacing the
  // fictional 44-team stub. The 4 slices are contiguous/non-overlapping over [0, 92) and only
  // the Premier League division is isTopTier.
  'premier-league': {
    key: 'premier-league',
    name: GameWorldType.PremierLeague,
    type: LeagueType.League,
    teams: TeamPools['england-92'],
    stages: [{ id: 'regular-season', name: 'Regular Season', divisions: [
      {
        name: GameWorldType.PremierLeague,
        defaultTeams: [...Array(92).keys()].slice(0, 20),
        format: STANDARD_LEAGUE_FORMAT,
        schedulingConfig: PL_SCHEDULING,
        isTopTier: true,
      },
      {
        name: 'Championship',
        defaultTeams: [...Array(92).keys()].slice(20, 44),
        format: STANDARD_LEAGUE_FORMAT,
        schedulingConfig: PL_SCHEDULING,
        isTopTier: false,
      },
      {
        name: 'League One',
        defaultTeams: [...Array(92).keys()].slice(44, 68),
        format: STANDARD_LEAGUE_FORMAT,
        schedulingConfig: PL_SCHEDULING,
        isTopTier: false,
      },
      {
        name: 'League Two',
        defaultTeams: [...Array(92).keys()].slice(68, 92),
        format: STANDARD_LEAGUE_FORMAT,
        schedulingConfig: PL_SCHEDULING,
        isTopTier: false,
      },
    ] }],
  },
  'league-cup': {
    key: 'league-cup',
    name: 'League Cup',
    type: LeagueType.LeagueCup,
    externalTeams: 'premier-league',
    stages: [{ id: 'cup', name: 'League Cup', divisions: [
      {
        // @spec BADGE-005 — widened from 44 to all 92; existing knockout bye/power-of-2
        // generation requires no change to accept the larger field.
        name: '1st Round',
        defaultTeams: [...Array(92).keys()],
        format: STANDARD_CUP_FORMAT,
        schedulingConfig: LC_SCHEDULING,
        isTopTier: true,
      },
    ] }],
  },

  // --- pressure-test config: old Champions League (group stage → two-leg KO) ---
  // 32 teams → 8 groups of 4 (round-robin home & away) → top 2 per group (16) →
  // two-leg knockout (Ro16/QF/SF) → single-leg Final. The knockout division owns
  // no pool — its 16 teams arrive via TOP_N_PER_DIVISION from the group stage
  // (#80). `seeding: 'REDRAW'` (constrained winners-vs-runners-up draw is fog).
  // @spec CFG-005,CFG-007
  'champions-league': {
    key: 'champions-league',
    name: 'Champions League',
    type: LeagueType.LeagueCup,
    teams: TeamPools['europe-32'],
    stages: [
      {
        id: 'group-stage',
        name: 'Group Stage',
        divisions: Array.from({ length: 8 }, (_, i): DivisionConfig => ({
          name: `Group ${String.fromCharCode(65 + i)}`,
          defaultTeams: [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3],
          format: OLD_CL_GROUP_FORMAT,
          schedulingConfig: OLD_CL_SCHEDULING,
        })),
      },
      {
        id: 'knockout',
        name: 'Knockout',
        divisions: [{
          name: 'Knockout',
          defaultTeams: [],
          format: OLD_CL_KNOCKOUT_FORMAT,
          seedingSelection: { kind: 'TOP_N_PER_DIVISION', fromStage: 'group-stage', topN: 2 },
          isTopTier: true,
          schedulingConfig: OLD_CL_KNOCKOUT_SCHEDULING,
        }],
      },
    ],
  },

  // --- pressure-test config: new Champions League (Swiss) ---
  // 36 teams, single Swiss league phase (8 games/team, 4H/4A). Tiers partition
  // the field: 1-8 direct to Ro16, 9-24 two-leg playoff, 25-36 eliminated. The
  // knockout division is seeded via TIERED_RANK on the `playoff` tier (#95). The
  // Swiss draw/pots + H/A balance are scheduler-internal (out of scope).
  // @spec CFG-006,CFG-007
  'champions-league-swiss': {
    name: 'Champions League (Swiss)',
    type: LeagueType.LeagueCup,
    stages: [
      {
        id: 'league-phase',
        name: 'League Phase',
        divisions: [{
          name: 'Swiss League',
          defaultTeams: [...Array(36).keys()],
          format: NEW_CL_SWISS_FORMAT,
        }],
      },
      {
        id: 'knockout',
        name: 'Knockout',
        divisions: [{
          name: 'Knockout',
          defaultTeams: [],
          format: NEW_CL_KNOCKOUT_FORMAT,
          seedingSelection: { kind: 'TIERED_RANK', fromStage: 'league-phase', tierId: 'playoff' },
          isTopTier: true,
        }],
      },
    ],
  },

  // --- pressure-test config: MLB (conferences + best-of-N postseason) ---
  // 30 teams, 2 conferences (AL/NL) × 3 divisions × 5. Regular season = one
  // stage × 6 round-robin divisions, each carrying a `conference` producer label
  // (#84). Postseason declares its seeding selections (division winners via
  // TOP_N_PER_DIVISION; wild cards via BEST_OF_REST scoped by conference) and
  // best-of-N lengths (Bo3 WC, Bo7 LCS/WS — #83/#85). NOTE: composing division
  // winners + wild cards into one bracket seed order, and the AL-vs-NL World
  // Series merge, are bracket-placement concerns no selector expresses today
  // (fog, per map #78) — declared here, not resolved. The ~162-game
  // inter-division fixture matrix is scheduler-internal (out of scope).
  // @spec CFG-007,CFG-008,CFG-009
  'mlb': {
    name: 'Major League Baseball',
    type: LeagueType.League,
    stages: [
      {
        id: 'regular-season',
        name: 'Regular Season',
        divisions: [
          { name: 'AL East',    conference: 'AL', defaultTeams: [0, 1, 2, 3, 4],       format: MLB_REGULAR_FORMAT },
          { name: 'AL Central', conference: 'AL', defaultTeams: [5, 6, 7, 8, 9],       format: MLB_REGULAR_FORMAT },
          { name: 'AL West',    conference: 'AL', defaultTeams: [10, 11, 12, 13, 14],  format: MLB_REGULAR_FORMAT },
          { name: 'NL East',    conference: 'NL', defaultTeams: [15, 16, 17, 18, 19],  format: MLB_REGULAR_FORMAT },
          { name: 'NL Central', conference: 'NL', defaultTeams: [20, 21, 22, 23, 24],  format: MLB_REGULAR_FORMAT },
          { name: 'NL West',    conference: 'NL', defaultTeams: [25, 26, 27, 28, 29],  format: MLB_REGULAR_FORMAT },
        ],
      },
      {
        id: 'postseason',
        name: 'Postseason',
        divisions: [
          {
            name: 'AL Bracket',
            conference: 'AL',
            defaultTeams: [],
            format: MLB_LCS_FORMAT,
            seedingSelection: { kind: 'TOP_N_PER_DIVISION', fromStage: 'regular-season', topN: 1 },
          },
          {
            name: 'AL Wild Card',
            conference: 'AL',
            defaultTeams: [],
            format: MLB_WILDCARD_FORMAT,
            seedingSelection: { kind: 'BEST_OF_REST', fromStage: 'regular-season', count: 3, excluding: 'DIVISION_WINNERS', conference: 'AL' },
          },
          {
            name: 'NL Bracket',
            conference: 'NL',
            defaultTeams: [],
            format: MLB_LCS_FORMAT,
            seedingSelection: { kind: 'TOP_N_PER_DIVISION', fromStage: 'regular-season', topN: 1 },
          },
          {
            name: 'NL Wild Card',
            conference: 'NL',
            defaultTeams: [],
            format: MLB_WILDCARD_FORMAT,
            seedingSelection: { kind: 'BEST_OF_REST', fromStage: 'regular-season', count: 3, excluding: 'DIVISION_WINNERS', conference: 'NL' },
          },
        ],
      },
      {
        id: 'world-series',
        name: 'World Series',
        divisions: [{
          name: 'World Series',
          defaultTeams: [],
          format: MLB_WORLD_SERIES_FORMAT,
          seedingSelection: { kind: 'TOP_N_PER_DIVISION', fromStage: 'postseason', topN: 1 },
          isTopTier: true,
        }],
      },
    ],
  },
};


// --- Runnable bundles (#85) --------------------------------------------------
// The layer that opts a set of league templates into a pickable, runnable world.
// `GameWorldType` stays the *runnable* identity (only worlds that actually simulate
// get one); new-CL + MLB are registry-only and so have no entry here. #283: the
// teamPool field is gone — each template owns its pool via LeagueConfig.teams.
// The future builder map makes both fields user-selectable.
// @spec CFG-010,GWT-001
const DefaultWorlds: Record<GameWorldType, { leagues: string[] }> = {
  [GameWorldType.PremierLeague]: { leagues: ['premier-league', 'league-cup'] },
  [GameWorldType.ChampionsLeague]: { leagues: ['champions-league'] },
};

// @spec TLO-002 — teams live on the Leagues; the world payload carries no pool.
interface NewGameWorld {
  name: GameWorldType;
  leagues: LeagueConfig[];
  year: number;
};

const useDefaultGameWorld = (gwType: GameWorldType = GameWorldType.PremierLeague): NewGameWorld => {
  const world = DefaultWorlds[gwType];
  return {
    name: gwType,
    leagues: world.leagues.map((id) => LeagueTemplates[id]),
    year: new Date().getFullYear() - 1,
  };
};

// @spec TLO-003 — world-level team-ownership validation, run before any row is
// written (GameWorldFactory.create). Mirrors SeedingSelection.fromStage's
// strictly-prior rule (CFG-013) so Leagues create in plain array order with no
// dependency resolution. Plain Error → the router's 500 surface for malformed
// create payloads (GWA-005); per-League stage/format rules stay in
// validateLeagueConfig, which direct LeagueFactory callers rely on.
const validateNewGameWorld = (config: NewGameWorld): void => {
  const leagues = config.leagues;
  if (!Array.isArray(leagues) || leagues.length === 0) throw Error('GameWorld config requires leagues');

  const keyIndexes = new Map<string, number>();
  leagues.forEach((league, index) => {
    const hasTeams = Array.isArray(league.teams) && league.teams.length > 0;
    const hasExternal = typeof league.externalTeams === 'string' && league.externalTeams.trim() !== '';
    if (hasTeams === hasExternal) {
      throw Error(`League '${league.name}' must declare exactly one team source (teams or externalTeams)`);
    }
    if (league.key != null) {
      if (keyIndexes.has(league.key)) throw Error(`League key '${league.key}' must be unique`);
      keyIndexes.set(league.key, index);
    }
    if (hasExternal) {
      const sourceIndex = keyIndexes.get(league.externalTeams!);
      if (sourceIndex == null || sourceIndex >= index) {
        throw Error(`League '${league.name}' must source externalTeams from a strictly-prior League (key '${league.externalTeams}')`);
      }
    }
  });
};

export {
  GameWorldType,
  CompetitionFormat,
  NewGameWorld,
  TeamConfig,
  LeagueConfig,
  LeagueType,
  DivisionConfig,
  Stage,
  SeedingSelection,
  SwissTier,
  SchedulingConfig,
  MatchRules,
  DefaultMatchRules,
  StandingsConfig,
  DefaultStandingsConfig,
  TeamStanding,
  TeamSeasonGame,
  TeamSeasonSchedule,
  TeamSeasonCalendar,
  PlayerPosition,
  PlayerPitchType,
  PlayerPitch,
  PlayerAttributes,
  PlayerRecord,
  RosterPlayer,
  LineupStarter,
  TeamLineup,
  ActiveLineupEntry,
  GameLineupSnapshot,
  PlayerDetail,
  PlayerStatsSummary,
  NotificationRow,
  DivisionStandings,
  BracketTeam,
  BracketGame,
  BracketTie,
  BracketRound,
  DivisionBracket,
  LeagueDivisionBracket,
  CompetitionSeriesLength,
  STANDARD_CUP_FORMAT,
  STANDARD_LEAGUE_FORMAT,
  LeagueTemplates,
  TeamPools,
  DefaultWorlds,
  validateLeagueConfig,
  validateNewGameWorld,
  useDefaultGameWorld,
};
