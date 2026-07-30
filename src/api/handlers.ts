import { GameFactory, GameWorldFactory, LeagueFactory, TeamFactory } from '../db/domain';
import { NewGameWorld } from './models';

/* ! todo ! will we need to start splitting this by model? */

const getGameWorld = async (id: number) => {
  const gameWorld = await GameWorldFactory(id).find();
  console.debug(gameWorld);
  return gameWorld;
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

// @spec API-001,API-002,API-003,API-004
const getLeagueBracket = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getBracket();
};

const newGameWorld = async (config: NewGameWorld) => {
  const newGameWorld = await GameWorldFactory().create(config);
  console.debug(newGameWorld);
  return newGameWorld;
};

const newSeason = async (id: number) => {
  const response = await GameWorldFactory(id).newSeason();
  console.debug(response);
  return response;
};

// @spec SIM-001,SIM-002,SIM-003,SIM-004,SIM-005,SIM-006,SIM-007
const simulateGame = async (id: number) => {
  return await GameFactory(id).simulate();
};

// @spec SIM-008,SIM-009,SIM-010,SIM-011,SIM-012,SIM-013,SIM-014,SIM-015
const simulateBatchGames = async (gwId: number, endDate?: string) => {
  return await GameFactory().simulateBatch(gwId, endDate);
};

const getTeamSchedule = async (teamId: number, gwId: number, leagueId?: number) => {
  return await TeamFactory(teamId).getSchedule(gwId, leagueId);
};

export {
  getGameWorld,
  getGameWorlds,
  getLeagueBracket,
  getLeague,
  getLeagueStandings,
  getTeamSchedule,
  newGameWorld,
  newSeason,
  simulateBatchGames,
  simulateGame,
};
