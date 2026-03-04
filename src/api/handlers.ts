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

const simulateGame = async (id: number) => {
  /* ! todo ! move to actual simulation logic */
  const homeResult = Math.floor(Math.random() * 10);
  const awayResult = Math.floor(Math.random() * 10);
  const response = await GameFactory(id).result(homeResult, awayResult);
  console.debug(response);
  return response;
};

const getTeamSchedule = async (teamId: number, gwId: number, leagueId?: number) => {
  return await TeamFactory(teamId).getSchedule(gwId, leagueId);
};

export {
  getGameWorld,
  getGameWorlds,
  getLeague,
  getLeagueStandings,
  getTeamSchedule,
  newGameWorld,
  newSeason,
  simulateGame,
};
