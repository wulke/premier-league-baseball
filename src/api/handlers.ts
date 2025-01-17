import { GameWorldFactory } from '../db/domain';
import { NewGameWorld } from './models';

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

export {
  getGameWorld,
  getGameWorlds,
  newGameWorld,
  newSeason
};