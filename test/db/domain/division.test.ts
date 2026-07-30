import { DefaultStandingsConfig, LeagueConfig, LeagueType, TeamConfig } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';

const ONE_LEG_ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const TWO_LEG_ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'TWO_LEG' as const,
  seriesLength: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const ONE_LEG_KNOCKOUT_FIXED_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  seeding: 'FIXED' as const,
};

const ONE_LEG_KNOCKOUT_REDRAW_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  seeding: 'REDRAW' as const,
};

const TWO_LEG_KNOCKOUT_FIXED_FORMAT = {
  structure: 'KNOCKOUT' as const,
  legs: 'TWO_LEG' as const,
  seriesLength: 'Bo1' as const,
  seeding: 'FIXED' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

describe('DivisionFactory', () => {
  let gw;
  const teamConfigs: TeamConfig[] = [...Array(10).keys()]
    .map((id) => ({ name: `Team ${id}` }));
  const leagueConfig: LeagueConfig = {
    name: 'Test League',
    type: LeagueType.League,
    divisions: [
      {
        name: 'Test Division',
        defaultTeams: [...Array(teamConfigs.length).keys()],
        format: TWO_LEG_ROUND_ROBIN_FORMAT,
      }
    ]
  };

  beforeAll(async () => {
    await db.sync({ force: true });
    gw = await db.models.GameWorld.create({ config: {} });
  });

  it('newSeason: initial year', async () => {
    // create generic league and teams
    const teams = await Promise.all(teamConfigs.map(async (teamConfig) => await TeamFactory().create(gw.id, teamConfig)));
    const league = await LeagueFactory().create(gw.id, leagueConfig, teams.map(({ id }) => id));
    // divisions
    const divisionIds = await db.models.League.findByPk(league.id, { include: db.models.Division })
      .then((league) => { if (!league) throw Error(); return league.dataValues })
      .then(({ Divisions }) => Divisions.map(({ id }) => id));
    expect(divisionIds.length).toStrictEqual(leagueConfig.divisions.length);

    let id = divisionIds[0];
    await DivisionFactory(id).newSeason(gw.year);
    let d = await db.models.Division.findByPk(id, { include: db.models.DivisionSeason })
      .then((division) => { if (!division) throw Error(); return division.dataValues });
    // console.debug(d);
    expect(d.DivisionSeasons.length).toStrictEqual(leagueConfig.divisions[0].defaultTeams.length);
    
    let divisionSeasons = d.DivisionSeasons.map(({ dataValues }) => dataValues);
    expect(divisionSeasons.every(({ divisionId, year, teamId}) =>
      year === gw.year + 1 && divisionId === id && teams.map(({ id }) => id).includes(teamId)
    )).toBeTruthy();

    // Games + DivisionSeasonGames
    // tests???
  });

  it('getStandings: returns correct standings ordered by points', async () => {
    // Create a fresh game world, teams, league, and division
    const sgw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
    const sgwTeams = await Promise.all(
      [{ name: 'Alpha' }, { name: 'Beta' }, { name: 'Gamma' }].map((cfg) =>
        TeamFactory().create(sgw.id, cfg)
      )
    );
    const sgLeagueConfig: LeagueConfig = {
      name: 'Standings Test League',
      type: LeagueType.League,
      divisions: [{
        name: 'Standings Division',
        defaultTeams: [...Array(sgwTeams.length).keys()],
        format: ONE_LEG_ROUND_ROBIN_FORMAT,
      }]
    };
    const sgLeague = await LeagueFactory().create(sgw.id, sgLeagueConfig, sgwTeams.map(({ id }) => id));
    const sgDivisionIds = await db.models.League.findByPk(sgLeague.id, { include: db.models.Division })
      .then((l) => { if (!l) throw Error(); return l.dataValues; })
      .then(({ Divisions }) => Divisions.map(({ id }) => id));
    const divId = sgDivisionIds[0];
    const year = sgw.year + 1;

    // Create DivisionSeason entries
    const divSeasons = await db.models.DivisionSeason.bulkCreate(
      sgwTeams.map(({ id: teamId }) => ({ divisionId: divId, teamId, year }))
    ).then((rows) => rows.map(({ dataValues }) => dataValues));

    const [alpha, beta, gamma] = sgwTeams;
    const dsAlpha = divSeasons.find((ds) => ds.teamId === alpha.id)!;
    const dsBeta = divSeasons.find((ds) => ds.teamId === beta.id)!;
    const dsGamma = divSeasons.find((ds) => ds.teamId === gamma.id)!;

    // Alpha 3-0 Beta (Alpha wins), Beta 1-0 Gamma (Beta wins), Alpha 2-1 Gamma (Alpha wins)
    const gameDefs = [
      { homeTeam: alpha.id, awayTeam: beta.id, homeTeamResult: 3, awayTeamResult: 0, dsPairs: [dsAlpha.id, dsBeta.id] },
      { homeTeam: beta.id, awayTeam: gamma.id, homeTeamResult: 1, awayTeamResult: 0, dsPairs: [dsBeta.id, dsGamma.id] },
      { homeTeam: alpha.id, awayTeam: gamma.id, homeTeamResult: 2, awayTeamResult: 1, dsPairs: [dsAlpha.id, dsGamma.id] },
    ];

    for (const def of gameDefs) {
      const game = await db.models.Game.create({
        homeTeam: def.homeTeam,
        awayTeam: def.awayTeam,
        homeTeamResult: def.homeTeamResult,
        awayTeamResult: def.awayTeamResult,
      }).then(({ dataValues }) => dataValues);
      await db.models.DivisionSeasonGame.bulkCreate(
        def.dsPairs.map((divisionSeasonId) => ({ gameId: game.id, divisionSeasonId }))
      );
    }

    const standings = await DivisionFactory(divId).getStandings(year, DefaultStandingsConfig);

    // Alpha: 2W 0D 0L → 6pts, RF=5, RA=1, RD=4
    // Beta: 1W 0D 1L → 3pts, RF=1, RA=3, RD=-2
    // Gamma: 0W 0D 2L → 0pts, RF=1, RA=3, RD=-2
    expect(standings).toHaveLength(3);
    expect(standings[0].teamName).toBe('Alpha');
    expect(standings[0].won).toBe(2);
    expect(standings[0].points).toBe(6);
    expect(standings[0].runDifference).toBe(4);

    expect(standings[1].teamName).toBe('Beta');
    expect(standings[1].won).toBe(1);
    expect(standings[1].points).toBe(3);

    expect(standings[2].teamName).toBe('Gamma');
    expect(standings[2].won).toBe(0);
    expect(standings[2].points).toBe(0);
  });

  describe('schedule generation', () => {
    const getScheduledGames = async (divId: number, year: number) => {
      const seasons = await db.models.DivisionSeason.findAll({
        where: { divisionId: divId, year },
        include: [{ model: db.models.Game, through: { attributes: [] } }]
      });
      const seen = new Set<number>();
      return seasons
        .flatMap((ds) => (ds.dataValues.Games ?? []) as any[])
        .filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
    };

    describe('ONE_LEG ROUND_ROBIN', () => {
      let sgDivId: number;
      let sgYear: number;
      const N = 4;

      beforeAll(async () => {
        const sgGw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
        const sgTeams = await Promise.all(
          [...Array(N).keys()].map((i) => TeamFactory().create(sgGw.id, { name: `OL Team ${i}` }))
        );
        const sgLeague = await LeagueFactory().create(sgGw.id, {
          name: 'ONE_LEG Schedule League',
          type: LeagueType.League,
          divisions: [{
            name: 'ONE_LEG Division',
            defaultTeams: [...Array(N).keys()],
            format: ONE_LEG_ROUND_ROBIN_FORMAT,
          }]
        }, sgTeams.map(({ id }) => id));
        sgDivId = await db.models.League.findByPk(sgLeague.id, { include: db.models.Division })
          .then((l) => { if (!l) throw Error(); return l.dataValues.Divisions[0].id; });
        sgYear = sgGw.year;
        await DivisionFactory(sgDivId).newSeason(sgYear);
        sgYear = sgYear + 1;
      });

      it('total games = N*(N-1)/2 = 6', async () => {
        const games = await getScheduledGames(sgDivId, sgYear);
        expect(games).toHaveLength(N * (N - 1) / 2);
      });

      it('no duplicate (homeTeam, awayTeam) ordered pairs', async () => {
        const games = await getScheduledGames(sgDivId, sgYear);
        const pairs = games.map((g) => `${g.homeTeam}-${g.awayTeam}`);
        expect(new Set(pairs).size).toBe(pairs.length);
      });

      it('each unordered pair appears exactly once', async () => {
        const games = await getScheduledGames(sgDivId, sgYear);
        const pairCounts = new Map<string, number>();
        for (const g of games) {
          const key = [g.homeTeam, g.awayTeam].sort().join('-');
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
        for (const count of pairCounts.values()) {
          expect(count).toBe(1);
        }
      });

      it('each team appears in exactly N-1 = 3 games total', async () => {
        const games = await getScheduledGames(sgDivId, sgYear);
        const teamCounts = new Map<number, number>();
        for (const g of games) {
          teamCounts.set(g.homeTeam, (teamCounts.get(g.homeTeam) ?? 0) + 1);
          teamCounts.set(g.awayTeam, (teamCounts.get(g.awayTeam) ?? 0) + 1);
        }
        for (const count of teamCounts.values()) {
          expect(count).toBe(N - 1);
        }
      });
    });

    describe('TWO_LEG ROUND_ROBIN', () => {
      let tlDivId: number;
      let tlYear: number;
      const N = 4;

      beforeAll(async () => {
        const tlGw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
        const tlTeams = await Promise.all(
          [...Array(N).keys()].map((i) => TeamFactory().create(tlGw.id, { name: `TL Team ${i}` }))
        );
        const tlLeague = await LeagueFactory().create(tlGw.id, {
          name: 'TWO_LEG Schedule League',
          type: LeagueType.League,
          divisions: [{
            name: 'TWO_LEG Division',
            defaultTeams: [...Array(N).keys()],
            format: TWO_LEG_ROUND_ROBIN_FORMAT,
          }]
        }, tlTeams.map(({ id }) => id));
        tlDivId = await db.models.League.findByPk(tlLeague.id, { include: db.models.Division })
          .then((l) => { if (!l) throw Error(); return l.dataValues.Divisions[0].id; });
        tlYear = tlGw.year;
        await DivisionFactory(tlDivId).newSeason(tlYear);
        tlYear = tlYear + 1;
      });

      it('total games = N*(N-1) = 12', async () => {
        const games = await getScheduledGames(tlDivId, tlYear);
        expect(games).toHaveLength(N * (N - 1));
      });

      it('each ordered pair (homeTeam, awayTeam) appears exactly once', async () => {
        const games = await getScheduledGames(tlDivId, tlYear);
        const pairCounts = new Map<string, number>();
        for (const g of games) {
          const key = `${g.homeTeam}-${g.awayTeam}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
        for (const count of pairCounts.values()) {
          expect(count).toBe(1);
        }
      });

      it('each team plays exactly N-1 = 3 home games and N-1 = 3 away games', async () => {
        const games = await getScheduledGames(tlDivId, tlYear);
        const homeCounts = new Map<number, number>();
        const awayCounts = new Map<number, number>();
        for (const g of games) {
          homeCounts.set(g.homeTeam, (homeCounts.get(g.homeTeam) ?? 0) + 1);
          awayCounts.set(g.awayTeam, (awayCounts.get(g.awayTeam) ?? 0) + 1);
        }
        for (const count of homeCounts.values()) {
          expect(count).toBe(N - 1);
        }
        for (const count of awayCounts.values()) {
          expect(count).toBe(N - 1);
        }
      });
    });

    describe('ONE_LEG KNOCKOUT', () => {
      const createKnockoutSeason = async ({
        teamCount,
        format,
      }: {
        teamCount: number;
        format:
          | typeof ONE_LEG_KNOCKOUT_FIXED_FORMAT
          | typeof ONE_LEG_KNOCKOUT_REDRAW_FORMAT
          | typeof TWO_LEG_KNOCKOUT_FIXED_FORMAT;
      }) => {
        const knockoutGw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
        const knockoutTeams = await Promise.all(
          [...Array(teamCount).keys()].map((i) => TeamFactory().create(knockoutGw.id, { name: `KO Team ${i}` }))
        );
        const knockoutLeague = await LeagueFactory().create(knockoutGw.id, {
          name: `${format.seeding} Knockout League`,
          type: LeagueType.LeagueCup,
          divisions: [{
            name: '1st Round',
            defaultTeams: [...Array(teamCount).keys()],
            format,
          }]
        }, knockoutTeams.map(({ id }) => id));
        const knockoutDivId = await db.models.League.findByPk(knockoutLeague.id, { include: db.models.Division })
          .then((l) => { if (!l) throw Error(); return l.dataValues.Divisions[0].id; });
        const currentYear = knockoutGw.year;

        await DivisionFactory(knockoutDivId).newSeason(currentYear);

        const year = currentYear + 1;
        const games = await getScheduledGames(knockoutDivId, year);
        const divisionSeasons = await db.models.DivisionSeason.findAll({
          where: { divisionId: knockoutDivId, year },
          order: [['bracketSlot', 'ASC']]
        }).then((rows) => rows.map(({ dataValues }) => dataValues));

        return { games, divisionSeasons, teams: knockoutTeams, leagueId: knockoutLeague.id, gwId: knockoutGw.id, year };
      };

      // @spec CUP-009,CUP-010
      it('@spec CUP-009 @spec CUP-010 creates 12 round-1 ties and 20 completed byes for a 44-team fixed bracket', async () => {
        const { games, divisionSeasons } = await createKnockoutSeason({
          teamCount: 44,
          format: ONE_LEG_KNOCKOUT_FIXED_FORMAT,
        });

        const roundOneGames = games.filter((game) => game.round === 1);
        const byes = roundOneGames.filter((game) => game.awayTeam === null);
        const ties = roundOneGames.filter((game) => game.awayTeam !== null);

        expect(roundOneGames).toHaveLength(32);
        expect(ties).toHaveLength(12);
        expect(byes).toHaveLength(20);
        expect(byes.every((game) =>
          game.status === 'COMPLETED' &&
          game.homeTeamResult !== null &&
          game.awayTeamResult === null
        )).toBe(true);

        const topSeeds = divisionSeasons.slice(0, 20).map((season) => season.teamId);
        expect(byes.map((game) => game.homeTeam)).toEqual(topSeeds);
      });

      // @spec CUP-009
      it.each([
        { teamCount: 3, expectedTies: 1, expectedByes: 1 },
        { teamCount: 5, expectedTies: 1, expectedByes: 3 },
        { teamCount: 11, expectedTies: 3, expectedByes: 5 },
      ])('@spec CUP-009 reduces a $teamCount-team field without dropping any team', async ({
        teamCount,
        expectedTies,
        expectedByes,
      }) => {
        const { games, teams } = await createKnockoutSeason({
          teamCount,
          format: ONE_LEG_KNOCKOUT_FIXED_FORMAT,
        });

        const roundOneGames = games.filter((game) => game.round === 1);
        const byes = roundOneGames.filter((game) => game.awayTeam === null);
        const ties = roundOneGames.filter((game) => game.awayTeam !== null);
        const participatingTeams = roundOneGames.flatMap((game) => [game.homeTeam, game.awayTeam]).filter((teamId) => teamId !== null);

        expect(ties).toHaveLength(expectedTies);
        expect(byes).toHaveLength(expectedByes);
        expect(participatingTeams).toHaveLength(teamCount);
        expect(new Set(participatingTeams)).toEqual(new Set(teams.map(({ id }) => id)));
      });

      // @spec CUP-010
      it('@spec CUP-010 gives fixed-bracket byes to the top seeds only', async () => {
        const { games, divisionSeasons } = await createKnockoutSeason({
          teamCount: 11,
          format: ONE_LEG_KNOCKOUT_FIXED_FORMAT,
        });

        const roundOneByes = games
          .filter((game) => game.round === 1 && game.awayTeam === null)
          .map((game) => game.homeTeam);

        expect(roundOneByes).toEqual(divisionSeasons.slice(0, 5).map((season) => season.teamId));
      });

      // @spec CUP-009
      it('@spec CUP-009 assigns round-1 byes and pairings from the redraw shuffle instead of bracket-slot order', async () => {
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

        try {
          const { games, divisionSeasons } = await createKnockoutSeason({
            teamCount: 5,
            format: ONE_LEG_KNOCKOUT_REDRAW_FORMAT,
          });

          const roundOneGames = games.filter((game) => game.round === 1);
          const roundOneByes = roundOneGames
            .filter((game) => game.awayTeam === null)
            .map((game) => game.homeTeam);
          const topSeeds = divisionSeasons.slice(0, 3).map((season) => season.teamId);

          expect(roundOneByes).not.toEqual(topSeeds);
          expect(roundOneGames.some((game) => game.awayTeam === divisionSeasons[0].teamId)).toBe(true);
        } finally {
          randomSpy.mockRestore();
        }
      });

      // @spec CUP-012
      it('@spec CUP-012 creates both legs of a two-leg knockout tie in round 1', async () => {
        const { games } = await createKnockoutSeason({
          teamCount: 4,
          format: TWO_LEG_KNOCKOUT_FIXED_FORMAT,
        });

        expect(games).toHaveLength(4);
        expect(games.every((game) => game.round === 1)).toBe(true);

        const legCounts = new Map<string, number>();
        for (const game of games) {
          const key = [game.homeTeam, game.awayTeam].sort().join('-');
          legCounts.set(key, (legCounts.get(key) ?? 0) + 1);
        }

        expect(Array.from(legCounts.values())).toEqual([2, 2]);
      });
    });
  });

  describe('isSeasonComplete', () => {
    let iscGw, iscDivId, iscYear, iscDivSeasons;

    beforeAll(async () => {
      iscGw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
      const teams = await Promise.all(
        [{ name: 'X' }, { name: 'Y' }].map((cfg) => TeamFactory().create(iscGw.id, cfg))
      );
      const league = await LeagueFactory().create(iscGw.id, {
        name: 'ISC League', type: LeagueType.League,
        divisions: [{ name: 'ISC Division', defaultTeams: [0, 1], format: ONE_LEG_ROUND_ROBIN_FORMAT }]
      }, teams.map(({ id }) => id));
      iscDivId = await db.models.League.findByPk(league.id, { include: db.models.Division })
        .then((l) => { if (!l) throw Error(); return l.dataValues.Divisions[0].id; });
      iscYear = iscGw.year + 1;
      iscDivSeasons = await db.models.DivisionSeason.bulkCreate(
        teams.map(({ id: teamId }) => ({ divisionId: iscDivId, teamId, year: iscYear }))
      ).then((rows) => rows.map(({ dataValues }) => dataValues));
    });

    it('returns true when no DivisionSeason exists for year', async () => {
      const result = await DivisionFactory(iscDivId).isSeasonComplete(iscYear - 99);
      expect(result).toBe(true);
    });

    it('returns true when all games have results', async () => {
      const [dsX, dsY] = iscDivSeasons;
      const game = await db.models.Game.create({
        homeTeam: dsX.teamId, awayTeam: dsY.teamId,
        homeTeamResult: 2, awayTeamResult: 1,
      }).then(({ dataValues }) => dataValues);
      await db.models.DivisionSeasonGame.bulkCreate([
        { gameId: game.id, divisionSeasonId: dsX.id },
        { gameId: game.id, divisionSeasonId: dsY.id },
      ]);
      const result = await DivisionFactory(iscDivId).isSeasonComplete(iscYear);
      expect(result).toBe(true);
    });

    it('returns false when any game is missing a result', async () => {
      const [dsX, dsY] = iscDivSeasons;
      const pending = await db.models.Game.create({
        homeTeam: dsX.teamId, awayTeam: dsY.teamId,
      }).then(({ dataValues }) => dataValues);
      await db.models.DivisionSeasonGame.bulkCreate([
        { gameId: pending.id, divisionSeasonId: dsX.id },
        { gameId: pending.id, divisionSeasonId: dsY.id },
      ]);
      const result = await DivisionFactory(iscDivId).isSeasonComplete(iscYear);
      expect(result).toBe(false);
    });
  });
});
