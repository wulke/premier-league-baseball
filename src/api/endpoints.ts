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
  GetTeamSchedule = '/api/team/:teamId/calendar',
  NewGameWorld = '/api/gameWorld/new',
  BatchSimulateGames = '/api/gameWorld/:gwId/simulate',
  RapidSimulateSeason = '/api/gameWorld/:gwId/rapid-simulate',
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };
