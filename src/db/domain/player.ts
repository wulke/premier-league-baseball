import { PlayerAttributes, PlayerPosition, PlayerRecord } from '../../api/models';
import db from '../client';
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from './contract';

interface IPlayer {
  create: (gameWorldId: number, attributes: PlayerAttributes, teamId?: number | null) => Promise<PlayerRecord>;
  generateRoster: (teamId: number, gameWorldId: number) => Promise<PlayerRecord[]>;
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

const FIELDER_POSITIONS: PlayerPosition[] = PLAYER_POSITIONS.filter(
  (position): position is Exclude<PlayerPosition, 'Pitcher'> => position !== 'Pitcher'
);

const PLAYER_PITCH_TYPES = ['Fastball', 'Curveball', 'Slider', 'Changeup'] as const;

// @spec PCON-001,PCON-003
const randomRating = () => Math.floor(Math.random() * 100) + 1;

// @spec PCON-002
const allocateRosterSlots = (headcount: number): PlayerPosition[] => {
  const pitcherCount = Math.round(headcount * 0.4);
  const fielderCount = headcount - pitcherCount;
  const baseFieldersPerPosition = Math.floor(fielderCount / FIELDER_POSITIONS.length);
  const fielderRemainder = fielderCount % FIELDER_POSITIONS.length;

  return [
    ...Array.from({ length: pitcherCount }, () => 'Pitcher' as const),
    ...FIELDER_POSITIONS.flatMap((position, index) => (
      Array.from(
        { length: baseFieldersPerPosition + (index < fielderRemainder ? 1 : 0) },
        () => position
      )
    )),
  ];
};

// @spec PCON-003
const generatePlayerAttributes = (): PlayerAttributes => ({
  contact: randomRating(),
  power: randomRating(),
  armStrength: randomRating(),
  accuracy: randomRating(),
  reaction: randomRating(),
  vision: randomRating(),
  discipline: randomRating(),
  positions: PLAYER_POSITIONS.reduce<Record<PlayerPosition, number>>((positions, position) => {
    positions[position] = randomRating();
    return positions;
  }, {} as Record<PlayerPosition, number>),
  pitches: PLAYER_PITCH_TYPES.map((type) => ({
    type,
    velocity: randomRating(),
    control: randomRating(),
    spin: randomRating(),
  })),
});

const PlayerFactory = (): IPlayer => {
  // @spec PATTR-002,PATTR-003
  const create = async (gameWorldId: number, attributes: PlayerAttributes, teamId: number | null = null) => {
    const player = await db.models.Player.create({
      teamId,
      gameWorldId,
      attributes,
    }).then(({ dataValues }) => dataValues);

    return player;
  };

  return {
    create,

    // @spec PCON-001,PCON-002,PCON-003,PCON-004,PCON-007
    generateRoster: async (teamId: number, gameWorldId: number) => {
      const gameWorld = await db.models.GameWorld.findByPk(gameWorldId).then((gw) => {
        if (!gw) throw Error(`GameWorld '${gameWorldId}' not found`);
        return gw.dataValues;
      });

      const headcount = MIN_ROSTER_SIZE + Math.floor(Math.random() * (MAX_ROSTER_SIZE - MIN_ROSTER_SIZE + 1));
      const slots = allocateRosterSlots(headcount);
      const players = await db.models.Player.bulkCreate(
        slots.map(() => ({
          teamId,
          gameWorldId,
          attributes: generatePlayerAttributes(),
        }))
      ).then((rows) => rows.map(({ dataValues }) => dataValues));

      await db.models.Contract.bulkCreate(
        players.map((player) => ({
          playerId: player.id,
          teamId,
          startYear: gameWorld.year,
          endYear: gameWorld.year,
        }))
      );

      return players;
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
export { allocateRosterSlots };
