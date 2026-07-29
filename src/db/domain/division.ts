import { CompetitionFormat, SchedulingConfig, StandingsConfig, TeamStanding } from '../../api/models';
import { GameFactory } from './game';
import db from '../client';

interface IDivision {
  isSeasonComplete: (year: number) => Promise<boolean>;
  newSeason: (year: number) => any;
  getStandings: (year: number, standingsConfig: StandingsConfig) => Promise<TeamStanding[]>;
};

const DivisionFactory = (id?: number): IDivision => {
  const getSeedTeamIdsForDivision = async (year: number) => {
    /**
     * responsible for determining list of teams that will be in this division
     * use cases:
     * 1. Default list of teams for initial season
     * 2. promotion / relegation between divisions in a standard league
     * 3. Knockout tournament round progression
     * .???
     *
     * Will need to determine logic based on DivisionConfig or parent LeagueConfig.
     *
     * For the time being we will just return the default list of teams
     */
    return await db.models.Division.findByPk(id)
      .then((division) => {
        if (!division) throw Error(`Failed to load Division '${id}'`);
        return division.dataValues;
      })
      .then(({ config }) => config.defaultTeams);
  };

  const isSeasonComplete = async (year: number): Promise<boolean> => {
    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: id, year },
      include: [{ model: db.models.Game, through: { attributes: [] } }]
    });

    if (divisionSeasons.length === 0) return true;

    const seen = new Set<number>();
    const games = divisionSeasons
      .flatMap((ds) => (ds.dataValues.Games ?? []) as any[])
      .filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });

    return games.length === 0 || games.every((g) => g.homeTeamResult !== null);
  };

  /** T4: generates matchday rounds for table (ROUND_ROBIN) leagues */
  const generateTableGames = (teams: number[], format: CompetitionFormat): { round: number; pairings: [number, number][] }[] => {
    const rounds: { round: number; pairings: [number, number][] }[] = [];
    const num = teams.length;
    const rotatedTeams = [...teams];

    for (let r = 0; r < num - 1; r++) {
      const pairings: [number, number][] = [];
      for (let i = 0; i < num / 2; i++) {
        if (r % 2 === 0)
          pairings.push([rotatedTeams[i], rotatedTeams[num - 1 - i]]);
        else
          pairings.push([rotatedTeams[num - 1 - i], rotatedTeams[i]]);
      }
      rounds.push({ round: r + 1, pairings });
      rotatedTeams.splice(1, 0, rotatedTeams.pop()!);
    }

    // shuffle matchday order then re-number
    rounds.sort(() => Math.random() - 0.5);
    rounds.forEach((r, i) => { r.round = i + 1; });

    if (format.legs === 'TWO_LEG') {
      const firstLegCount = rounds.length;
      const secondLeg = [...rounds].sort(() => Math.random() - 0.5);
      secondLeg.forEach((r, i) => {
        rounds.push({ round: firstLegCount + i + 1, pairings: r.pairings.map(([h, a]) => [a, h]) });
      });
    }

    return rounds;
  };

  /** shared helper: bulk-create Game rows + DivisionSeasonGame links for one round */
  const createRoundGames = async (
    pairings: [number, number][],
    round: number,
    scheduledDate: Date | undefined,
    divTeams: any[]
  ): Promise<void> => {
    const games = await db.models.Game.bulkCreate(
      pairings.map(([homeTeam, awayTeam]) => ({
        homeTeam,
        awayTeam,
        round,
        ...(scheduledDate ? { scheduledDate } : {}),
      }))
    ).then((results) => results.map(({ dataValues }) => dataValues));

    await db.models.DivisionSeasonGame.bulkCreate(
      games.reduce((prev: any[], curr: any) => {
        const homeDs = divTeams.find((t) => t.teamId === curr.homeTeam);
        const awayDs = divTeams.find((t) => t.teamId === curr.awayTeam);
        if (homeDs) prev.push({ gameId: curr.id, divisionSeasonId: homeDs.id });
        if (awayDs) prev.push({ gameId: curr.id, divisionSeasonId: awayDs.id });
        return prev;
      }, [])
    );
  };

  /** compute scheduledDate for a round offset from the division's schedulingConfig */
  const scheduleDate = (schedulingConfig: SchedulingConfig | undefined, roundOffset: number): Date | undefined => {
    if (!schedulingConfig) return undefined;
    const d = new Date(schedulingConfig.startDate);
    d.setDate(d.getDate() + roundOffset * schedulingConfig.intervalDays);
    return d;
  };

  const getStandings = async (year: number, standingsConfig: StandingsConfig): Promise<TeamStanding[]> => {
    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: id, year },
      include: [
        { model: db.models.Team },
        { model: db.models.Game, through: { attributes: [] } }
      ]
    });

    return divisionSeasons.map((ds) => {
      const { dataValues: dsData } = ds;
      const games = (dsData.Games ?? []).filter(
        (g) => g.homeTeamResult !== null && g.awayTeamResult !== null
      );

      let played = 0, won = 0, drawn = 0, lost = 0, runsFor = 0, runsAgainst = 0;

      for (const game of games) {
        const isHome = game.homeTeam === dsData.teamId;
        const gf = isHome ? game.homeTeamResult : game.awayTeamResult;
        const ga = isHome ? game.awayTeamResult : game.homeTeamResult;
        played++;
        runsFor += gf;
        runsAgainst += ga;
        if (gf > ga) won++;
        else if (gf === ga) drawn++;
        else lost++;
      }

      return {
        teamId: dsData.teamId,
        teamName: dsData.Team.config.name,
        played, won, drawn, lost, runsFor, runsAgainst,
        runDifference: runsFor - runsAgainst,
        points: standingsConfig.mode === 'table'
          ? (
              won * standingsConfig.points.win +
              drawn * (standingsConfig.points.draw ?? 0) +
              lost * standingsConfig.points.loss
            )
          : (
              won * standingsConfig.points.win +
              lost * standingsConfig.points.loss
            )
      };
    }).sort((a, b) =>
      b.points - a.points ||
      b.runDifference - a.runDifference ||
      b.runsFor - a.runsFor
    );
  };

  return {
    isSeasonComplete,
    getStandings,
    newSeason: async (currentYear: number) => {
      // (0) fetch division config
      const div = await db.models.Division.findByPk(id)
        .then((result) => { if (!result) throw Error('division error'); return result; })
        .then(({ dataValues }) => dataValues);

      // (1) verify current season is complete before starting a new one
      if (!(await isSeasonComplete(currentYear))) throw Error(`Season is not complete for div='${id}' and year='${currentYear}'`);

      const newYear = currentYear + 1;
      const { format, schedulingConfig } = div.config;

      // (2) get team ids for the new season
      const teams: number[] = await getSeedTeamIdsForDivision(newYear);

      if (format.structure === 'KNOCKOUT') {
        // --- T7: ELIMINATION PATH ---

        // (3) create DivisionSeason entries with bracketSlot assigned by seed order
        const divTeams = await db.models.DivisionSeason.bulkCreate(
          teams.map((teamId: number, slot: number) => ({
            divisionId: id,
            teamId,
            year: newYear,
            bracketSlot: slot,
          }))
        ).then((results) => results.map(({ dataValues }) => dataValues));

        // (4) pair teams for round 1
        //   REDRAW: random shuffle before pairing
        //   fixed bracket: pair by slot order (slot 0 vs 1, slot 2 vs 3, ...)
        const ordered = format.seeding === 'REDRAW'
          ? [...teams].sort(() => Math.random() - 0.5)
          : [...teams];

        const round1Pairings: [number, number][] = [];
        for (let i = 0; i < ordered.length - 1; i += 2) {
          round1Pairings.push([ordered[i], ordered[i + 1]]);
        }

        // (5) create round 1 games
        await createRoundGames(round1Pairings, 1, scheduleDate(schedulingConfig, 0), divTeams);

        // (6) TWO_LEG: also create round 2 return legs immediately (home/away swapped)
        if (format.legs === 'TWO_LEG') {
          const returnLeg: [number, number][] = round1Pairings.map(([h, a]) => [a, h]);
          await createRoundGames(returnLeg, 2, scheduleDate(schedulingConfig, 1), divTeams);
        }

        return divTeams;
      } else {
        // --- T4: TABLE PATH (ROUND_ROBIN) ---

        // (3) create DivisionSeason entries
        const divTeams = await db.models.DivisionSeason.bulkCreate(
          teams.map((teamId: number) => ({ divisionId: id, teamId, year: newYear }))
        ).then((results) => results.map(({ dataValues }) => dataValues));

        // (4) generate all matchday rounds with round numbers
        const matchdays = generateTableGames(teams, format);

        // (5) create games for each matchday in sequence
        for (const { round, pairings } of matchdays) {
          await createRoundGames(pairings, round, scheduleDate(schedulingConfig, round - 1), divTeams);
        }

        return divTeams;
      }
    },
  };
};

export { DivisionFactory };
