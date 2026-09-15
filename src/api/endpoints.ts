const enum Endpoints {
  // @spec MCLB-002,RSS-007
  GetGameWorld = '/api/gameWorld/:gwId',
  // @spec GWD-001,GWD-002,GWD-003,GWD-004
  DeleteGameWorld = '/api/gameWorld/:gwId',
  // @spec GWA-001,GWA-002
  GetGameWorlds = '/api/gameWorld',
  // @spec API-001,API-002,API-003,API-004
  GetLeagueBracket = '/api/league/:leagueId/bracket',
  // @spec LRD-003,LRD-004,LRD-005
  GetLeagueStandings = '/api/league/:leagueId/standings',
  // @spec LRD-001,LRD-002
  GetLeague = '/api/league/:leagueId',
  // @spec SCL-015
  LeagueSeasonCutover = '/api/league/:leagueId/season/cutover',
  // @spec SCL-016
  LeagueSeasonStart = '/api/league/:leagueId/season/start',
  // @spec SCL-017
  UpdateDivisionSchedulingConfig = '/api/division/:divisionId/config',
  // @spec TSCH-001,TSCH-002,TSCH-003,TSCH-004,CALW-001,CALW-002,CALW-003,CALW-004,CALW-005,CALW-006,CALW-007,CALW-008,CALW-009
  GetTeamSchedule = '/api/team/:teamId/calendar',
  // @spec ROST-001,ROST-002,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010
  GetTeamRoster = '/api/team/:teamId/roster',
  // @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LSNAP-004
  GetTeamLineup = '/api/team/:teamId/lineup',
  // @spec LEDIT-001,LEDIT-002,LEDIT-003,LEDIT-004
  SaveTeamLineup = '/api/team/:teamId/lineup',
  // @spec GBULL-001,GBULL-002
  GetNextTeamGameLineup = '/api/team/:teamId/lineup/next-game',
  // @spec GBULL-003,GBULL-004,GBULL-005
  SaveTeamGameLineup = '/api/team/:teamId/lineup/:gameId',
  // @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
  GetPlayerDetail = '/api/player/:playerId',
  // @spec GWA-003,GWA-004,GWA-005
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
  // @spec NOTIF-003,NOTIF-006,NOTIF-007
  GetGameWorldNotifications = '/api/gameWorld/:gwId/notifications',
  // @spec NOTIF-004,NOTIF-006,NOTIF-008,NOTIF-009
  StreamGameWorldNotifications = '/api/gameWorld/:gwId/notifications/stream',
  // @spec SIM-008,SIM-009,SIM-010,SIM-011,SIM-012,SIM-013,SIM-014,SIM-015
  BatchSimulateGames = '/api/gameWorld/:gwId/simulate',
  // @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006,RSS-007
  RapidSimulateSeason = '/api/gameWorld/:gwId/rapid-simulate',
  // @spec SIM-001,SIM-002,SIM-003,SIM-004,SIM-005,SIM-006,SIM-007
  SimulateGame = '/api/game/:gameId/simulate',
  // ViewGame = '/api/game/:gameId/view
  // PlayGame = '/api/game/:gameId/play
};

export { Endpoints };
