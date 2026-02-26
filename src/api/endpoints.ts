const enum Endpoints {
  GetGameWorld = '/api/gameWorld/:gwId',
  GetGameWorlds = '/api/gameWorld',
  GetLeagueStandings = '/api/league/:leagueId/standings',
  GetLeague = '/api/league/:leagueId',
  GetTeamSchedule = '/api/team/:teamId/calendar',
  NewGameWorld = '/api/gameWorld/new',
  NewSeason = '/api/gameWorld/:gwId/season/new',
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };
