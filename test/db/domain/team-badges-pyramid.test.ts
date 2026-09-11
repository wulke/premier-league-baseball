// @spec BADGE-004,BADGE-005,BADGE-006,BADGE-007,BADGE-008,BADGE-009
// BADGE-001,BADGE-002,BADGE-003,BADGE-010,BADGE-011 are offline-tool/network/build-step
// behavior (tools/fetch-team-badges.ts, package.json build) — not mechanically assertable
// here without a network call; verified manually per team-badges-pyramid-specs.md.
import { LeagueTemplates, TeamPools, validateLeagueConfig } from '../../../src/api/models';

describe('real English pyramid pool & badge config (team-badges-pyramid)', () => {
  // @spec BADGE-009
  it('has exactly 92 real clubs in england-92', () => {
    expect(TeamPools['england-92']).toHaveLength(92);
  });

  // @spec BADGE-004
  it('has no duplicate keys within england-92', () => {
    const keys = TeamPools['england-92'].map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // @spec BADGE-007,BADGE-008
  it('computes badge as /badges/<key>.png for every keyed entry, leaving other pools untouched', () => {
    TeamPools['england-92'].forEach((team) => {
      expect(team.key).toBeDefined();
      expect(team.badge).toBe(`/badges/${team.key}.png`);
    });
    // europe-32 predates key/badge and stays name-only — compiles/behaves unchanged.
    TeamPools['europe-32'].forEach((team) => {
      expect(team.key).toBeUndefined();
      expect(team.badge).toBeUndefined();
    });
  });

  // @spec BADGE-006
  it('slices the premier-league template into 4 contiguous, non-overlapping divisions over [0, 92)', () => {
    const divisions = LeagueTemplates['premier-league'].stages[0].divisions;
    expect(divisions).toHaveLength(4);

    const ranges = divisions.map((d) => d.defaultTeams as number[]);
    const flattened = ranges.flat().slice().sort((a, b) => a - b);
    expect(flattened).toEqual([...Array(92).keys()]);

    const topTierDivisions = divisions.filter((d) => d.isTopTier);
    expect(topTierDivisions).toHaveLength(1);
    expect(topTierDivisions[0].name).toBe(divisions[0].name);
  });

  // @spec BADGE-005
  it('widens the league-cup template to all 92 teams and still validates', () => {
    const cupDivision = LeagueTemplates['league-cup'].stages[0].divisions[0];
    expect(cupDivision.defaultTeams).toHaveLength(92);
    expect(() => validateLeagueConfig(LeagueTemplates['league-cup'])).not.toThrow();
    expect(() => validateLeagueConfig(LeagueTemplates['premier-league'])).not.toThrow();
  });
});
