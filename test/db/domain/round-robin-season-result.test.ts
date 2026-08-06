// @spec LCH-001,LCH-002,LCH-003,LCH-004 (round-robin SeasonResult champion recording)

import { DefaultStandingsConfig, LeagueType } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, GameFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';
import { resolveRoundRobinGameCompletion } from '../../../src/db/domain/season-result';

const ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  winsToAdvance: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const setupLeague = async () => {
  const gw = await db.models.GameWorld.create({ config: {} }).then((row) => row.dataValues);
  const teams = await Promise.all(
    ['Premier A', 'Premier B', 'Championship A', 'Championship B']
      .map((name) => TeamFactory().create(gw.id, { name }))
  );

  const league = await LeagueFactory().create(gw.id, {
    name: 'Promotion Pyramid',
    type: LeagueType.League,
    stages: [{ id: "default", name: "Default", divisions: [
      {
        name: 'Premier Division',
        defaultTeams: [0, 1],
        format: ROUND_ROBIN_FORMAT,
        isTopTier: true,
      },
      {
        name: 'Championship',
        defaultTeams: [2, 3],
        format: ROUND_ROBIN_FORMAT,
        isTopTier: false,
      },
    ] }],
  }, teams.map(({ id }) => id));

  const divisions = await db.models.League.findByPk(league.id, { include: db.models.Division })
    .then((row) => {
      if (!row) throw Error('league not found');
      return row.dataValues.Divisions.map(({ dataValues }) => dataValues);
    });

  await LeagueFactory(league.id).newSeason(gw.year);

  const year = gw.year + 1;
  const topTierDivision = divisions.find((division) => division.config.isTopTier === true);
  const lowerDivision = divisions.find((division) => division.config.name === 'Championship');
  if (!topTierDivision || !lowerDivision) throw Error('divisions not found');

  const getDivisionGames = async (divisionId: number) => {
    const seasons = await db.models.DivisionSeason.findAll({
      where: { divisionId, year },
      include: [{ model: db.models.Game, through: { attributes: [] } }],
    });
    const seen = new Set<number>();
    return seasons
      .flatMap((season) => (season.dataValues.Games ?? []) as any[])
      .filter((game) => {
        if (seen.has(game.id)) return false;
        seen.add(game.id);
        return true;
      })
      .sort((a, b) => a.id - b.id);
  };

  return {
    gw,
    league,
    year,
    topTierDivision,
    lowerDivision,
    topTierGame: (await getDivisionGames(topTierDivision.id))[0],
    lowerTierGame: (await getDivisionGames(lowerDivision.id))[0],
  };
};

describe('Round-robin SeasonResult recording (LCH-001..004)', () => {
  beforeEach(async () => { await db.sync({ force: true }); });
  afterEach(() => { jest.restoreAllMocks(); });

  // @spec LCH-001
  it('@spec LCH-001 persists a top-tier marker on the champion-producing round-robin division', async () => {
    const { topTierDivision, lowerDivision } = await setupLeague();

    expect(topTierDivision.config.isTopTier).toBe(true);
    expect(lowerDivision.config.isTopTier).toBe(false);
  });

  // @spec LCH-002 @spec LCH-003
  it('@spec LCH-002 @spec LCH-003 writes a SeasonResult only for the top-tier division when both round-robin divisions finish', async () => {
    const { gw, year, topTierDivision, lowerDivision } = await setupLeague();
    let i = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      const draws = [0.5, 0, 0.5, 0];
      const value = draws[i] ?? 0;
      i += 1;
      return value;
    });

    await GameFactory().simulateBatch(gw.id, '2030-01-01');

    const topTierChampion = await db.models.SeasonResult.findOne({
      where: { divisionId: topTierDivision.id, year },
    });
    const lowerTierChampion = await db.models.SeasonResult.findOne({
      where: { divisionId: lowerDivision.id, year },
    });
    const standings = await DivisionFactory(topTierDivision.id).getStandings(year, DefaultStandingsConfig);

    expect(topTierChampion?.dataValues.championTeamId).toBe(standings[0].teamId);
    expect(lowerTierChampion).toBeNull();
  });

  // @spec LCH-004
  it('@spec LCH-004 does not duplicate or overwrite a champion row when a decided top-tier division is re-checked', async () => {
    const { gw, year, topTierDivision, topTierGame } = await setupLeague();
    let i = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      const draws = [0.5, 0, 0.5, 0];
      const value = draws[i] ?? 0;
      i += 1;
      return value;
    });

    await GameFactory().simulateBatch(gw.id, '2030-01-01');
    const champion = await db.models.SeasonResult.findOne({
      where: { divisionId: topTierDivision.id, year },
    });

    await resolveRoundRobinGameCompletion(topTierGame.id);

    const rows = await db.models.SeasonResult.findAll({
      where: { divisionId: topTierDivision.id, year },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].dataValues.championTeamId).toBe(champion?.dataValues.championTeamId);
  });
});
