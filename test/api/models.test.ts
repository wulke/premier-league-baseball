// @spec CFG-001,CFG-002,CFG-003,CFG-004,CFG-005,CFG-006,CFG-007,CFG-008,CFG-009,CFG-010
import {
  CompetitionFormat,
  CompetitionSeriesLength,
  LeagueConfig,
  LeagueType,
  LeagueTemplates,
  STANDARD_CUP_FORMAT,
  STANDARD_LEAGUE_FORMAT,
  Stage,
  TeamPools,
  DefaultWorlds,
  GameWorldType,
  resolveCompetitionFormat,
  useDefaultGameWorld,
} from '../../src/api/models';

describe('competition format config', () => {
  it('CFG-001 resolves a division format before falling back to the league format', () => {
    // @spec CFG-001
    const leagueFormat: CompetitionFormat = STANDARD_LEAGUE_FORMAT;
    const divisionFormat: CompetitionFormat = STANDARD_CUP_FORMAT;
    const config: LeagueConfig = {
      name: 'Config League',
      type: LeagueType.League,
      format: leagueFormat,
      divisions: [
        { name: 'Inherited Division', defaultTeams: [0, 1] },
        { name: 'Override Division', defaultTeams: [2, 3], format: divisionFormat },
      ],
    };

    expect(resolveCompetitionFormat(config.divisions![0], config)).toBe(leagueFormat);
    expect(resolveCompetitionFormat(config.divisions![1], config)).toBe(divisionFormat);
  });

  it('CFG-002 and CFG-003 model the discriminated union for round-robin and knockout formats', () => {
    // @spec CFG-002,CFG-003
    const roundRobin: CompetitionFormat = {
      structure: 'ROUND_ROBIN',
      legs: 'TWO_LEG',
      seriesLength: 'Bo1',
      tiebreak: 'AGGREGATE_SCORE',
    };
    const knockout: CompetitionFormat = {
      structure: 'KNOCKOUT',
      legs: 'ONE_LEG',
      seriesLength: 'Bo3',
      seeding: 'REDRAW',
    };

    const invalidRoundRobin: CompetitionFormat = {
      structure: 'ROUND_ROBIN',
      legs: 'ONE_LEG',
      seriesLength: 'Bo1',
      // @ts-expect-error CFG-002: ROUND_ROBIN cannot set seeding
      seeding: 'FIXED',
    };

    expect(roundRobin.structure).toBe('ROUND_ROBIN');
    expect(knockout.seeding).toBe('REDRAW');
    expect(invalidRoundRobin).toBeDefined();
  });

  it('CFG-004 exposes shared standard formats and uses them in the default game world config', () => {
    // @spec CFG-004
    const defaultWorld = useDefaultGameWorld();
    const [league, cup] = defaultWorld.leagues;

    expect(STANDARD_LEAGUE_FORMAT).toEqual({
      structure: 'ROUND_ROBIN',
      legs: 'TWO_LEG',
      seriesLength: 'Bo1',
      tiebreak: 'AGGREGATE_SCORE',
    });
    expect(STANDARD_CUP_FORMAT).toEqual({
      structure: 'KNOCKOUT',
      legs: 'ONE_LEG',
      seriesLength: 'Bo3',
      seeding: 'REDRAW',
    });
    expect(league.format).toBe(STANDARD_LEAGUE_FORMAT);
    expect(cup.format).toBe(STANDARD_CUP_FORMAT);
    expect(league.divisions!.every((division) => division.format === undefined)).toBe(true);
    expect(cup.divisions!.every((division) => division.format === undefined)).toBe(true);
  });
});

// ============================================================================
// Config-surface pressure tests (#85).
//
// These prove the generalized config surface (settled by #79-#84, #95) can
// actually express the three archetypes. They assert PARSE (the typed configs
// compile), RESOLVE (stages/formats read back correctly), and DECLARED SEEDING
// (cross-stage references point at real stage ids / tier ids). They run no
// simulation — that is #87's proving slice; strict validation is #86.
// ============================================================================

// Config-surface "resolve": a seedingSelection's `fromStage` references an
// existing stage id, and (for TIERED_RANK) its `tierId` references an existing
// tier in the source stage's SWISS format. Full strictness (cycles, champion
// decidability, etc.) is #86.
const stageIdsOf = (config: LeagueConfig): Set<string> =>
  new Set((config.stages ?? []).map((s) => s.id));

const swissTierIdsOf = (config: LeagueConfig, stageId: string): Set<string> => {
  const stage = (config.stages ?? []).find((s) => s.id === stageId);
  const tiers = new Set<string>();
  for (const d of stage?.divisions ?? []) {
    if (d.format?.structure === 'SWISS') {
      for (const t of d.format.qualificationTiers) tiers.add(t.id);
    }
  }
  return tiers;
};

const declaredSeedingResolves = (config: LeagueConfig): boolean => {
  const ids = stageIdsOf(config);
  return (config.stages ?? []).every((stage) =>
    stage.divisions.every((division) => {
      const sel = division.seedingSelection;
      if (!sel) return true;
      if (!ids.has(sel.fromStage)) return false;
      if (sel.kind === 'TIERED_RANK' && !swissTierIdsOf(config, sel.fromStage).has(sel.tierId)) {
        return false;
      }
      return true;
    })
  );
};

