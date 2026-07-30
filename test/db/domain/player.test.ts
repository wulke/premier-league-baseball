// @spec PATTR-001,PATTR-002,PATTR-003,PCON-001,PCON-002,PCON-003,PCON-004,PCON-007
import { PlayerAttributes } from '../../../src/api/models';
import db from '../../../src/db/client';
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from '../../../src/db/domain/contract';
import { PlayerFactory, allocateRosterSlots, primaryPosition } from '../../../src/db/domain/player';

const nonPitcherAttributes: PlayerAttributes = {
  contact: 71,
  power: 64,
  armStrength: 58,
  accuracy: 62,
  reaction: 77,
  vision: 68,
  discipline: 73,
  positions: {
    Pitcher: 12,
    Catcher: 22,
    FirstBase: 40,
    SecondBase: 55,
    ThirdBase: 64,
    Shortstop: 88,
    LeftField: 61,
    CenterField: 72,
    RightField: 57,
  },
  pitches: [
    { type: 'Fastball', velocity: 43, control: 31, spin: 29 },
    { type: 'Changeup', velocity: 35, control: 28, spin: 24 },
  ],
};

describe('Player model + attribute schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PATTR-001
  it('@spec PATTR-001 derives primary position from the highest-rated positions entry', async () => {
    expect(
      primaryPosition({
        attributes: nonPitcherAttributes,
      })
    ).toBe('Shortstop');
  });

  // @spec PATTR-002,PATTR-003
  it('@spec PATTR-002 @spec PATTR-003 persists uniform pitches for a free-agent player', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2046 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Chicago Whales' }
    }).then(({ dataValues }) => dataValues);

    const player = await PlayerFactory().create(gameWorld.id, nonPitcherAttributes, null);

    await PlayerFactory().create(
      gameWorld.id,
      {
        ...nonPitcherAttributes,
        positions: {
          ...nonPitcherAttributes.positions,
          Pitcher: 91,
        },
      },
      team.id
    );

    const gameWorldWithPlayers = await db.models.GameWorld.findByPk(gameWorld.id, {
      include: [db.models.Player],
    });
    const teamWithPlayers = await db.models.Team.findByPk(team.id, {
      include: [db.models.Player],
    });

    expect(player.teamId).toBeNull();
    expect(player.attributes.pitches).toEqual(nonPitcherAttributes.pitches);
    expect(player.attributes.positions).toEqual(nonPitcherAttributes.positions);
    expect(gameWorldWithPlayers?.dataValues.Players).toHaveLength(2);
    expect(teamWithPlayers?.dataValues.Players).toHaveLength(1);
  });

  // @spec PCON-002
  it('@spec PCON-002 allocates roster slots proportionally instead of via a fixed template', () => {
    for (let headcount = MIN_ROSTER_SIZE; headcount <= MAX_ROSTER_SIZE; headcount += 1) {
      const slots = allocateRosterSlots(headcount);
      const counts = slots.reduce<Record<string, number>>((totals, slot) => {
        totals[slot] = (totals[slot] ?? 0) + 1;
        return totals;
      }, {});

      const pitcherCount = counts.Pitcher ?? 0;
      const fielderCounts: number[] = Object.entries(counts)
        .filter(([position]) => position !== 'Pitcher')
        .map(([, count]) => count);

      expect(slots).toHaveLength(headcount);
      expect(pitcherCount).toBe(Math.round(headcount * 0.4));
      expect(fielderCounts).toHaveLength(8);
      expect(Math.max(...fielderCounts) - Math.min(...fielderCounts)).toBeLessThanOrEqual(1);
    }
  });

  // @spec PCON-001,PCON-003,PCON-004,PCON-007
  it('@spec PCON-001 @spec PCON-003 @spec PCON-004 @spec PCON-007 generates a minimum-size roster with uniform attributes and matching contracts', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2052 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Austin Arrows' },
    }).then(({ dataValues }) => dataValues);

    try {
      const players = await PlayerFactory().generateRoster(team.id, gameWorld.id);
      const contracts = await db.models.Contract.findAll({
        where: { teamId: team.id },
        order: [['id', 'ASC']],
      }).then((rows) => rows.map(({ dataValues }) => dataValues));

      expect(players).toHaveLength(MIN_ROSTER_SIZE);
      expect(contracts).toHaveLength(MIN_ROSTER_SIZE);

      players.forEach((player) => {
        expect(player.teamId).toBe(team.id);
        expect(player.attributes).toEqual({
          contact: 1,
          power: 1,
          armStrength: 1,
          accuracy: 1,
          reaction: 1,
          vision: 1,
          discipline: 1,
          positions: {
            Pitcher: 1,
            Catcher: 1,
            FirstBase: 1,
            SecondBase: 1,
            ThirdBase: 1,
            Shortstop: 1,
            LeftField: 1,
            CenterField: 1,
            RightField: 1,
          },
          pitches: [
            { type: 'Fastball', velocity: 1, control: 1, spin: 1 },
            { type: 'Curveball', velocity: 1, control: 1, spin: 1 },
            { type: 'Slider', velocity: 1, control: 1, spin: 1 },
            { type: 'Changeup', velocity: 1, control: 1, spin: 1 },
          ],
        });
      });

      contracts.forEach((contract) => {
        expect(contract.teamId).toBe(team.id);
        expect(contract.startYear).toBe(gameWorld.year);
        expect(contract.endYear).toBe(gameWorld.year);
      });
      expect(contracts.map((contract) => contract.playerId).sort((a, b) => a - b)).toEqual(
        players.map((player) => player.id!).sort((a, b) => a - b)
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  // @spec PCON-001
  it('@spec PCON-001 generates a maximum-size roster when the random headcount hits the upper bound', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999999);
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2053 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Denver Peaks' },
    }).then(({ dataValues }) => dataValues);

    try {
      const players = await PlayerFactory().generateRoster(team.id, gameWorld.id);
      expect(players).toHaveLength(MAX_ROSTER_SIZE);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
