import { ContractFactory, DivisionFactory, GameFactory, GameWorldFactory, LeagueFactory, NotificationFactory, PlayerFactory, TeamFactory } from '../db/domain';
import { DomainError } from '../db/domain/errors';
import db from '../db/client';
import { ActiveLineupEntry, NewGameWorld, SchedulingConfig } from './models';
import { resolveMatchRules } from '../db/domain/lineup';

/* ! todo ! will we need to start splitting this by model? */

const getGameWorld = async (id: number) => {
  // @spec MCLB-002
  // @spec RSS-007 surface whether dev tools are enabled so the UI slice can gate the
  // Rapid Simulate control; matches the same env check the rapid-simulate handler uses.
  // find() returns a Sequelize instance — spread via get({ plain: true }) so the response
  // serializes the GameWorld fields (id/config/Leagues/...) plus devToolsEnabled, rather
  // than the instance's internal dataValues/_options guts.
  const result: any = await GameWorldFactory(id).find();
  const gameWorld = result && typeof result.get === 'function'
    ? result.get({ plain: true })
    : result;
  return { ...gameWorld, devToolsEnabled: process.env.ENABLE_DEV_TOOLS === 'true' };
};

const getGameWorlds = async () => {
  const gameWorlds = await GameWorldFactory().find();
  console.debug(gameWorlds);
  return gameWorlds;
};

const getLeague = async (id: number) => {
  const league = await LeagueFactory(id).get();
  console.debug(league);
  return league;
};

const getLeagueStandings = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getStandings();
};

// @spec TODAY-001,TODAY-002,TODAY-003,TODAY-004,TODAY-005,TODAY-006,TODAY-007
const getLeagueToday = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getToday();
};

// @spec API-001,API-002,API-003,API-004
const getLeagueBracket = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getBracket();
};

const newGameWorld = async (config: NewGameWorld) => {
  const newGameWorld = await GameWorldFactory().create(config);
  console.debug(newGameWorld);
  return newGameWorld;
};

// @spec MCLB-003,MCLB-004,MCLB-005
const setManagedClub = async (gwId: number, teamId: number | null) => {
  return await GameWorldFactory(gwId).setManagedClub(teamId);
};

// @spec SCL-015
const cutoverLeagueSeason = async (leagueId: number) => {
  return await LeagueFactory(leagueId).cutover();
};

// @spec SCL-016
const startLeagueSeason = async (leagueId: number) => {
  return await LeagueFactory(leagueId).start();
};

// @spec SCL-017
const updateDivisionSchedulingConfig = async (divisionId: number, schedulingConfig: SchedulingConfig) => {
  return await DivisionFactory(divisionId).updateSchedulingConfig(schedulingConfig);
};

// @spec GWD-001,GWD-002,GWD-003,GWD-004
const deleteGameWorld = async (id: number) => {
  return await GameWorldFactory(id).delete();
};

// @spec SIM-001,SIM-002,SIM-003,SIM-004,SIM-005,SIM-006,SIM-007
const simulateGame = async (id: number) => {
  return await GameFactory(id).simulate();
};

// @spec SIM-008,SIM-009,SIM-010,SIM-011,SIM-012,SIM-013,SIM-014,SIM-015
const simulateBatchGames = async (gwId: number, endDate?: string) => {
  return await GameFactory().simulateBatch(gwId, endDate);
};

// @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006,RSS-007 dev-only rapid season
// simulation. Gated behind ENABLE_DEV_TOOLS: when not exactly 'true', responds 404
// indistinguishable from a nonexistent route so the feature isn't discoverable.
const rapidSimulateSeason = async (gwId: number) => {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') {
    throw new DomainError('Not found', 404);
  }
  return await GameFactory().rapidSimulateSeason(gwId);
};

const getTeamSchedule = async (teamId: number, gwId: number, leagueId?: number) => {
  return await TeamFactory(teamId).getSchedule(gwId, leagueId);
};

// @spec ROST-001,ROST-002,ROST-003,ROST-005,ROST-007,ROST-008,ROST-009,ROST-010
const getTeamRoster = async (teamId: number, gwId?: number) => {
  if (gwId != null) {
    const team = await db.models.Team.findByPk(teamId);
    if (!team || team.dataValues.gameWorldId !== gwId) throw new DomainError('Not found', 404);
  }
  return await TeamFactory(teamId).getRoster();
};

// @spec LREAD-001,LREAD-002,LREAD-003,LREAD-004,LSNAP-004
const getTeamLineup = async (teamId: number, gwId?: number, gameId?: number) => {
  return await TeamFactory(teamId).getLineup({ gwId, gameId });
};

// @spec GBULL-001,GBULL-002 — this read intentionally has no managed-team gate; the pointer is
// UI-only and all existing API reads remain symmetric.
const getNextTeamGameLineup = async (teamId: number, gwId?: number) => {
  if (gwId != null) {
    const team = await db.models.Team.findByPk(teamId);
    if (!team || team.dataValues.gameWorldId !== gwId) throw new DomainError('Not found', 404);
  }
  return TeamFactory(teamId).getNextGameLineup();
};

const resolveTeamMatchRules = async (teamId: number, gameWorldId: number, year: number) => {
  const divisionSeason = await db.models.DivisionSeason.findOne({
    where: { teamId, year },
    include: [{ model: db.models.Division, include: [{ model: db.models.League, where: { gameWorldId } }] }],
    order: [['divisionId', 'ASC']],
  });
  const division = divisionSeason?.dataValues.Division?.dataValues ?? divisionSeason?.dataValues.Division;
  const league = division?.League?.dataValues ?? division?.League;
  if (division && league) return resolveMatchRules(league.config, division.config);

  const fallbackLeague = await db.models.League.findOne({ where: { gameWorldId }, order: [['id', 'ASC']] });
  return resolveMatchRules(fallbackLeague?.dataValues.config);
};

