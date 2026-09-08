// @spec LRD-001,LRD-002,LRD-003,LRD-004,LRD-005
// League read API (get + standings) acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/league-read-api.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  divisionId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  response?: ResponseState;
}

let scenarioWorld: WorldState = {};

const capture = async (call: () => Promise<any>) => {
  try {
    const body = await call();
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = { statusCode: (error as any)?.statusCode ?? 500, error };
  }
};

const errorText = (): string => scenarioWorld.response?.error instanceof Error
  ? scenarioWorld.response.error.message
  : '';

const standings = (): any[] => Array.isArray(scenarioWorld.response?.body)
  ? scenarioWorld.response!.body
  : [];

const teamStanding = (teamId: number) => standings()
  .flatMap((entry) => entry.standings)
  .find((row: any) => row.teamId === teamId);

const createSeasonGame = async (year: number, status: string) => {
  const game = await db.models.Game.create({
    homeTeam: scenarioWorld.homeTeamId,
    awayTeam: scenarioWorld.awayTeamId,
    status,
    scheduledDate: new Date(`${year}-06-01`),
    ...(status === 'COMPLETED' ? { homeTeamResult: 3, awayTeamResult: 2 } : {}),
    round: 1,
  }).then(({ dataValues }) => dataValues);

  const seasons = await db.models.DivisionSeason.findAll({
    where: { divisionId: scenarioWorld.divisionId, year },
  });
  await db.models.DivisionSeasonGame.bulkCreate(
    seasons.map((season) => ({ gameId: game.id, divisionSeasonId: season.dataValues.id }))
  );
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), config: {} });
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with one Division containing Team A and Team B$/, async (leagueId: string, gwId: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: 'BDD League' } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: 'BDD Division',
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    const home = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team A' } }).then(({ dataValues }) => dataValues);
    const away = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team B' } }).then(({ dataValues }) => dataValues);
    await Promise.all([home, away].map((team) => db.models.DivisionSeason.create({
      divisionId: division.id, teamId: team.id, year: 2025,
    })));
    scenarioWorld.divisionId = division.id;
    scenarioWorld.homeTeamId = home.id;
    scenarioWorld.awayTeamId = away.id;
  });

  given(/^a COMPLETED game between Team A and Team B in the Division's (\d+) season$/, async (year: string) => {
    await createSeasonGame(Number(year), 'COMPLETED');
  });

  given(/^GameWorld (\d+)'s year is (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.update({ year: Number(year) }, { where: { id: Number(gwId) } });
  });

  when(/^the player requests League (\d+)$/, async (leagueId: string) => {
    await capture(() => handlers.getLeague(Number(leagueId)));
  });

  when(/^the player requests the standings for League (\d+)$/, async (leagueId: string) => {
    await capture(() => handlers.getLeagueStandings(Number(leagueId)));
  });

  then('the response includes the League\'s Divisions', () => {
    expect(scenarioWorld.response?.body.id).toBe(1);
    expect(scenarioWorld.response?.body.Divisions).toHaveLength(1);
    expect(scenarioWorld.response?.body.Divisions[0].id).toBe(scenarioWorld.divisionId);
  });

  then('each Division includes its Teams', () => {
    const teams = scenarioWorld.response?.body.Divisions[0].Teams;
    expect(teams).toHaveLength(2);
    expect(teams.map((team: any) => team.id)).toEqual(expect.arrayContaining([
      scenarioWorld.homeTeamId, scenarioWorld.awayTeamId,
    ]));
  });

  then('the response is a 500 error', () => expect(scenarioWorld.response?.statusCode).toBe(500));

  then('the error indicates the League is invalid', () => expect(errorText()).toContain('Invalid League'));

  then('the response has one entry with divisionId and divisionName', () => {
    expect(standings()).toHaveLength(1);
    expect(standings()[0].divisionId).toBe(scenarioWorld.divisionId);
    expect(standings()[0].divisionName).toBe('BDD Division');
  });

  then('the entry\'s standings list both teams', () => {
    expect(standings()[0].standings.map((row: any) => row.teamId))
      .toEqual(expect.arrayContaining([scenarioWorld.homeTeamId, scenarioWorld.awayTeamId]));
  });

  then(/^Team A's standing shows (\d+) played and (\d+) won$/, (played: string, won: string) => {
    expect(teamStanding(scenarioWorld.homeTeamId!)).toMatchObject({
      played: Number(played), won: Number(won),
    });
  });

  then(/^Team B's standing shows (\d+) played and (\d+) lost$/, (played: string, lost: string) => {
    expect(teamStanding(scenarioWorld.awayTeamId!)).toMatchObject({
      played: Number(played), lost: Number(lost),
    });
  });

  then('the entry\'s standings list is empty', () => {
    expect(standings()).toHaveLength(1);
    expect(standings()[0].standings).toEqual([]);
  });

  then('the response includes computed points for every team', () => {
    standings()[0].standings.forEach((row: any) => {
      expect(typeof row.points).toBe('number');
      expect(Number.isFinite(row.points)).toBe(true);
    });
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = {};
});

autoBindSteps(feature, [registerSteps]);
