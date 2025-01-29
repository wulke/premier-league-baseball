const enum Endpoints {
  GetGameWorld = '/api/gameWorld/:gwId',
  GetGameWorlds = '/api/gameWorld',
  GetLeague = '/api/league/:leagueId',
  NewGameWorld = '/api/gameWorld/new',
  NewSeason = '/api/gameWorld/:gwId/season/new',
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };