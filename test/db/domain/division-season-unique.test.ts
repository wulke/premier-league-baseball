// @spec DSU-001,DSU-002,DSU-003  (division-season year-scoped uniqueness)
import { LeagueConfig, LeagueType } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';

const ONE_LEG_ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  winsToAdvance: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

/**
 * #275 regression suite. The `belongsToMany` through-table declarations used to make
 * Sequelize emit a table-level UNIQUE (divisionId, teamId) — without year — blocking
 * multi-season participation and crashing every second `newSeason` rollover.
 */
describe('DivisionSeason year-scoped uniqueness', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec DSU-001
  it('synced DivisionSeasons DDL has no table-level UNIQUE (divisionId, teamId); composite index is the sole unique constraint', async () => {
    const [tables] = await db.query(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'DivisionSeasons'"
    );
    const createTableSql = (tables as Array<{ sql: string }>)[0]?.sql ?? '';
    expect(createTableSql).not.toMatch(/UNIQUE\s*\(/i);

    const [indexes] = await db.query('PRAGMA index_list(`DivisionSeasons`)');
    const uniqueIndexes = (indexes as Array<{ name: string; unique: number; origin: string }>)
      .filter((idx) => idx.unique === 1);
    expect(uniqueIndexes).toHaveLength(1);

    const composite = uniqueIndexes[0];
    expect(composite.origin).toBe('c'); // CREATE INDEX, not a table-level constraint
    const [columns] = await db.query(`PRAGMA index_info(\`${composite.name}\`)`);
    expect((columns as Array<{ name: string }>).map((c) => c.name))
      .toEqual(['divisionId', 'teamId', 'year']);
  });

  // @spec DSU-002
  it('persists DivisionSeason rows for the same team and division across two different years', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
    const team = await TeamFactory().create(gw.id, { name: 'Returning Team' });
    const league = await LeagueFactory().create(gw.id, {
      name: 'Two-Season League',
      type: LeagueType.League,
      stages: [{ id: 'default', name: 'Default', divisions: [{
        name: 'Two-Season Division',
        defaultTeams: [0],
        isTopTier: true,
        format: ONE_LEG_ROUND_ROBIN_FORMAT,
      }] }]
    } as LeagueConfig, [team.id]);
    const divisionId = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((l) => { if (!l) throw Error(); return l.dataValues; })
      .then(({ Divisions }) => Divisions[0].id);

    await db.models.DivisionSeason.create({ divisionId, teamId: team.id, year: 2024 });
    // The exact case that hit the constraint during the LRD-004 backfill:
    await db.models.DivisionSeason.create({ divisionId, teamId: team.id, year: 2025 });

    const rows = await db.models.DivisionSeason.findAll({
      where: { divisionId, teamId: team.id },
      order: [['year', 'ASC']],
    }).then((rs) => rs.map((r) => r.dataValues));
    expect(rows.map(({ year }) => year)).toEqual([2024, 2025]);

    // The composite (divisionId, teamId, year) constraint still holds within one year.
    await expect(
      db.models.DivisionSeason.create({ divisionId, teamId: team.id, year: 2025 })
    ).rejects.toThrow();
  });

  // @spec DSU-003
  it('runs a season rollover twice for a returning team without a constraint error', async () => {
    const gw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
    const teams = await Promise.all([0, 1, 2, 3].map((i) =>
      TeamFactory().create(gw.id, { name: `Rollover Team ${i}` })
    ));
    const league = await LeagueFactory().create(gw.id, {
      name: 'Rollover League',
      type: LeagueType.League,
      stages: [{ id: 'default', name: 'Default', divisions: [{
        name: 'Rollover Division',
        defaultTeams: [0, 1, 2, 3],
        isTopTier: true,
        format: ONE_LEG_ROUND_ROBIN_FORMAT,
      }] }]
    } as LeagueConfig, teams.map(({ id }) => id));
    const divisionId = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((l) => { if (!l) throw Error(); return l.dataValues; })
      .then(({ Divisions }) => Divisions[0].id);

    // First season (gw.year + 1).
    await DivisionFactory(divisionId).newSeason(gw.year);

    // Complete the season so the rollover precondition holds.
    await db.models.Game.update(
      { homeTeamResult: 1, awayTeamResult: 0, status: 'COMPLETED' },
      { where: { homeTeamResult: null } }
    );

    // Second season (gw.year + 2) for the same teams in the same division —
    // used to raise SequelizeUniqueConstraintError.
    const secondSeason = await DivisionFactory(divisionId).newSeason(gw.year + 1);

    expect(secondSeason.map(({ year }) => year)).toEqual(
      Array(secondSeason.length).fill(gw.year + 2)
    );
    for (const { teamId } of secondSeason) {
      const years = await db.models.DivisionSeason.findAll({
        where: { divisionId, teamId },
      }).then((rs) => rs.map((r) => r.dataValues.year).sort());
      expect(years).toEqual([gw.year + 1, gw.year + 2]);
    }
  });
});
