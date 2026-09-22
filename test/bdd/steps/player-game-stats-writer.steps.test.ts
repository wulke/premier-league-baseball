// @spec PGSW-001,PGSW-002,PGSW-003,PGSW-004
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import { GameFactory, PlayerGameStatsWriter } from '../../../src/db/domain';

const feature = loadFeature(path.resolve(__dirname, '../features/player-game-stats-writer.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];

let game: any;
let homeTeam: any;
let awayTeam: any;
let homePlayers: any[] = [];
let awayPlayers: any[] = [];
let gameWorldId: number;
let leagueId: number;
let duplicateError: unknown;

// @spec PGSW-001,PGSW-002 — scenario fixture construction. Flat neutral ratings: the
// authored path (SIM-021/022) routes complete lineups to the attribute engine, whose
// PARP-020 guard rejects participants without numeric simulation attributes.
const createPlayer = async (teamId: number, gameWorldId: number, index: number) => (
  db.models.Player.create({
    teamId, gameWorldId, givenName: `Player${teamId}-${index}`, familyName: 'Writer', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2000-01-01'),
    attributes: { positions: {}, pitches: [], contact: 50, discipline: 50, power: 50, accuracy: 50, armStrength: 50 },
  }).then(({ dataValues }: any) => dataValues)
);

// @spec PGSW-001,PGSW-003,PGSW-004 — complete frozen-lineup fixture.
const createCompleteLineup = async (team: any, gameWorldId: number, includeBullpen = true) => {
  const players = await Promise.all(Array.from({ length: includeBullpen ? 10 : 9 }, (_, index) => createPlayer(team.id, gameWorldId, index + 1)));
  const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId }).then(({ dataValues }: any) => dataValues);
  await db.models.LineupEntry.bulkCreate([
    ...positions.map((fieldingPosition, index) => ({ lineupId: lineup.id, playerId: players[index].id, role: 'STARTER', battingOrder: index + 1, fieldingPosition })),
    ...(includeBullpen ? [{ lineupId: lineup.id, playerId: players[9].id, role: 'BULLPEN', battingOrder: null, fieldingPosition: null }] : []),
  ]);
  return players;
};

// @spec PGSW-002 — incomplete active-lineup fixture.
const createIncompleteLineup = async (team: any, gameWorldId: number) => {
  const players = await Promise.all(Array.from({ length: 8 }, (_, index) => createPlayer(team.id, gameWorldId, index + 1)));
  const lineup = await db.models.Lineup.create({ teamId: team.id, gameWorldId }).then(({ dataValues }: any) => dataValues);
  await db.models.LineupEntry.bulkCreate(positions.slice(0, 8).map((fieldingPosition, index) => ({
    lineupId: lineup.id, playerId: players[index].id, role: 'STARTER', battingOrder: index + 1, fieldingPosition,
  })));
};

// @spec PGSW-001,PGSW-002 — scheduled-game fixture.
const createGame = async () => {
  const gameWorld = await db.models.GameWorld.create({ year: 2025, currentDate: '2025-04-10', config: {} }).then(({ dataValues }: any) => dataValues);
  const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }: any) => dataValues);
  gameWorldId = gameWorld.id;
  leagueId = league.id;
  homeTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  awayTeam = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: league.id, config: {} }).then(({ dataValues }: any) => dataValues);
  game = await db.models.Game.create({ homeTeam: homeTeam.id, awayTeam: awayTeam.id, status: 'SCHEDULED' }).then(({ dataValues }: any) => dataValues);
  return gameWorld.id;
};

beforeEach(async () => { await db.sync({ force: true }); game = undefined; homePlayers = []; awayPlayers = []; duplicateError = undefined; });

