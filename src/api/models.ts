enum GameWorldType {
  PremierLeague = 'Premier League',
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
  awayTeamId: number | null;
  awayTeamName: string;
  divisionId: number;
  divisionName: string;
  roundLabel?: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface TeamSeasonSchedule {
  teamId: number;
  teamName: string;
  games: TeamSeasonGame[];
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
};

// #79 — a Stage is a config-only grouping layer above Division; array order on
// League.stages[] is the phase sequence.
// @spec CFG-005
interface Stage {
  id: string;
  name: string;
  divisions: DivisionConfig[];
}

interface LeagueConfig {
  name: string;
  type: LeagueType;
  stages: Stage[];                // array order = phase sequence
  standingsConfig?: StandingsConfig;
  compositionKey?: string;
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
interface TeamConfig {
  name: string;
};

enum LeagueType {
  League = 'League',
  LeagueCup = 'League Cup'
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

const LeagueTemplates: Record<string, LeagueConfig> = {
  // --- live configs ---
  'premier-league': {
    name: GameWorldType.PremierLeague,
    type: LeagueType.League,
    stages: [{ id: 'regular-season', name: 'Regular Season', divisions: [
      {
        name: GameWorldType.PremierLeague,
        defaultTeams: [...Array(44).keys()].slice(0, 20),
        format: STANDARD_LEAGUE_FORMAT,
        isTopTier: true,
      },
      {
        name: 'Championship',
        defaultTeams: [...Array(44).keys()].slice(20, 44),
        format: STANDARD_LEAGUE_FORMAT,
        isTopTier: false,
      },
    ] }],
  },
  'league-cup': {
    name: 'League Cup',
    type: LeagueType.LeagueCup,
    stages: [{ id: 'cup', name: 'League Cup', divisions: [
      {
        name: '1st Round',
        defaultTeams: [...Array(44).keys()],
        format: STANDARD_CUP_FORMAT,
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
    name: 'Champions League',
    type: LeagueType.LeagueCup,
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

// --- Named team pools (#85) --------------------------------------------------
// Decoupled from `GameWorldType`, symmetric with LeagueTemplates. `england-44` is
// the only pool referenced by a runnable DefaultWorld today; `europe-32` /
// `mlb-30` populate when their worlds run (#87 / the builder map).
const TeamPools: Record<string, TeamConfig[]> = {
  'england-44': [
    'Manchester City',
    'Liverpool',
    'Brighton Hove & Albion',
    'Arsenal',
    'Tottenham',
    'Aston Villa',
    'West Ham United',
    'Newcastle United',
    'Manchester United',
    'Crystal Palace',
    'Fulham',
    'Nottingham Forest',
    'Brentford',
    'Chelsea',
    'Everton',
    'Wovles',
    'Bournemouth',
    'Luton Town',
    'Burnely',
    'Sheffield United',
    'Leceister City',
    'Ipswich Town',
    'Preston North End',
    'Hull City',
    'Sudnerland',
    'Leeds United',
    'Cardiff City',
    'Norwich City',
    'Bristol City',
    'Birmingham City',
    'Milwall',
    'Plymouth Argyle',
    'West Bromwich Albion',
    'Blackburn Rovers',
    'Southamptom',
    'Watford',
    'Huddersfield Town',
    'Coventry City',
    'Queens Park Rangers',
    'Stoke City',
    'Swansea City',
    'Middlesbrough',
    'Rotherham United',
    'Sheffield Wednesday',
  ].map((name): TeamConfig => ({ name })),
};

// --- Runnable bundles (#85) --------------------------------------------------
// The layer that opts a team pool + a set of league templates into a pickable,
// runnable world. `GameWorldType` stays the *runnable* identity (only worlds that
// actually simulate get one); new-CL + MLB are registry-only and so have no entry
// here. The future builder map makes both fields user-selectable.
// @spec CFG-010
const DefaultWorlds: Record<GameWorldType, { teamPool: string; leagues: string[] }> = {
  [GameWorldType.PremierLeague]: { teamPool: 'england-44', leagues: ['premier-league', 'league-cup'] },
};

interface NewGameWorld {
  name: GameWorldType;
  leagues: LeagueConfig[];
  teams: TeamConfig[];
  year: number;
};

const useDefaultGameWorld = (gwType: GameWorldType = GameWorldType.PremierLeague): NewGameWorld => {
  const world = DefaultWorlds[gwType];
  return {
    name: gwType,
    leagues: world.leagues.map((id) => LeagueTemplates[id]),
    teams: TeamPools[world.teamPool],
    year: new Date().getFullYear() - 1,
  };
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
  useDefaultGameWorld,
};
