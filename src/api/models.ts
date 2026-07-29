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
  scheduledDate: string | null;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
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
  year: number;
  games: TeamSeasonGame[];
}

type TeamSeasonCalendar = TeamSeasonSchedule;

interface DivisionStandings {
  divisionId: number;
  divisionName: string;
  standings: TeamStanding[];
}

interface LeagueConfig {
  name: string;
  type: LeagueType;
  divisions: DivisionConfig[];
  format?: CompetitionFormat;
  standingsConfig?: StandingsConfig;
};
interface SchedulingConfig {
  startDate: string;
  intervalDays: number;
}

interface DivisionConfig {
  name: string;
  defaultTeams: any[];
  format?: CompetitionFormat;
  schedulingConfig?: SchedulingConfig;
};
interface TeamConfig {
  name: string;
};

enum LeagueType {
  League = 'League',
  LeagueCup = 'League Cup'
};

type CompetitionLegs = 'ONE_LEG' | 'TWO_LEG';
type CompetitionSeriesLength = 'Bo1' | 'Bo3' | 'Bo5';
type CompetitionTiebreak = 'AGGREGATE_SCORE' | 'OVERTIME' | 'ANOTHER_GAME_W_OVERTIME';
type CompetitionSeeding = 'FIXED' | 'REDRAW';

type CompetitionFormat = {
  legs: CompetitionLegs;
  seriesLength: CompetitionSeriesLength;
  tiebreak?: CompetitionTiebreak;
} & (
  | { structure: 'ROUND_ROBIN' }
  | { structure: 'KNOCKOUT'; seeding: CompetitionSeeding }
);

const STANDARD_LEAGUE_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN',
  legs: 'TWO_LEG',
  seriesLength: 'Bo1',
  tiebreak: 'AGGREGATE_SCORE',
};

const STANDARD_CUP_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT',
  legs: 'ONE_LEG',
  seriesLength: 'Bo3',
  seeding: 'REDRAW',
};

// @spec CFG-001
const resolveCompetitionFormat = (
  divisionConfig: DivisionConfig,
  leagueConfig: LeagueConfig
): CompetitionFormat | undefined => divisionConfig.format ?? leagueConfig.format;

const DefaultLeagues = {
  [GameWorldType.PremierLeague]: [
    {
      name: GameWorldType.PremierLeague,
      type: LeagueType.League,
      format: STANDARD_LEAGUE_FORMAT,
      divisions: [
        {
          name: GameWorldType.PremierLeague,
          defaultTeams: [...Array(44).keys()].slice(0,20),
        },
        {
          name: 'Championship',
          defaultTeams: [...Array(44).keys()].slice(20,44),
        },
      ]
    },
    {
      name: 'League Cup',
      type: LeagueType.LeagueCup,
      format: STANDARD_CUP_FORMAT,
      divisions: [
        {
          name: '1st Round',
          defaultTeams: [...Array(44).keys()]
        }
      ]
    }
  ]
};

const DefaultTeams = {
  [GameWorldType.PremierLeague]: [
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
    'Sheffield Wednesday'
  ].map((name): TeamConfig => ({ name }))
};

interface NewGameWorld {
  name: GameWorldType;
  leagues: LeagueConfig[];
  teams: TeamConfig[];
  year: number;
};

const useDefaultGameWorld = (gwType: GameWorldType = GameWorldType.PremierLeague): NewGameWorld => {
  return {
    name: gwType,
    leagues: DefaultLeagues[gwType],
    teams: DefaultTeams[gwType],
    year: new Date().getFullYear() - 1
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
  SchedulingConfig,
  StandingsConfig,
  DefaultStandingsConfig,
  TeamStanding,
  TeamSeasonGame,
  TeamSeasonSchedule,
  TeamSeasonCalendar,
  DivisionStandings,
  STANDARD_CUP_FORMAT,
  STANDARD_LEAGUE_FORMAT,
  resolveCompetitionFormat,
  useDefaultGameWorld
};
