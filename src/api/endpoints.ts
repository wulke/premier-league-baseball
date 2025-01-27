const enum Endpoints {
  GetGameWorld = '/api/gameWorld/:gwId',
  GetGameWorlds = '/api/gameWorld',
  GetLeague = '/api/league/:leagueId',
  NewGameWorld = '/api/gameWorld/new',
  NewSeason = '/api/gameWorld/:gwId/season/new'
};

export { Endpoints };