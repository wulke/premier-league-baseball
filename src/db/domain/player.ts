import { PlayerAttributes, PlayerPosition, PlayerRecord } from '../../api/models';
import db from '../client';

interface IPlayer {
  create: (gameWorldId: number, attributes: PlayerAttributes, teamId?: number | null) => Promise<PlayerRecord>;
}

const PLAYER_POSITIONS: PlayerPosition[] = [
  'Pitcher',
  'Catcher',
  'FirstBase',
  'SecondBase',
  'ThirdBase',
  'Shortstop',
  'LeftField',
  'CenterField',
  'RightField',
];

const PlayerFactory = (): IPlayer => {
  return {
    // @spec PATTR-002,PATTR-003
    create: async (gameWorldId: number, attributes: PlayerAttributes, teamId: number | null = null) => {
      const player = await db.models.Player.create({
        teamId,
        gameWorldId,
        attributes,
      }).then(({ dataValues }) => dataValues);

      return player;
    },
  };
};

// @spec PATTR-001
const primaryPosition = (player: Pick<PlayerRecord, 'attributes'>): PlayerPosition => {
  const positions = player.attributes.positions;

  return PLAYER_POSITIONS.reduce((bestPosition, candidatePosition) => (
    positions[candidatePosition] > positions[bestPosition] ? candidatePosition : bestPosition
  ), PLAYER_POSITIONS[0]);
};

export { PlayerFactory, primaryPosition };
