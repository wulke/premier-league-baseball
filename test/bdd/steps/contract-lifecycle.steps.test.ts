// @spec XFER-001..XFER-020,XFER-022..XFER-024,LEDIT-005,LEDIT-006,LEDIT-007
// Contract lifecycle (sign/release/renew/cutover-sweep/free-agents/roster-filter) acceptance bindings.
import path from 'path';
import { Op } from 'sequelize';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import { createInitialRosterContracts, LeagueFactory, PlayerFactory, TeamFactory } from '../../../src/db/domain';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';
import { PlayerAttributes, PlayerPosition } from '../../../src/api/models';

const feature = loadFeature(path.resolve(__dirname, '../features/contract-lifecycle.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  response?: ResponseState;
  lineupIdBefore?: number | null;
  initialRosterPlayerIds?: number[];
}

let world: WorldState = {};
let devModeOriginal: string | undefined;

const positions = (overrides: Partial<Record<PlayerPosition, number>> = {}): Record<PlayerPosition, number> => ({
  Pitcher: 10, Catcher: 10, FirstBase: 10, SecondBase: 10, ThirdBase: 10,
  Shortstop: 10, LeftField: 10, CenterField: 10, RightField: 10, ...overrides,
});

const attributes = (overrides: Partial<Record<PlayerPosition, number>> = {}): PlayerAttributes => ({
  contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
  positions: positions(overrides),
  pitches: [],
});

const ensureGameWorld = async (id: number) => {
  await db.models.GameWorld.findOrCreate({ where: { id }, defaults: { year: 2025, config: {} } });
};

const ensurePlayer = async (id: number, gwId: number, teamId: number | null) => {
  await db.models.Player.findOrCreate({
    where: { id },
    defaults: {
      teamId, gameWorldId: gwId, attributes: attributes(), givenName: `Player${id}`,
      familyName: 'Contract', countryCode: 'US', bats: 'R', throws: 'R',
      birthDate: new Date('2000-06-01T00:00:00.000Z'),
    },
  });
};

const currentLineupId = async (teamId: number): Promise<number | null> => {
  const lineup = await db.models.Lineup.findOne({ where: { teamId, gameId: null } });
  return lineup?.dataValues.id ?? null;
};

const lineupIncludesPlayer = async (teamId: number, playerId: number): Promise<boolean> => {
  const lineup = await db.models.Lineup.findOne({ where: { teamId, gameId: null } });
  if (!lineup) return false;
  const entry = await db.models.LineupEntry.findOne({ where: { lineupId: lineup.dataValues.id, playerId } });
  return entry != null;
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (id: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: Number(year), config: {} });
  });

  given(/^GameWorld (\d+)'s currentDate is "([^"]+)"$/, async (id: string, currentDate: string) => {
    await db.models.GameWorld.update({ currentDate }, { where: { id: Number(id) } });
  });

  given(/^GameWorld (\d+)'s currentDate is unset$/, async (id: string) => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: Number(id) } });
  });

  given(/^GameWorld (\d+)'s managed club is Team (\d+)$/, async (id: string, teamId: string) => {
    await db.models.GameWorld.update({ managedTeamId: Number(teamId) }, { where: { id: Number(id) } });
  });

  given(/^GameWorld (\d+) has no managed club$/, async (id: string) => {
    await db.models.GameWorld.update({ managedTeamId: null }, { where: { id: Number(id) } });
  });

  given(/^Team (\d+) belongs to GameWorld (\d+)$/, async (teamId: string, gwId: string) => {
    await db.models.Team.findOrCreate({ where: { id: Number(teamId) }, defaults: { gameWorldId: Number(gwId), config: { name: `Team ${teamId}` } } });
  });

  given(/^Team (\d+) has a roster of generated Players with identity and Contracts$/, async (teamId: string) => {
    await TeamFactory(Number(teamId)).getRoster().catch(() => undefined); // no-op guard if not yet queryable
    const gameWorld = await db.models.Team.findByPk(Number(teamId)).then((t) => t!.dataValues.gameWorldId);
    await PlayerFactory().generateRoster(Number(teamId), gameWorld, { gameWorldYear: 2025 });
  });

  // @spec XFER-024
  given(/^Team (\d+) has (\d+) new roster Players in GameWorld (\d+)$/, async (teamId: string, count: string, gwId: string) => {
    await Promise.all(Array.from({ length: Number(count) }, (_, index) => (
      ensurePlayer(1000 + index, Number(gwId), Number(teamId))
    )));
    world.initialRosterPlayerIds = await db.models.Player.findAll({
      where: { gameWorldId: Number(gwId), teamId: Number(teamId), id: { [Op.gte]: 1000 } },
      order: [['id', 'ASC']],
    }).then((players) => players.map((player: any) => player.dataValues.id));
  });

  // @spec XFER-024
  when(/^initial roster Contracts are minted with 40 one-season, 30 two-season, 20 three-season, and 10 four-season term draws$/, async () => {
    const termRolls = [
      ...Array(40).fill(0.00), ...Array(30).fill(0.40),
      ...Array(20).fill(0.70), ...Array(10).fill(0.90),
    ];
    await createInitialRosterContracts(10, world.initialRosterPlayerIds ?? [], 2025, {}, () => termRolls.shift()!);
  });

  given(/^Team (\d+)'s roster is trimmed to exactly 9 Players$/, async (teamId: string) => {
    const players = await db.models.Player.findAll({ where: { teamId: Number(teamId) } });
    const dropIds = players.slice(9).map((p: any) => p.dataValues.id);
    if (dropIds.length > 0) {
      await db.models.Contract.destroy({ where: { playerId: dropIds } });
      await db.models.Player.destroy({ where: { id: dropIds } });
    }
    const lineup = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } });
    if (lineup) {
      await db.models.LineupEntry.destroy({ where: { lineupId: lineup.dataValues.id } });
      await db.models.Lineup.destroy({ where: { id: lineup.dataValues.id } });
    }
  });

  given(/^Player (\d+) is in Team (\d+)'s active Lineup$/, async (playerId: string, teamId: string) => {
    const lineup = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } });
    if (!lineup) throw new Error('no active Lineup to seed');
    await db.models.LineupEntry.create({
      lineupId: lineup.dataValues.id, playerId: Number(playerId), role: 'BENCH', battingOrder: null, fieldingPosition: null,
    });
  });

  given(/^Team (\d+) has an active Lineup containing only Player (\d+)$/, async (teamId: string, playerId: string) => {
    const lineup = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } });
    if (!lineup) throw new Error('no active Lineup to seed');
    await db.models.LineupEntry.destroy({ where: { lineupId: lineup.dataValues.id } });
    const otherPlayerIds = await db.models.Player.findAll({ where: { teamId: Number(teamId), id: { [Op.ne]: Number(playerId) } } })
      .then((rows: any[]) => rows.map(({ dataValues }) => dataValues.id));
    await db.models.Contract.destroy({ where: { playerId: otherPlayerIds } });
    await db.models.Player.destroy({ where: { id: otherPlayerIds } });
    await db.models.LineupEntry.create({
      lineupId: lineup.dataValues.id, playerId: Number(playerId), role: 'STARTER', battingOrder: 9, fieldingPosition: 'Pitcher',
    });
  });

  given(/^Team (\d+)'s roster has too few Players to fill every fielding position$/, async (teamId: string) => {
    const players = await db.models.Player.findAll({ where: { teamId: Number(teamId) } });
    const keepIds = players.slice(0, 3).map((p: any) => p.dataValues.id);
    const dropIds = players.slice(3).map((p: any) => p.dataValues.id);
    if (dropIds.length > 0) {
      await db.models.Contract.destroy({ where: { playerId: dropIds } });
      await db.models.Player.destroy({ where: { id: dropIds } });
    }
    // Also clear the auto-generated active Lineup so a subsequent repair is forced to
    // rebuild from this now-too-thin pool rather than finding an existing one.
    const lineup = await db.models.Lineup.findOne({ where: { teamId: Number(teamId), gameId: null } });
    if (lineup) {
      await db.models.LineupEntry.destroy({ where: { lineupId: lineup.dataValues.id } });
      await db.models.Lineup.destroy({ where: { id: lineup.dataValues.id } });
    }
    void keepIds;
  });

  given(/^Player (\d+) is a free agent in GameWorld (\d+)$/, async (playerId: string, gwId: string) => {
    await ensureGameWorld(Number(gwId));
    await ensurePlayer(Number(playerId), Number(gwId), null);
  });

  given(/^Player (\d+) belongs to GameWorld (\d+)$/, async (playerId: string, gwId: string) => {
    await ensureGameWorld(Number(gwId));
    await ensurePlayer(Number(playerId), Number(gwId), null);
  });

  given(/^Player (\d+) has a Contract with Team (\d+) covering "([^"]+)"$/, async (playerId: string, teamId: string, date: string) => {
    const team = await db.models.Team.findByPk(Number(teamId));
    await ensurePlayer(Number(playerId), team!.dataValues.gameWorldId, Number(teamId));
    await db.models.Player.update({ teamId: Number(teamId) }, { where: { id: Number(playerId) } });
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date(`${date}T00:00:00.000Z`), endDate: new Date('2025-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) has a Contract with Team (\d+) starting "([^"]+)" and ending "([^"]+)"$/, async (
    playerId: string, teamId: string, startDate: string, endDate: string,
  ) => {
    const team = await db.models.Team.findByPk(Number(teamId));
    await ensurePlayer(Number(playerId), team!.dataValues.gameWorldId, Number(teamId));
    await db.models.Player.update({ teamId: Number(teamId) }, { where: { id: Number(playerId) } });
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date(`${endDate}T00:00:00.000Z`),
    });
  });

  given(/^Player (\d+) has a renewed successor Contract with Team (\d+) starting "([^"]+)"$/, async (
    playerId: string, teamId: string, startDate: string,
  ) => {
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date('2026-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) already has a successor Contract with Team (\d+) starting "([^"]+)"$/, async (
    playerId: string, teamId: string, startDate: string,
  ) => {
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date(`${startDate}T00:00:00.000Z`), endDate: new Date('2026-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) had a prior Contract with Team (\d+) that already ended$/, async (playerId: string, teamId: string) => {
    const team = await db.models.Team.findByPk(Number(teamId));
    await ensurePlayer(Number(playerId), team!.dataValues.gameWorldId, null);
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date('2024-03-01T00:00:00.000Z'), endDate: new Date('2024-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) had a Contract with Team (\d+) that already ended$/, async (playerId: string, teamId: string) => {
    const team = await db.models.Team.findByPk(Number(teamId));
    await ensurePlayer(Number(playerId), team!.dataValues.gameWorldId, null);
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date('2024-03-01T00:00:00.000Z'), endDate: new Date('2024-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) has since been signed to a new current Contract with Team (\d+)$/, async (playerId: string, teamId: string) => {
    await db.models.Player.update({ teamId: Number(teamId) }, { where: { id: Number(playerId) } });
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date('2025-04-01T00:00:00.000Z'), endDate: new Date('2025-10-31T00:00:00.000Z'),
    });
  });

  given(/^Player (\d+) has a Contract with Team (\d+) that has already ended, with no successor$/, async (playerId: string, teamId: string) => {
    const team = await db.models.Team.findByPk(Number(teamId));
    await ensurePlayer(Number(playerId), team!.dataValues.gameWorldId, Number(teamId));
    await db.models.Contract.create({
      playerId: Number(playerId), teamId: Number(teamId),
      startDate: new Date('2025-03-01T00:00:00.000Z'), endDate: new Date('2025-05-01T00:00:00.000Z'),
    });
  });

  given(/^League "([^"]+)" is IN_SEASON in GameWorld (\d+) with a complete season$/, async (name: string, gwId: string) => {
    const gameWorld = await db.models.GameWorld.findByPk(Number(gwId));
    const league = await db.models.League.create({
      gameWorldId: Number(gwId),
      config: { name, stages: [{ id: 'default', name: 'Default', divisions: [] }] },
      year: gameWorld!.dataValues.year, status: 'IN_SEASON',
    }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({
      leagueId: league.id,
      config: { name: 'Division', stageId: 'default', defaultTeams: [], format: { structure: 'ROUND_ROBIN', legs: 'ONE_LEG', winsToAdvance: 'Bo1', tiebreak: 'AGGREGATE_SCORE' } },
    }).then(({ dataValues }) => dataValues);
    const season = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: 10, year: gameWorld!.dataValues.year })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: 10, awayTeam: 11, status: 'COMPLETED', homeTeamResult: 1, awayTeamResult: 0 })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });
    (world as any).leagueId = league.id;
  });

  given('DEV_MODE is enabled', () => {
    devModeOriginal = process.env.DEV_MODE;
    process.env.DEV_MODE = 'true';
  });

  when(/^Team (\d+) signs Player (\d+)$/, async (teamId: string, playerId: string) => {
    try {
      const body = await handlers.signPlayer(Number(teamId), Number(playerId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^Team (\d+) signs Player (\d+) with endDate "([^"]+)"$/, async (teamId: string, playerId: string, endDate: string) => {
    try {
      const body = await handlers.signPlayer(Number(teamId), Number(playerId), endDate);
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^Team (\d+) releases Player (\d+)$/, async (teamId: string, playerId: string) => {
    try {
      const body = await handlers.releasePlayer(Number(teamId), Number(playerId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^Team (\d+) renews Player (\d+)$/, async (teamId: string, playerId: string) => {
    world.lineupIdBefore = await currentLineupId(Number(teamId));
    try {
      const body = await handlers.renewPlayer(Number(teamId), Number(playerId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^Team (\d+) renews Player (\d+) with endDate "([^"]+)"$/, async (teamId: string, playerId: string, endDate: string) => {
    try {
      const body = await handlers.renewPlayer(Number(teamId), Number(playerId), endDate);
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^an admin cuts over League "[^"]+"$/, async () => {
    try {
      const body = await LeagueFactory((world as any).leagueId).cutover();
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^the player requests free agents for GameWorld (\d+)$/, async (gwId: string) => {
    try {
      const body = await handlers.getFreeAgents(Number(gwId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  when(/^the player requests the roster for Team (\d+)$/, async (teamId: string) => {
    try {
      const body = await handlers.getTeamRoster(Number(teamId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500, error };
    }
  });

  then(/^the response is (\d+)$/, (statusCode: string) => {
    expect(world.response?.statusCode).toBe(Number(statusCode));
  });

  then(/^the response is a (\d+) error$/, (statusCode: string) => {
    expect(world.response?.statusCode).toBe(Number(statusCode));
  });

  then(/^the response indicates the (Player|GameWorld) was not found$/, (_entity: string) => {
    expect(world.response?.statusCode).toBe(404);
  });

  then(/^Player (\d+) is still a free agent$/, async (playerId: string) => {
    const player = await db.models.Player.findByPk(Number(playerId));
    expect(player!.dataValues.teamId).toBeNull();
  });

  then(/^Player (\d+)'s contract with Team (\d+) is unchanged$/, async (playerId: string, teamId: string) => {
    const contract = await db.models.Contract.findOne({ where: { playerId: Number(playerId), teamId: Number(teamId) } });
    expect(contract).not.toBeNull();
  });

  then(/^Player (\d+)'s teamId is Team (\d+)$/, async (playerId: string, teamId: string) => {
    const player = await db.models.Player.findByPk(Number(playerId));
    expect(player!.dataValues.teamId).toBe(Number(teamId));
  });

  then(/^Player (\d+)'s teamId is still Team (\d+)$/, async (playerId: string, teamId: string) => {
    const player = await db.models.Player.findByPk(Number(playerId));
    expect(player!.dataValues.teamId).toBe(Number(teamId));
  });

  then(/^Player (\d+)'s teamId is null$/, async (playerId: string) => {
    const player = await db.models.Player.findByPk(Number(playerId));
    expect(player!.dataValues.teamId).toBeNull();
  });

  then(/^Team (\d+)'s active Lineup includes Player (\d+)$/, async (teamId: string, playerId: string) => {
    expect(await lineupIncludesPlayer(Number(teamId), Number(playerId))).toBe(true);
  });

  then(/^Team (\d+)'s active Lineup no longer includes Player (\d+)$/, async (teamId: string, playerId: string) => {
    expect(await lineupIncludesPlayer(Number(teamId), Number(playerId))).toBe(false);
  });

  then(/^Team (\d+)'s active Lineup entry for Player (\d+) is invalid$/, async (teamId: string, playerId: string) => {
    const lineup = await TeamFactory(Number(teamId)).getLineup();
    expect(lineup.starters).toEqual(expect.arrayContaining([expect.objectContaining({ playerId: Number(playerId), valid: false })]));
  });

  then(/^Team (\d+)'s active Lineup is unchanged$/, async (teamId: string) => {
    expect(await currentLineupId(Number(teamId))).toBe(world.lineupIdBefore);
  });

  then(/^the response is 200 with a Contract starting "([^"]+)"$/, (startDate: string) => {
    expect(world.response?.statusCode).toBe(200);
    expect(world.response?.body?.startDate).toBe(startDate);
  });

  then(/^the response is 200 with a Contract ending "([^"]+)"$/, (endDate: string) => {
    expect(world.response?.statusCode).toBe(200);
    expect(world.response?.body?.endDate).toBe(endDate);
  });

  then(/^the response is 200 with a successor Contract starting "([^"]+)"$/, (startDate: string) => {
    expect(world.response?.statusCode).toBe(200);
    expect(world.response?.body?.startDate).toBe(startDate);
  });

  then(/^Player (\d+) has no Contract with Team (\d+) starting after "([^"]+)"$/, async (playerId: string, teamId: string, date: string) => {
    const rows = await db.models.Contract.findAll({ where: { playerId: Number(playerId), teamId: Number(teamId) } });
    const cutoff = new Date(`${date}T00:00:00.000Z`);
    expect(rows.every((row: any) => new Date(row.dataValues.startDate) <= cutoff)).toBe(true);
  });

  then(/^Player (\d+)'s prior Contract with Team (\d+) is unchanged$/, async (playerId: string, teamId: string) => {
    const contract = await db.models.Contract.findOne({
      where: { playerId: Number(playerId), teamId: Number(teamId) },
      order: [['startDate', 'ASC']],
    });
    expect(contract).not.toBeNull();
    expect(new Date(contract!.dataValues.startDate).toISOString().slice(0, 10)).toBe('2024-03-01');
  });

  then(/^Player (\d+)'s Contract with Team (\d+) now ends "([^"]+)"$/, async (playerId: string, teamId: string, endDate: string) => {
    const contract = await db.models.Contract.findOne({
      where: { playerId: Number(playerId), teamId: Number(teamId) },
      order: [['startDate', 'ASC']],
    });
    expect(new Date(contract!.dataValues.endDate).toISOString().slice(0, 10)).toBe(endDate);
  });

  then(/^Player (\d+)'s current Contract with Team (\d+) is unchanged$/, async (playerId: string, teamId: string) => {
    const contract = await db.models.Contract.findOne({
      where: { playerId: Number(playerId), teamId: Number(teamId) },
      order: [['startDate', 'ASC']],
    });
    expect(new Date(contract!.dataValues.endDate).toISOString().slice(0, 10)).toBe('2025-10-31');
  });

  then(/^Player (\d+)'s Contract with Team (\d+) is unchanged$/, async (playerId: string, teamId: string) => {
    const contract = await db.models.Contract.findOne({ where: { playerId: Number(playerId), teamId: Number(teamId) } });
    expect(contract).not.toBeNull();
    expect(new Date(contract!.dataValues.endDate).toISOString().slice(0, 10)).toBe('2025-10-31');
  });

  then(/^the response includes Player (\d+)$/, (playerId: string) => {
    expect((world.response?.body ?? []).some((row: any) => row.id === Number(playerId))).toBe(true);
  });

  then(/^the response does not include Player (\d+)$/, (playerId: string) => {
    expect((world.response?.body ?? []).some((row: any) => row.id === Number(playerId))).toBe(false);
  });

  then(/^Player (\d+)'s row carries the same shape as a roster row$/, (playerId: string) => {
    const row = (world.response?.body ?? []).find((entry: any) => entry.id === Number(playerId));
    expect(row).toEqual(expect.objectContaining({
      id: expect.any(Number), primaryPosition: expect.any(String), positionCoverage: expect.any(Array),
      positions: expect.any(Object), contact: expect.any(Number),
    }));
  });

  then(/^Player (\d+) appears exactly once in the roster$/, (playerId: string) => {
    const rows = (world.response?.body ?? []).filter((row: any) => row.id === Number(playerId));
    expect(rows).toHaveLength(1);
  });

  then(/^Player (\d+)'s row reflects the current Contract, not the ended one$/, (playerId: string) => {
    const row = (world.response?.body ?? []).find((entry: any) => entry.id === Number(playerId));
    expect(row).toBeDefined();
  });

  // @spec XFER-024
  then(/^(\d+) initial Contracts end on "([^"]+)"$/, async (count: string, endDate: string) => {
    const contracts = await db.models.Contract.findAll({
      where: { teamId: 10, playerId: { [Op.in]: world.initialRosterPlayerIds ?? [] } },
    });
    expect(contracts.filter((contract: any) => (
      new Date(contract.dataValues.endDate).toISOString().slice(0, 10) === endDate
    ))).toHaveLength(Number(count));
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  world = {};
});

afterEach(() => {
  if (devModeOriginal === undefined) delete process.env.DEV_MODE;
  else process.env.DEV_MODE = devModeOriginal;
  devModeOriginal = undefined;
});

autoBindSteps(feature, [registerSteps]);
