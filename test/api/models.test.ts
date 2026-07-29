
// @spec CFG-001,CFG-002,CFG-003,CFG-004
import {
  CompetitionFormat,
  LeagueConfig,
  LeagueType,
  STANDARD_CUP_FORMAT,
  STANDARD_LEAGUE_FORMAT,
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

    expect(resolveCompetitionFormat(config.divisions[0], config)).toBe(leagueFormat);
    expect(resolveCompetitionFormat(config.divisions[1], config)).toBe(divisionFormat);
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

    // @ts-expect-error CFG-002: ROUND_ROBIN cannot set seeding
    const invalidRoundRobin: CompetitionFormat = {
      structure: 'ROUND_ROBIN',
      legs: 'ONE_LEG',
      seriesLength: 'Bo1',
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
    expect(league.divisions.every((division) => division.format === undefined)).toBe(true);
    expect(cup.divisions.every((division) => division.format === undefined)).toBe(true);
  });
});
