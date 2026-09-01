import { Transaction } from 'sequelize';
import { MatchRules, PlayerAttributes, PlayerDetail, PlayerPosition, PlayerRecord, RosterPlayer } from '../../api/models';
import { DomainError } from './errors';
import db from '../client';
import { createInitialRosterContracts, MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from './contract';
import { generateIdentity, mulberry32, resolveComposition } from './identity';
import { LineupFactory } from './lineup';

// @spec ROST-006
const COVERAGE_THRESHOLD = 70;

interface GenerateRosterOptions {
  gameWorldYear?: number;
  compositionKey?: string;
  seed?: number;
  transaction?: Transaction;
  matchRules?: MatchRules;
}

interface CreatePlayerOptions {
  compositionKey?: string;
  seed?: number;
  gameWorldYear?: number;
}

interface IPlayer {
  create: (gameWorldId: number, attributes: PlayerAttributes, teamId?: number | null, options?: CreatePlayerOptions) => Promise<PlayerRecord>;
  generateRoster: (teamId: number, gameWorldId: number, options?: GenerateRosterOptions) => Promise<PlayerRecord[]>;
  getDetail: (options: { currentDate?: Date | string; year: number; gwId?: number }) => Promise<PlayerDetail>;
  setTeam: (teamId: number | null, options?: { transaction?: Transaction }) => Promise<void>;
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

// @spec PDET-003,PDET-004
const resolveCurrentContract = (contracts: any[], currentDate: Date | string | undefined, year: number): any | null => {
  return contracts.find((contract) => {
    const values = contract.dataValues ?? contract;
    if (!currentDate) {
      return new Date(values.startDate).getUTCFullYear() <= year && year <= new Date(values.endDate).getUTCFullYear();
    }
    const now = new Date(currentDate);
    return new Date(values.startDate) <= now && now <= new Date(values.endDate);
  }) ?? null;
};

const dateOnly = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

const PlayerFactory = (playerId?: number): IPlayer => {
  // @spec PATTR-002,PATTR-003,PID-002,PID-005,PID-006,PID-009,PID-010
  const create = async (
    gameWorldId: number,
    attributes: PlayerAttributes,
    teamId: number | null = null,
    options: CreatePlayerOptions = {},
  ) => {
    const identity = generateIdentity(
      resolveComposition(options.compositionKey),
      mulberry32(options.seed ?? Date.now()),
      options.gameWorldYear,
    );
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
      const { gameWorldYear, compositionKey, seed = Date.now(), transaction, matchRules } = options;
      const year = gameWorldYear ?? await db.models.GameWorld.findByPk(gameWorldId, { transaction }).then((gw) => {
        if (!gw) throw Error(`GameWorld '${gameWorldId}' not found`);
        return gw.dataValues.year;
      });

      const headcount = MIN_ROSTER_SIZE + Math.floor(Math.random() * (MAX_ROSTER_SIZE - MIN_ROSTER_SIZE + 1));
      const slots = allocateRosterSlots(headcount);
      const composition = resolveComposition(compositionKey);
      const rng = mulberry32(seed);
      const players = await db.models.Player.bulkCreate(
        slots.map(() => ({
          teamId,
          gameWorldId,
          attributes: generatePlayerAttributes(),
          ...generateIdentity(composition, rng, year),
        }))
      , { transaction }).then((rows) => rows.map(({ dataValues }) => dataValues));

      // @spec XFER-021 — ContractFactory-owned initial minting reuses the shared season-end anchor.
      await createInitialRosterContracts(teamId, players.map((player) => player.id), year, { transaction });

      // @spec LIN-003
      await LineupFactory().generateActive(teamId, gameWorldId, players, { transaction, matchRules });

      return players;
    },

    // @spec PDET-003,PDET-004,PDET-007,PDET-008,PDET-010,PDET-011
    getDetail: async ({ currentDate, year, gwId }): Promise<PlayerDetail> => {
      const player = await db.models.Player.findByPk(playerId);
      if (!player || (gwId != null && player.dataValues.gameWorldId !== gwId)) {
        throw new DomainError('Not found', 404);
      }
      const values = player.dataValues;
      const contracts = await db.models.Contract.findAll({
        where: { playerId: values.id },
        include: [{ model: db.models.Team }],
      });
      const current = resolveCurrentContract(contracts, currentDate, year);
      const contract = current?.dataValues ?? current;
      const team = contract?.Team?.dataValues ?? contract?.Team;

      return {
        id: values.id,
        givenName: values.givenName,
        familyName: values.familyName,
        countryCode: values.countryCode,
        bats: values.bats,
        throws: values.throws,
        birthDate: dateOnly(values.birthDate),
        age: year - new Date(values.birthDate).getUTCFullYear(),
        primaryPosition: primaryPosition(values),
        contact: values.attributes.contact,
        power: values.attributes.power,
        armStrength: values.attributes.armStrength,
        accuracy: values.attributes.accuracy,
        reaction: values.attributes.reaction,
        vision: values.attributes.vision,
        discipline: values.attributes.discipline,
        positions: values.attributes.positions,
        pitches: values.attributes.pitches,
        contract: contract ? {
          team: { id: team.id, name: team.config?.name ?? `Team ${team.id}` },
          startDate: dateOnly(contract.startDate),
          endDate: dateOnly(contract.endDate),
        } : null,
      };
    },

    // @spec XFER-013,XFER-017 — the only sanctioned writer of Player.teamId outside
    // generateRoster(); ContractFactory calls this instead of touching db.models.Player
    // directly (backend-standards §1 model-ownership boundary).
    setTeam: async (teamId, options = {}) => {
      await db.models.Player.update(
        { teamId },
        { where: { id: playerId }, transaction: options.transaction },
      );
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

// @spec ROST-008,ROST-009,ROST-011,XFER-022,XFER-023 — shared row serializer for
// TeamFactory.getRoster() and GameWorldFactory.getFreeAgents(); accepts either a plain
// dataValues-shaped object or a raw Sequelize instance.
const toRosterPlayer = (gameWorldYear: number) => (player: any): RosterPlayer => {
  const values = player.dataValues ?? player;
  const primary = primaryPosition(values);
  const positionCoverage = PLAYER_POSITIONS.filter((position) => (
    values.attributes.positions[position] >= COVERAGE_THRESHOLD || position === primary
  ));

  return {
    id: values.id,
    givenName: values.givenName,
    familyName: values.familyName,
    countryCode: values.countryCode,
    bats: values.bats,
    throws: values.throws,
    age: gameWorldYear - new Date(values.birthDate).getUTCFullYear(),
    primaryPosition: primary,
    positionCoverage,
    positions: values.attributes.positions,
    contact: values.attributes.contact,
    power: values.attributes.power,
    armStrength: values.attributes.armStrength,
    accuracy: values.attributes.accuracy,
    reaction: values.attributes.reaction,
    vision: values.attributes.vision,
    discipline: values.attributes.discipline,
  };
};

export {
  PlayerFactory,
  primaryPosition,
  toRosterPlayer,
  COVERAGE_THRESHOLD,
  allocateRosterSlots,
  PLAYER_POSITIONS,
  FIELDER_POSITIONS,
  resolveCurrentContract,
};
