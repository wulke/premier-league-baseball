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
  // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LSNAP-004
  GetTeamLineup = '/api/team/:teamId/lineup',
  // @spec LWRITE-001,LWRITE-002
  UpdateTeamLineup = '/api/team/:teamId/lineup',
  // PATCH above and PUT below intentionally share the path: PATCH is the constrained
  // active-template permutation endpoint, while PUT is the wholesale managed save.
  // @spec LEDIT-001,LEDIT-002,LEDIT-003,LEDIT-004
  SaveTeamLineup = '/api/team/:teamId/lineup',
  // @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
  GetPlayerDetail = '/api/player/:playerId',
  NewGameWorld = '/api/gameWorld/new',
  // @spec MCLB-003,MCLB-004,MCLB-005
  SetManagedClub = '/api/gameWorld/:gwId/managed-club',
  // @spec XFER-001,XFER-002,XFER-003,XFER-007,XFER-010,XFER-012,XFER-013,XFER-020
  SignPlayer = '/api/team/:teamId/transfers/sign',
  // @spec XFER-001,XFER-004,XFER-010,XFER-014,XFER-015,XFER-016,XFER-017
  ReleasePlayer = '/api/team/:teamId/transfers/release',
  // @spec XFER-001,XFER-005,XFER-006,XFER-007,XFER-010,XFER-018,XFER-019,XFER-020
  RenewPlayer = '/api/team/:teamId/transfers/renew',
  // @spec XFER-009,XFER-023
  GetFreeAgents = '/api/gameWorld/:gwId/free-agents',
  BatchSimulateGames = '/api/gameWorld/:gwId/simulate',
  RapidSimulateSeason = '/api/gameWorld/:gwId/rapid-simulate',
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };
