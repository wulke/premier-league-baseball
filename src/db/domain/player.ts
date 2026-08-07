import { Transaction } from 'sequelize';
import { PlayerAttributes, PlayerPosition, PlayerRecord } from '../../api/models';
import db from '../client';
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from './contract';
import { generateIdentity, mulberry32, resolveComposition } from './identity';

interface GenerateRosterOptions {
  gameWorldYear?: number;
  seed?: number;
  transaction?: Transaction;
}

interface IPlayer {
  create: (gameWorldId: number, attributes: PlayerAttributes, teamId?: number | null) => Promise<PlayerRecord>;
  generateRoster: (teamId: number, gameWorldId: number, options?: GenerateRosterOptions) => Promise<PlayerRecord[]>;
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
  // @spec PATTR-002,PATTR-003,PID-006,PID-009
  const create = async (gameWorldId: number, attributes: PlayerAttributes, teamId: number | null = null) => {
    const identity = generateIdentity(resolveComposition(), mulberry32(Date.now()));
    const player = await db.models.Player.create({
      teamId,
      gameWorldId,
      attributes,
      ...identity,
    }).then(({ dataValues }) => dataValues);

    return player;
  };

  return {
    create,

    // @spec PCON-001,PCON-002,PCON-003,PCON-004,PCON-007,PCON-008,PID-002,PID-005,PID-007,PID-010
    generateRoster: async (teamId: number, gameWorldId: number, options: GenerateRosterOptions = {}) => {
      const { gameWorldYear, seed = Date.now(), transaction } = options;
      const year = gameWorldYear ?? await db.models.GameWorld.findByPk(gameWorldId, { transaction }).then((gw) => {
        if (!gw) throw Error(`GameWorld '${gameWorldId}' not found`);
        return gw.dataValues.year;
      });

      const headcount = MIN_ROSTER_SIZE + Math.floor(Math.random() * (MAX_ROSTER_SIZE - MIN_ROSTER_SIZE + 1));
      const slots = allocateRosterSlots(headcount);
      const league = await db.models.League.findOne({ where: { gameWorldId }, transaction });
      const composition = resolveComposition(league?.dataValues.config?.compositionKey);
      const rng = mulberry32(seed);
      const players = await db.models.Player.bulkCreate(
        slots.map(() => ({
          teamId,
          gameWorldId,
          attributes: generatePlayerAttributes(),
          ...generateIdentity(composition, rng, year),
        }))
      , { transaction }).then((rows) => rows.map(({ dataValues }) => dataValues));

      await db.models.Contract.bulkCreate(
        players.map((player) => ({
          playerId: player.id,
          teamId,
          startDate: new Date(Date.UTC(year, 2, 1)),
          endDate: new Date(Date.UTC(year, 9, 31)),
        }))
      , { transaction });

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

export { PlayerFactory, primaryPosition, allocateRosterSlots };
