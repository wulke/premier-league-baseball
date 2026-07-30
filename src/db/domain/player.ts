import { PlayerAttributes, PlayerPosition, PlayerRecord } from '../../api/models';

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

const resolvePositions = (attributes: PlayerAttributes): Record<PlayerPosition, number> => attributes.positions;

// @spec PATTR-001
const primaryPosition = (player: Pick<PlayerRecord, 'attributes'>): PlayerPosition => {
  const positions = resolvePositions(player.attributes);

  return PLAYER_POSITIONS.reduce((bestPosition, candidatePosition) => (
    positions[candidatePosition] > positions[bestPosition] ? candidatePosition : bestPosition
  ), PLAYER_POSITIONS[0]);
};

export { primaryPosition };