autoBindSteps(feature, [({ given, when, then, and }: any) => {
  // @spec PGSW-001,PGSW-003,PGSW-004
  given('a scheduled game has complete active lineups for both teams', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId);
    awayPlayers = await createCompleteLineup(awayTeam, gameWorldId);
  });
  // @spec PGSW-004
  given('a scheduled game has complete active lineups with no bullpen', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId, false);
    awayPlayers = await createCompleteLineup(awayTeam, gameWorldId, false);
  });
  // @spec PGSW-002
  given('a scheduled game has a complete home lineup and no away lineup', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId);
  });
  // @spec PGSW-002
  given('a scheduled game has a complete home lineup and an incomplete away lineup', async () => {
    const gameWorldId = await createGame();
    homePlayers = await createCompleteLineup(homeTeam, gameWorldId);
    await createIncompleteLineup(awayTeam, gameWorldId);
  });
  // @spec PGSW-002
  given('a scheduled game has no active lineups', async () => { await createGame(); });
  // @spec PGSW-001,PGSW-002,PGSW-003,PGSW-004
  when('the game completes through single simulation', async () => { await GameFactory(game.id).simulate({ seed: 1 }); });
  // @spec PGSW-005
  when('the player game-stat writer is invoked again', async () => {
    const completed = await db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues);
    try {
      await PlayerGameStatsWriter().writeForCompletedGame({
        gameId: game.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id,
        result: { homeTeamResult: completed.homeTeamResult, awayTeamResult: completed.awayTeamResult },
      });
    } catch (error) { duplicateError = error; }
  });
  // @spec PGSW-001
  when('the game completes through batch simulation', async () => {
    const division = await db.models.Division.create({ leagueId, config: {} }).then(({ dataValues }: any) => dataValues);
    const homeSeason = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: homeTeam.id, year: 2025 }).then(({ dataValues }: any) => dataValues);
    const awaySeason = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: awayTeam.id, year: 2025 }).then(({ dataValues }: any) => dataValues);
    await db.models.DivisionSeasonGame.bulkCreate([
      { divisionSeasonId: homeSeason.id, gameId: game.id },
      { divisionSeasonId: awaySeason.id, gameId: game.id },
    ]);
    await GameFactory().simulateBatch(gameWorldId, undefined, { seed: 1 });
  });
  // @spec PGSW-001,PGSW-003,PGSW-004
  then('both teams have player game-stat rows for the game', async () => {
    // Authored path (SIM-021/022): the projection covers each side's 9-man batting order;
    // the 10th bullpen arm is a legacy-writer-only concept (see PGSW-002 scenarios, which
    // still ride the writer and assert 10 rows for the complete side).
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } })).resolves.toBe(9);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: awayPlayers.map(({ id }) => id) } })).resolves.toBe(9);
  });
  // @spec PGSW-003
  and("each team's player runs equal its completed game score", async () => {
    const completed = await db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues);
    const homeRuns = await db.models.PlayerGameStats.sum('R', { where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } });
    const awayRuns = await db.models.PlayerGameStats.sum('R', { where: { gameId: game.id, playerId: awayPlayers.map(({ id }) => id) } });
    expect(homeRuns).toBe(completed.homeTeamResult);
    expect(awayRuns).toBe(completed.awayTeamResult);
  });
  // @spec PGSW-004
  and("only each lineup's starting pitcher has GS", async () => {
    const starters = [homePlayers[0].id, awayPlayers[0].id];
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, GS: true } })).resolves.toBe(2);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: starters, GS: true } })).resolves.toBe(2);
  });
  // @spec PGSW-004 (authored path: PARP-014 — the projection accrues `outsRecorded` on the
  // single starting pitcher instead of fabricating `IP`; a no-bullpen side has exactly
  // one pitcher, so he owns every out his team recorded).
  then('each no-bullpen starter owns all pitching innings', async () => {
    for (const players of [homePlayers, awayPlayers]) {
      const rows = await db.models.PlayerGameStats.findAll({ where: { gameId: game.id, playerId: players.map(({ id }) => id) } })
        .then((result: any[]) => result.map(({ dataValues }) => dataValues));
      const starter = rows.find((row: any) => row.GS);
      expect(starter.outsRecorded).toBeGreaterThan(0);
      expect(rows.reduce((sum: number, row: any) => sum + row.outsRecorded, 0)).toBe(starter.outsRecorded);
    }
  });
  // @spec PGSW-002
  then('the completed game has player game-stat rows only for the home team', async () => {
    await expect(db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues.status)).resolves.toBe('COMPLETED');
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id, playerId: homePlayers.map(({ id }) => id) } })).resolves.toBe(10);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id } })).resolves.toBe(10);
  });
  // @spec PGSW-002
  then('the completed game has no player game-stat rows', async () => {
    await expect(db.models.Game.findByPk(game.id).then(({ dataValues }: any) => dataValues.status)).resolves.toBe('COMPLETED');
    await expect(db.models.PlayerGameStats.count({ where: { gameId: game.id } })).resolves.toBe(0);
  });
  // @spec PGSW-005
  then('the duplicate writer invocation fails', () => expect(duplicateError).toBeDefined());
}]);
