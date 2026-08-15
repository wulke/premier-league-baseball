const enum Endpoints {
  GetGameWorld = '/api/gameWorld/:gwId',
  DeleteGameWorld = '/api/gameWorld/:gwId',
  GetGameWorlds = '/api/gameWorld',
  GetLeagueBracket = '/api/league/:leagueId/bracket',
  GetLeagueStandings = '/api/league/:leagueId/standings',
  GetLeagueToday = '/api/league/:leagueId/today',
  GetLeague = '/api/league/:leagueId',
  LeagueSeasonCutover = '/api/league/:leagueId/season/cutover',
  LeagueSeasonStart = '/api/league/:leagueId/season/start',
  UpdateDivisionSchedulingConfig = '/api/division/:divisionId/config',
  GetTeamSchedule = '/api/team/:teamId/calendar',
  // @spec ROST-001,ROST-002,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010
  GetTeamRoster = '/api/team/:teamId/roster',
  // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004
  GetTeamLineup = '/api/team/:teamId/lineup',
  // @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
  GetPlayerDetail = '/api/player/:playerId',
  NewGameWorld = '/api/gameWorld/new',
  // @spec MCLB-003,MCLB-004,MCLB-005
  SetManagedClub = '/api/gameWorld/:gwId/managed-club',
  BatchSimulateGames = '/api/gameWorld/:gwId/simulate',
  RapidSimulateSeason = '/api/gameWorld/:gwId/rapid-simulate',
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };
