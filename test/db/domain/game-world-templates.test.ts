// @spec GWT-001,GWT-002,GWT-003 — pickable old Champions League world acceptance
import db from '../../../src/db/client';
import { GameWorldFactory, LeagueFactory } from '../../../src/db/domain';
import { GameFactory } from '../../../src/db/domain/game';
import {
  DefaultWorlds,
  GameWorldType,
  LeagueTemplates,
  TeamPools,
  useDefaultGameWorld,
  validateLeagueConfig,
} from '../../../src/api/models';

describe('pickable old Champions League game world (#87)', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec GWT-001
  it('declares a ChampionsLeague world backed by a 32-team pool and an exhaustive DefaultWorlds', () => {
    // enum arm exists
    expect(GameWorldType.ChampionsLeague).toBeDefined();
    // pool sized to the group divisions' largest index set (0..31)
    expect(TeamPools['europe-32']).toHaveLength(32);
    // bundle present
    const bundle = DefaultWorlds[GameWorldType.ChampionsLeague];
    expect(bundle.teamPool).toBe('europe-32');
    expect(bundle.leagues).toEqual(['champions-league']);
    // DefaultWorlds is exhaustive over the enum: only runnable worlds are listed
    expect(Object.keys(DefaultWorlds).sort()).toEqual(
      [GameWorldType.PremierLeague, GameWorldType.ChampionsLeague].sort(),
    );
  });

  // @spec GWT-002
  it('accepts the existing champions-league template through validateLeagueConfig unchanged', () => {
    const template = LeagueTemplates['champions-league'];
    expect(template.stages).toHaveLength(2);
    // 8 group divisions reference pool indices 0..31
    const groups = template.stages[0].divisions;
    expect(groups).toHaveLength(8);
    expect(groups.flatMap((d) => d.defaultTeams)).toEqual([...Array(32).keys()]);
    // the knockout division owns no pool — its teams arrive via TOP_N_PER_DIVISION
    const knockout = template.stages[1].divisions[0];
    expect(knockout.defaultTeams).toEqual([]);
    expect(knockout.seedingSelection).toEqual({ kind: 'TOP_N_PER_DIVISION', fromStage: 'group-stage', topN: 2 });
    expect(knockout.isTopTier).toBe(true);
    // the real template passes the static guard with no edits
    expect(() => validateLeagueConfig(template)).not.toThrow();
  });

  // @spec GWT-003 — the proving slice: build from the real bundle, not an inline config
  it('rapid-simulates the Champions League bundle to a single knockout champion', async () => {
    const bundle = useDefaultGameWorld(GameWorldType.ChampionsLeague);
    const created = await GameWorldFactory().create(bundle);
    const gwId = created.id;
    const league = created.leagues[0];

    await LeagueFactory(league.id).start();
    await GameFactory().rapidSimulateSeason(gwId);

    const divisions = await db.models.Division.findAll({ where: { leagueId: league.id } });
    const knockout = divisions.find((d: any) => d.dataValues.config.isTopTier)!;
    // exactly one champion, recorded on the final-stage knockout division (MSS-008)
    expect(await db.models.SeasonResult.count({
      where: { divisionId: knockout.dataValues.id, year: league.year },
    })).toBe(1);
    // no intermediate stage records a champion
    expect(await db.models.SeasonResult.count({ where: { year: league.year } })).toBe(1);
    // the whole League is decided
    expect(await LeagueFactory(league.id).isSeasonComplete(league.year)).toBe(true);
  }, 60000);
});
