import { DivisionFactory, GameFactory, GameWorldFactory, LeagueFactory, TeamFactory } from '../db/domain';
import { DomainError } from '../db/domain/errors';
import db from '../db/client';
import { NewGameWorld, SchedulingConfig } from './models';

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
  return await TeamFactory(teamId).getRoster(gwId);
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
  newGameWorld,
  setManagedClub,
  cutoverLeagueSeason,
  startLeagueSeason,
  updateDivisionSchedulingConfig,
  deleteGameWorld,
  simulateBatchGames,
  rapidSimulateSeason,
  simulateGame,
};
