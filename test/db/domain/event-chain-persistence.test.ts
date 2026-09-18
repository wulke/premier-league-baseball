// @spec ECP-001,ECP-002,ECP-003
import db from '../../../src/db/client';
import { GameFactory, persistGameEvents } from '../../../src/db/domain';

const positions = ['Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField', 'Pitcher'];

const createTeamWithLineup = async (gameWorldId: number, leagueId: number, label: string) => {
  const team = await db.models.Team.create({ gameWorldId, homeLeagueId: leagueId, config: { name: label } })
    .then(({ dataValues }: any) => dataValues);
  const players = await Promise.all(positions.map((_, index) => db.models.Player.create({
    gameWorldId,
    teamId: team.id,
    givenName: `${label}${index}`,
    familyName: 'Player',
    countryCode: 'US',
    bats: 'R',
    throws: 'R',
    birthDate: new Date('2000-01-01'),
    attributes: { contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, positions: {}, pitches: [] },
  }).then(({ dataValues }: any) => dataValues)));
  const lineup = await db.models.Lineup.create({ gameWorldId, teamId: team.id }).then(({ dataValues }: any) => dataValues);
  await db.models.LineupEntry.bulkCreate(players.map((player: any, index: number) => ({
    lineupId: lineup.id,
    playerId: player.id,
    role: 'STARTER',
    battingOrder: index + 1,
    fieldingPosition: positions[index],
  })));
  return team;
};

const createAuthoredGame = async ({ reachable }: { reachable: boolean }) => {
  const gameWorld = await db.models.GameWorld.create({ year: 2030, currentDate: '2030-04-01', config: {} }).then(({ dataValues }: any) => dataValues);
  const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }: any) => dataValues);
  const [home, away] = await Promise.all([
    createTeamWithLineup(gameWorld.id, league.id, 'Home'),
    createTeamWithLineup(gameWorld.id, league.id, 'Away'),
  ]);
  const game = await db.models.Game.create({ homeTeam: home.id, awayTeam: away.id, status: 'SCHEDULED' }).then(({ dataValues }: any) => dataValues);
  if (reachable) {
    const division = await db.models.Division.create({ leagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
    const divisionSeason = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: home.id, year: 2030 }).then(({ dataValues }: any) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: divisionSeason.id, gameId: game.id });
  }
  return { gameWorld, game };
};

describe('GameEvent persistence', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  afterEach(() => jest.restoreAllMocks());

  // @spec ECP-001
  it('@spec ECP-001 stores the settled envelope fields without timestamp columns', async () => {
    const attributes = db.models.GameEvent.getAttributes();
    expect(attributes.type.allowNull).toBe(false);
    expect(attributes.gameId.allowNull).toBe(false);
    expect(attributes.sequence.allowNull).toBe(false);
    expect(attributes.causedByEventId.allowNull).toBe(true);
    expect(attributes.context.type.constructor.name).toBe('JSONTYPE');
    expect(attributes.createdAt).toBeUndefined();
    expect(attributes.updatedAt).toBeUndefined();

    await db.models.Game.create({ id: 77, homeTeam: 1, awayTeam: 2 });
    await persistGameEvents([{
      type: 'PlateAppearanceResolutionEvent', gameId: 77, sequence: 1, causedByEventId: null,
      context: { batterId: 3, outcome: '1B' },
    }]);
    await expect(db.models.GameEvent.findAll({ order: [['sequence', 'ASC']] }).then((rows: any[]) => rows.map((row) => row.dataValues)))
      .resolves.toEqual([expect.objectContaining({ type: 'PlateAppearanceResolutionEvent', gameId: 77, sequence: 1, causedByEventId: null, context: { batterId: 3, outcome: '1B' } })]);
  });

  // @spec ECP-002
  it('@spec ECP-002 persists an authored single-game chain with its projected player stats', async () => {
    const { game } = await createAuthoredGame({ reachable: false });
    await GameFactory(game.id).simulate({ seed: 4242 });

    const [events, stats] = await Promise.all([
      db.models.GameEvent.findAll({ where: { gameId: game.id }, order: [['sequence', 'ASC']] }),
      db.models.PlayerGameStats.findAll({ where: { gameId: game.id } }),
    ]);
    expect(events.length).toBeGreaterThan(0);
    expect(stats.length).toBe(18);
    expect(events.map((event: any) => event.dataValues.sequence)).toEqual(events.map((_: any, index: number) => index + 1));
  });

  // @spec ECP-002,ECP-003
  it('@spec ECP-002 @spec ECP-003 persists batch chains atomically with stats', async () => {
    const { gameWorld, game } = await createAuthoredGame({ reachable: true });
    jest.spyOn(db.models.GameEvent, 'bulkCreate').mockRejectedValueOnce(new Error('event storage failed'));

    await expect(GameFactory().simulateBatch(gameWorld.id, '2030-04-01', { seed: 4242 })).rejects.toThrow('event storage failed');
    await expect(db.models.Game.findByPk(game.id).then((row: any) => row.dataValues)).resolves.toMatchObject({ status: 'SCHEDULED', homeTeamResult: null, awayTeamResult: null });
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id } })).resolves.toBe(0);
    await expect(db.models.GameEvent.count({ where: { gameId: game.id } })).resolves.toBe(0);
  });
});
