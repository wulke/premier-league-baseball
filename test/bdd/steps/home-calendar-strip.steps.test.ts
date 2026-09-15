// @spec CALW-001,CALW-002,CALW-003,CALW-004,CALW-005,CALW-006,CALW-007,CALW-008,CALW-009
// Home calendar strip — cross-competition date-range query acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/home-calendar-strip.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  teamIds: Record<string, number>;
  divisionIds: Record<string, number>;
  divisionLeagueIds: Record<string, number>;
  gamesByDate: Record<string, number>;
  gameIds: number[];
  response?: ResponseState;
}

const createWorld = (): WorldState => ({
  teamIds: {}, divisionIds: {}, divisionLeagueIds: {}, gamesByDate: {}, gameIds: [],
});
let scenarioWorld = createWorld();

const capture = async (call: () => Promise<any>) => {
  try {
    const body = await call();
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = { statusCode: (error as any)?.statusCode ?? 500, error };
  }
};

const calendarGames = (): any[] => scenarioWorld.response?.body?.games ?? [];

const createGameInDivision = async (
  divisionName: string,
  status: string,
  scheduledDate: string,
  awayTeamKey: string | null = 'Team B',
) => {
  const homeTeamId = scenarioWorld.teamIds['Team A'];
  const game = await db.models.Game.create({
    homeTeam: homeTeamId,
    awayTeam: awayTeamKey == null ? null : scenarioWorld.teamIds[awayTeamKey],
    status,
    scheduledDate: new Date(scheduledDate),
    ...(status === 'COMPLETED' ? { homeTeamResult: 3, awayTeamResult: 2 } : {}),
    round: 1,
  }).then(({ dataValues }) => dataValues);

  const [homeSeason] = await db.models.DivisionSeason.findAll({
    where: { divisionId: scenarioWorld.divisionIds[divisionName], teamId: homeTeamId, year: 2025 },
  });
  await db.models.DivisionSeasonGame.create({ gameId: game.id, divisionSeasonId: homeSeason.dataValues.id });
  scenarioWorld.gameIds.push(game.id);
  scenarioWorld.gamesByDate[scheduledDate] = game.id;
  return game;
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), config: {} });
  });

  given(/^GameWorld (\d+) exists with year (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), config: {} });
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with Division "([^"]+)" containing Team A and Team B$/, async (leagueId: string, gwId: string, divisionName: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: `League ${leagueId}` } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: divisionName,
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    scenarioWorld.divisionIds[divisionName] = division.id;
    scenarioWorld.divisionLeagueIds[divisionName] = league.id;

    // Team A/B are shared across both of GameWorld 1's divisions — create only once.
    if (scenarioWorld.teamIds['Team A'] == null) {
      const home = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team A' } }).then(({ dataValues }) => dataValues);
      const away = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team B' } }).then(({ dataValues }) => dataValues);
      scenarioWorld.teamIds['Team A'] = home.id;
      scenarioWorld.teamIds['Team B'] = away.id;
    }
    await Promise.all(['Team A', 'Team B'].map((key) => db.models.DivisionSeason.create({
      divisionId: division.id, teamId: scenarioWorld.teamIds[key], year: 2025,
    })));
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with Division "([^"]+)" containing Team C$/, async (leagueId: string, gwId: string, divisionName: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: `League ${leagueId}` } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: divisionName,
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    scenarioWorld.divisionIds[divisionName] = division.id;
    scenarioWorld.divisionLeagueIds[divisionName] = league.id;

    const team = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team C' } }).then(({ dataValues }) => dataValues);
    scenarioWorld.teamIds['Team C'] = team.id;
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: team.id, year: 2025 });
  });

  given(/^a COMPLETED game between Team A and Team B in Division "([^"]+)" scheduled on "([^"]+)"$/, async (divisionName: string, date: string) => {
    await createGameInDivision(divisionName, 'COMPLETED', date);
  });

  given(/^Division "([^"]+)" uses a KNOCKOUT format$/, async (divisionName: string) => {
    await db.models.Division.update({
      config: { name: divisionName, format: { structure: 'KNOCKOUT' } },
    }, { where: { id: scenarioWorld.divisionIds[divisionName] } });
  });

  given(/^a SCHEDULED bye game for Team A with no away team in Division "([^"]+)" scheduled on "([^"]+)"$/, async (divisionName: string, date: string) => {
    await createGameInDivision(divisionName, 'SCHEDULED', date, null);
  });

  when(/^the player requests Team A's calendar for GameWorld (\d+) without a date range$/, async (gwId: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(gwId)));
  });

  when(/^the player requests Team C's calendar for GameWorld (\d+) without a date range$/, async (gwId: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team C'], Number(gwId)));
  });

  when(/^the player requests Team A's calendar for GameWorld (\d+) with only a "from" date of "([^"]+)"$/, async (gwId: string) => {
    // A lone `from` never reaches the domain layer as a `range` — the router only builds
    // one when both `from` and `to` are present (CALW-007) — so this mirrors "no range".
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(gwId)));
  });

  when(/^the player requests Team A's calendar for GameWorld (\d+) for the range "([^"]+)" to "([^"]+)"$/, async (gwId: string, from: string, to: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(gwId), undefined, { from, to }));
  });

  then('the response includes both games', () => {
    expect(calendarGames().map((game) => game.gameId).sort()).toEqual([...scenarioWorld.gameIds].sort());
  });

  then(/^the response's seasonStart is "([^"]+)"$/, (date: string) => {
    expect(scenarioWorld.response?.body.seasonStart?.slice(0, 10)).toBe(date);
  });

  then(/^the response's seasonEnd is "([^"]+)"$/, (date: string) => {
    expect(scenarioWorld.response?.body.seasonEnd?.slice(0, 10)).toBe(date);
  });

  then('the response\'s games array is empty', () => expect(calendarGames()).toEqual([]));

  then('the response\'s seasonStart and seasonEnd are both null', () => {
    expect(scenarioWorld.response?.body.seasonStart).toBeNull();
    expect(scenarioWorld.response?.body.seasonEnd).toBeNull();
  });

  then(/^the Division "([^"]+)" game is tagged with League (\d+)'s id and name$/, (divisionName: string, leagueId: string) => {
    const game = calendarGames().find((candidate) => candidate.divisionName === divisionName);
    expect(game?.leagueId).toBe(Number(leagueId));
    expect(game?.leagueName).toBe(`League ${leagueId}`);
  });

  then(/^the bye game's awayTeamName is "([^"]+)"$/, (name: string) => {
    const bye = calendarGames().find((game) => game.gameId === scenarioWorld.gameIds.at(-1));
    expect(bye?.awayTeamName).toBe(name);
  });

  then('the bye game\'s awayTeamId is null', () => {
    const bye = calendarGames().find((game) => game.gameId === scenarioWorld.gameIds.at(-1));
    expect(bye?.awayTeamId).toBeNull();
  });

  then(/^the response includes the game scheduled on "([^"]+)"$/, (date: string) => {
    expect(calendarGames().map((game) => game.gameId)).toContain(scenarioWorld.gamesByDate[date]);
  });

  then(/^the response does not include the game scheduled on "([^"]+)"$/, (date: string) => {
    expect(calendarGames().map((game) => game.gameId)).not.toContain(scenarioWorld.gamesByDate[date]);
  });

  then(/^the response includes only the game scheduled on "([^"]+)"$/, (date: string) => {
    expect(calendarGames().map((game) => game.gameId)).toEqual([scenarioWorld.gamesByDate[date]]);
  });

  then('the response is not an error', () => {
    expect(scenarioWorld.response?.statusCode).toBe(200);
    expect(scenarioWorld.response?.error).toBeUndefined();
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
});

autoBindSteps(feature, [registerSteps]);
