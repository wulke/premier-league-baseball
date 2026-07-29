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
  gameFormula?: GameFormula[];
  standingsConfig?: StandingsConfig;
};
interface SchedulingConfig {
  startDate: string;
  intervalDays: number;
}

interface DivisionConfig {
  name: string;
  defaultTeams: any[];
  gameFormula?: GameFormula[];
  schedulingConfig?: SchedulingConfig;
};
interface TeamConfig {
  name: string;
};

enum LeagueType {
  League = 'League',
  LeagueCup = 'League Cup'
};

enum GameFormula {
  ONE_LEG = '1_LEG',
  TWO_LEG = '2_LEG',
  Bo1 = 'Bo1',
  Bo3 = 'Bo3',
  Bo5 = 'Bo5',
  ROUND_ROBIN = 'ROUND_ROBIN',
  AGGREGATE = 'AGGREGATE',
  KNOCKOUT = 'KNOCKOUT',
  REDRAW = 'REDRAW'
};

const DefaultLeagues = {
  [GameWorldType.PremierLeague]: [
    {
      name: GameWorldType.PremierLeague,
      type: LeagueType.League,
      divisions: [
        {
          name: GameWorldType.PremierLeague,
          defaultTeams: [...Array(44).keys()].slice(0,20),
          gameFormula: [GameFormula.TWO_LEG, GameFormula.Bo1, GameFormula.ROUND_ROBIN, GameFormula.AGGREGATE]
        },
        {
          name: 'Championship',
          defaultTeams: [...Array(44).keys()].slice(20,44),
          gameFormula: [GameFormula.TWO_LEG, GameFormula.Bo1, GameFormula.ROUND_ROBIN, GameFormula.AGGREGATE]
        },
      ]
    },
    {
      name: 'League Cup',
      type: LeagueType.LeagueCup,
      gameFormula: [GameFormula.ONE_LEG, GameFormula.Bo3, GameFormula.KNOCKOUT, GameFormula.REDRAW],
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
  GameFormula,
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
  useDefaultGameWorld
};