// @spec PDET-001,PDET-002,PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
const getPlayerDetail = async (playerId: number, gwId?: number) => {
  const player = await db.models.Player.findByPk(playerId);
  if (!player || (gwId != null && player.dataValues.gameWorldId !== gwId)) {
    throw new DomainError('Not found', 404);
  }

  const gameWorld = await db.models.GameWorld.findByPk(player.dataValues.gameWorldId);
  if (!gameWorld) throw new DomainError('Not found', 404);

  return await PlayerFactory(playerId).getDetail({
    currentDate: gameWorld.dataValues.currentDate ?? undefined,
    year: gameWorld.dataValues.year,
    gwId,
  });
};

// @spec XFER-010,LEDIT-002 — common Team/GameWorld resolution and managed-club gate for
// mutations. Date eligibility is intentionally a transfer-only policy below.
const resolveManagedTeamContext = async (teamId: number) => {
  const team = await db.models.Team.findByPk(teamId);
  if (!team) throw new DomainError('Not found', 404);

  const gameWorld = await db.models.GameWorld.findByPk(team.dataValues.gameWorldId);
  if (!gameWorld) throw new DomainError('Not found', 404);

  // @spec XFER-010,LEDIT-002 — read live (not cached at module load) so DEV_MODE can toggle.
  if (process.env.DEV_MODE !== 'true' && gameWorld.dataValues.managedTeamId !== teamId) {
    throw new DomainError('team is not managed by the player', 422);
  }
  return {
    team: team.dataValues,
    gameWorld: gameWorld.dataValues,
    gameWorldId: gameWorld.dataValues.id as number,
    gameWorldYear: gameWorld.dataValues.year as number,
  };
};

// @spec XFER-001,XFER-010 — transfer-specific date policy composed over the shared gate.
const resolveMutationContext = async (teamId: number) => {
  const context = await resolveManagedTeamContext(teamId);
  // @spec XFER-001
  if (context.gameWorld.currentDate == null) {
    throw new DomainError('the GameWorld has no current date configured', 422);
  }

  return {
    currentDate: context.gameWorld.currentDate as string,
    gameWorldYear: context.gameWorldYear,
    gameWorldId: context.gameWorldId,
  };
};

// @spec LEDIT-001,LEDIT-002,LEDIT-003,LEDIT-004 — PUT intentionally uses the shared identity
// gate but not resolveMutationContext(), because an active template is editable before season date.
const saveTeamLineup = async (teamId: number, entries: ActiveLineupEntry[]) => {
  const context = await resolveManagedTeamContext(teamId);
  const rules = await resolveTeamMatchRules(teamId, context.gameWorldId, context.gameWorldYear);
  return TeamFactory(teamId).saveActiveLineup(entries, rules);
};

// @spec GBULL-003,GBULL-004,GBULL-005 — unlike the active-template PUT, this game-scoped PATCH
// deliberately does not apply managedTeamId as a server-side access boundary.
const saveTeamGameLineup = async (teamId: number, gameId: number, entries: ActiveLineupEntry[]) => {
  const team = await db.models.Team.findByPk(teamId);
  if (!team) throw new DomainError('Not found', 404);
  const gameWorld = await db.models.GameWorld.findByPk(team.dataValues.gameWorldId);
  if (!gameWorld) throw new DomainError('Not found', 404);
  const rules = await resolveTeamMatchRules(teamId, gameWorld.dataValues.id, gameWorld.dataValues.year);
  return TeamFactory(teamId).saveGameLineup(gameId, entries, rules);
};

// @spec XFER-002,XFER-003,XFER-007,XFER-012,XFER-013,XFER-020
const signPlayer = async (teamId: number, playerId: number, endDate?: string) => {
  const context = await resolveMutationContext(teamId);
  return await ContractFactory(teamId, playerId).sign({ ...context, endDate });
};

// @spec XFER-004,XFER-014,XFER-015,XFER-016,XFER-017
const releasePlayer = async (teamId: number, playerId: number) => {
  const context = await resolveMutationContext(teamId);
  return await ContractFactory(teamId, playerId).release(context);
};

// @spec XFER-005,XFER-006,XFER-007,XFER-018,XFER-019
const renewPlayer = async (teamId: number, playerId: number, endDate?: string) => {
  const context = await resolveMutationContext(teamId);
  return await ContractFactory(teamId, playerId).renew({ ...context, endDate });
};

// @spec XFER-009,XFER-023
const getFreeAgents = async (gwId: number) => {
  return await GameWorldFactory(gwId).getFreeAgents();
};

// @spec NOTIF-003,NOTIF-006,NOTIF-007
const getGameWorldNotifications = async (gwId: number, since?: number) => {
  return await NotificationFactory().listSince(gwId, since);
};

export {
  getGameWorld,
  getGameWorlds,
  getLeagueBracket,
  getLeague,
  getLeagueStandings,
  getLeagueToday,
  getTeamSchedule,
  getTeamRoster,
  getTeamLineup,
  getNextTeamGameLineup,
  saveTeamLineup,
  saveTeamGameLineup,
  getPlayerDetail,
  newGameWorld,
  setManagedClub,
  cutoverLeagueSeason,
  startLeagueSeason,
  updateDivisionSchedulingConfig,
  deleteGameWorld,
  simulateBatchGames,
  rapidSimulateSeason,
  simulateGame,
  signPlayer,
  releasePlayer,
  renewPlayer,
  getFreeAgents,
  getGameWorldNotifications,
};
