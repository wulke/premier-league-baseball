// @spec MSS-001,MSS-002,MSS-003,MSS-004,MSS-005,MSS-006,MSS-007,MSS-008,MSS-009
import db from '../../../src/db/client';
import { DivisionFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';
import { GameFactory } from '../../../src/db/domain/game';
import { advanceStageIfReady } from '../../../src/db/domain/stage-advancement';
import { LeagueType } from '../../../src/api/models';

const ROUND_ROBIN = { structure: 'ROUND_ROBIN' as const, legs: 'ONE_LEG' as const, winsToAdvance: 'Bo1' as const };
const KNOCKOUT = { structure: 'KNOCKOUT' as const, legs: 'ONE_LEG' as const, winsToAdvance: 'Bo1' as const, seeding: 'FIXED' as const, tiebreak: 'OVERTIME' as const };

describe('multi-stage season run-path', () => {
  let gameWorld: any;
  let teams: any[];

  beforeEach(async () => {
    await db.sync({ force: true });
    gameWorld = await db.models.GameWorld.create({ year: 2027, config: {} }).then((row: any) => row.dataValues);
    const homeLeague = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then((row: any) => row.dataValues);
    teams = await Promise.all([...Array(8).keys()].map((i) => TeamFactory().create(gameWorld.id, { name: `Team ${i}` }, { homeLeagueId: homeLeague.id })));
  });

  const config = (selection: any = { kind: 'TOP_N_PER_DIVISION', fromStage: 'groups', topN: 2 }) => ({
    name: 'Multi-stage Cup', type: LeagueType.LeagueCup,
    stages: [
      { id: 'groups', name: 'Groups', divisions: [
        { name: 'Group A', defaultTeams: [0, 1, 2, 3], format: ROUND_ROBIN, schedulingConfig: { startDate: '2027-01-01', intervalDays: 1 } },
        { name: 'Group B', defaultTeams: [4, 5, 6, 7], format: ROUND_ROBIN, schedulingConfig: { startDate: '2027-01-01', intervalDays: 1 } },
      ] },
      { id: 'knockout', name: 'Knockout', divisions: [
        { name: 'Knockout', defaultTeams: [], format: KNOCKOUT, seedingSelection: selection, isTopTier: true, schedulingConfig: { startDate: '2027-01-01', intervalDays: 1 } },
      ] },
    ],
  });

  const divisionRows = async (leagueId: number) => (await db.models.Division.findAll({ where: { leagueId } })).map((row: any) => row.dataValues);

  // @spec MSS-004
  it('stamps stage identity and declaration order', async () => {
    const league = await LeagueFactory().create(gameWorld.id, config(), teams.map(({ id }) => id));
    const divisions = await divisionRows(league.id);
    expect(divisions.filter((d) => d.config.stageId === 'groups').map((d) => d.config.stageOrder)).toEqual([0, 1]);
    expect(divisions.find((d) => d.config.stageId === 'knockout').config.stageOrder).toBe(0);

  });

  // @spec MSS-001,MSS-005
  it('starts only first-stage default-team divisions', async () => {
    const league = await LeagueFactory().create(gameWorld.id, config(), teams.map(({ id }) => id));
    await LeagueFactory(league.id).start();
    const divisions = await divisionRows(league.id);
    const seasons = await db.models.DivisionSeason.findAll({ where: { year: 2027 } });
    expect(seasons.filter((s: any) => s.dataValues.divisionId === divisions[0].id)).toHaveLength(4);
    expect(seasons.filter((s: any) => s.dataValues.divisionId === divisions[1].id)).toHaveLength(4);
    expect(seasons.filter((s: any) => s.dataValues.divisionId === divisions[2].id)).toHaveLength(0);
  });

  // @spec MSS-002,MSS-006,MSS-007
  it('advances a completed source stage once and seeds rank-outer by stageOrder', async () => {
    const league = await LeagueFactory().create(gameWorld.id, config(), teams.map(({ id }) => id));
    await LeagueFactory(league.id).start();
    const divisions = await divisionRows(league.id);
    for (const division of divisions.slice(0, 2)) {
      const seasons = await db.models.DivisionSeason.findAll({ where: { divisionId: division.id, year: 2027 }, include: [db.models.Game] });
      const games = [...new Map(seasons.flatMap((s: any) => s.dataValues.Games).map((g: any) => [g.id, g])).values()] as any[];
      for (const [index, game] of games.entries()) {
        await db.models.Game.update({ status: 'COMPLETED', homeTeamResult: 10 - index, awayTeamResult: 0 }, { where: { id: game.id } });
      }
    }

    await advanceStageIfReady(league.id, 2027);
    const seeded = await db.models.DivisionSeason.findAll({ where: { divisionId: divisions[2].id, year: 2027 }, order: [['bracketSlot', 'ASC']] });
    const [groupA, groupB] = await Promise.all(divisions.slice(0, 2).map((division) => DivisionFactory(division.id).getStandings(2027, { mode: 'table', points: { win: 3, draw: 1, loss: 0 } })));
    expect(seeded.map((s: any) => s.dataValues.teamId)).toEqual([groupA[0].teamId, groupB[0].teamId, groupA[1].teamId, groupB[1].teamId]);
    await advanceStageIfReady(league.id, 2027);
    expect(await db.models.DivisionSeason.count({ where: { divisionId: divisions[2].id, year: 2027 } })).toBe(4);
  });

  // @spec MSS-003
  it.each(['BEST_OF_REST'])('rejects unsupported %s selection', async (kind) => {
    const selection = { kind, fromStage: 'groups', count: 2, excluding: 'DIVISION_WINNERS' };
    const league = await LeagueFactory().create(gameWorld.id, config(selection), teams.map(({ id }) => id));
    await LeagueFactory(league.id).start();
    const divisions = await divisionRows(league.id);
    for (const division of divisions.slice(0, 2)) {
      const seasons = await db.models.DivisionSeason.findAll({ where: { divisionId: division.id, year: 2027 }, include: [db.models.Game] });
      for (const game of [...new Map(seasons.flatMap((s: any) => s.dataValues.Games).map((g: any) => [g.id, g])).values()] as any[]) {
        await db.models.Game.update({ status: 'COMPLETED', homeTeamResult: 1, awayTeamResult: 0 }, { where: { id: game.id } });
      }
    }
    await expect(advanceStageIfReady(league.id, 2027)).rejects.toMatchObject({ statusCode: 422 });
  });

  // @spec MSS-008,MSS-009
  it('rapid-simulates groups through a top-tier knockout to one champion', async () => {
    const league = await LeagueFactory().create(gameWorld.id, config(), teams.map(({ id }) => id));
    await LeagueFactory(league.id).start();
    await GameFactory().rapidSimulateSeason(gameWorld.id);
    const divisions = await divisionRows(league.id);
    expect(await db.models.SeasonResult.count({ where: { year: 2027 } })).toBe(1);
    expect(await db.models.SeasonResult.count({ where: { divisionId: divisions[2].id, year: 2027 } })).toBe(1);
    expect(await LeagueFactory(league.id).isSeasonComplete(2027)).toBe(true);
  });

  // @spec SIM-019,MSS-009
  it('simulates same-day dependent-stage games before advancing Simulate Today', async () => {
    const league = await LeagueFactory().create(gameWorld.id, config(), teams.map(({ id }) => id));
    await LeagueFactory(league.id).start();
    await db.models.GameWorld.update({ currentDate: '2027-01-01' }, { where: { id: gameWorld.id } });
    const divisions = await divisionRows(league.id);
    const sourceSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: divisions.slice(0, 2).map((division) => division.id), year: 2027 },
      include: [db.models.Game],
    });
    const sourceGames = [...new Map(sourceSeasons.flatMap((season: any) => season.dataValues.Games)
      .map((game: any) => [game.id, game])).values()] as any[];
    await Promise.all(sourceGames.map((game) => db.models.Game.update(
      { scheduledDate: new Date('2027-01-01') }, { where: { id: game.id } },
    )));

    const result = await GameFactory().simulateToday(gameWorld.id);
    const knockoutGames = await db.models.Game.findAll({
      include: [{ model: db.models.DivisionSeason, where: { divisionId: divisions[2].id, year: 2027 } }],
    });

    expect(knockoutGames).not.toHaveLength(0);
    expect(knockoutGames.filter((game: any) => game.dataValues.scheduledDate
      && new Date(game.dataValues.scheduledDate).toISOString().slice(0, 10) === '2027-01-01')
      .every((game: any) => game.dataValues.status === 'COMPLETED')).toBe(true);
    expect(result.progressBlocked).toBe(false);
  });
});