describe('pressure-test configs (#85)', () => {
  it('CFG-005 models an ordered, grouping Stage layer above Division (old CL)', () => {
    // @spec CFG-005
    const cl = LeagueTemplates['champions-league'];
    const stages = cl.stages as Stage[];

    expect(stages.map((s) => s.id)).toEqual(['group-stage', 'knockout']); // array order = phase sequence
    // group stage = 8 round-robin divisions of 4 (home & away)
    const groups = stages[0].divisions;
    expect(groups.length).toBe(8);
    expect(groups.every((d) => d.format?.structure === 'ROUND_ROBIN')).toBe(true);
    expect(groups.every((d) => {
      const fmt = d.format;
      return fmt?.structure === 'ROUND_ROBIN' && fmt.legs === 'TWO_LEG';
    })).toBe(true);
    expect(groups.every((d) => d.defaultTeams.length === 4)).toBe(true);
  });

  it('CFG-007 declares cross-stage seeding — old CL seeds its KO from the group stage (TOP_N_PER_DIVISION)', () => {
    // @spec CFG-007
    const cl = LeagueTemplates['champions-league'];
    const knockout = cl.stages![1].divisions[0];

    // a cross-stage-seeded division owns no pool allocation — its teams arrive
    // from another stage's output (the literal pressure-test finding).
    expect(knockout.defaultTeams).toEqual([]);
    expect(knockout.seedingSelection).toEqual({
      kind: 'TOP_N_PER_DIVISION',
      fromStage: 'group-stage',
      topN: 2,
    });
    expect(knockout.isTopTier).toBe(true); // #81: the deciding KO division is champion-producing
    expect(declaredSeedingResolves(cl)).toBe(true);
  });

  it('CFG-006 models the SWISS structure arm with partitioning qualification tiers (new CL)', () => {
    // @spec CFG-006
    const swiss = LeagueTemplates['champions-league-swiss'];
    const leaguePhase = swiss.stages![0].divisions[0];

    expect(leaguePhase.format?.structure).toBe('SWISS');
    const swissFmt = leaguePhase.format;
    expect(swissFmt?.structure === 'SWISS' && swissFmt.gamesPerTeam === 8).toBe(true);
    // tiers partition the field 1..36 with an explicit eliminated tier
    const tiers = swissFmt?.structure === 'SWISS' ? swissFmt.qualificationTiers : [];
    expect(tiers.map((t) => t.id)).toEqual(['direct', 'playoff', 'eliminated']);
    expect(tiers[0].rankRange).toEqual([1, 8]);
    expect(tiers[1].rankRange).toEqual([9, 24]);
    expect(tiers[2].rankRange).toEqual([25, 36]);

    // SWISS carries no legs/winsToAdvance — type-level (no consumer reads them)
    const invalidSwiss: CompetitionFormat = {
      structure: 'SWISS',
      gamesPerTeam: 8,
      qualificationTiers: [{ id: 'x', rankRange: [1, 1] }],
      // @ts-expect-error CFG-006: SWISS carries no legs
      legs: 'TWO_LEG',
    };
    expect(invalidSwiss).toBeDefined();
  });

  it('CFG-007 declares cross-stage seeding — new CL seeds its KO by tier rank (TIERED_RANK)', () => {
    // @spec CFG-007
    const swiss = LeagueTemplates['champions-league-swiss'];
    const knockout = swiss.stages![1].divisions[0];

    expect(knockout.seedingSelection).toEqual({
      kind: 'TIERED_RANK',
      fromStage: 'league-phase',
      tierId: 'playoff',
    });
    expect(declaredSeedingResolves(swiss)).toBe(true);
  });

  it('CFG-008 carries a conference producer label on divisions (MLB)', () => {
    // @spec CFG-008
    const mlb = LeagueTemplates['mlb'];
    const regular = mlb.stages![0].divisions;

    expect(regular.length).toBe(6); // AL/NL × 3 divisions × 5 teams
    expect(regular.filter((d) => d.conference === 'AL').length).toBe(3);
    expect(regular.filter((d) => d.conference === 'NL').length).toBe(3);
    expect(regular.every((d) => d.defaultTeams.length === 5)).toBe(true);
  });

  it('CFG-009 supports best-of-N series lengths including Bo7 (MLB postseason)', () => {
    // @spec CFG-009
    const mlb = LeagueTemplates['mlb'];
    const postseason = mlb.stages![1].divisions;
    const byName = Object.fromEntries(postseason.map((d) => [d.name, d]));

    expect(['Bo1', 'Bo3', 'Bo5', 'Bo7']).toContain('Bo7' as CompetitionSeriesLength);
    const assertKoSeries = (name: string, len: string) => {
      const fmt = byName[name].format;
      expect(fmt?.structure === 'KNOCKOUT' && fmt.seriesLength === len).toBe(true);
    };
    assertKoSeries('AL Wild Card', 'Bo3');
    assertKoSeries('AL Bracket', 'Bo7');   // LCS
    assertKoSeries('World Series', 'Bo7');
    expect(byName['World Series'].isTopTier).toBe(true);
  });

  it('CFG-007 declares cross-stage seeding — MLB wild cards are best-of-rest per conference (BEST_OF_REST)', () => {
    // @spec CFG-007
    const mlb = LeagueTemplates['mlb'];
    const postseason = mlb.stages![1].divisions;
    const alWildCard = postseason.find((d) => d.name === 'AL Wild Card')!;

    expect(alWildCard.seedingSelection).toEqual({
      kind: 'BEST_OF_REST',
      fromStage: 'regular-season',
      count: 3,
      excluding: 'DIVISION_WINNERS',
      conference: 'AL',
    });
    expect(declaredSeedingResolves(mlb)).toBe(true);
  });

  it('CFG-010 houses league configs and team pools in named registries decoupled from GameWorldType', () => {
    // @spec CFG-010
    expect(Object.keys(LeagueTemplates).sort()).toEqual(
      ['champions-league', 'champions-league-swiss', 'league-cup', 'mlb', 'premier-league']
    );
    expect(TeamPools['england-44'].length).toBe(44);
    expect(DefaultWorlds[GameWorldType.PremierLeague]).toEqual({
      teamPool: 'england-44',
      leagues: ['premier-league', 'league-cup'],
    });

    // new-CL + MLB are registry-only — they are not runnable worlds (no GameWorldType)
    expect(DefaultWorlds[GameWorldType.PremierLeague].leagues).not.toContain('champions-league-swiss');
    expect(DefaultWorlds[GameWorldType.PremierLeague].leagues).not.toContain('mlb');
  });

  it('CFG-010 composes a runnable world from the registries unchanged from the legacy shape', () => {
    // @spec CFG-010
    const world = useDefaultGameWorld();
    expect(world.leagues.map((l) => l.name)).toEqual(['Premier League', 'League Cup']);
    expect(world.teams.length).toBe(44);
    // the relocated premier-league template still carries its divisions + league-level format
    expect(world.leagues[0].divisions!.map((d) => d.name)).toEqual(['Premier League', 'Championship']);
  });
});
