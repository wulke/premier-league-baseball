import { BracketGame, BracketRound, BracketTie, CompetitionFormat, DivisionBracket, SchedulingConfig, StandingsConfig, TeamStanding } from '../../api/models';
import { getKnockoutRoundLabel, nextLowerPowerOfTwo, shuffleTeams } from './knockout';
import db from '../client';

interface IDivision {
  isSeasonComplete: (year: number) => Promise<boolean>;
  newSeason: (year: number) => any;
  getBracket: (year: number) => Promise<DivisionBracket>;
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

    // #85: SWISS (config-surface only, no scheduler) carries no `legs`; RR/KO unchanged.
    if (format.structure !== 'SWISS' && format.legs === 'TWO_LEG') {
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

  const createByeGames = async (
    teamsWithByes: number[],
    round: number,
    scheduledDate: Date | undefined,
    divTeams: any[]
  ): Promise<void> => {
    if (teamsWithByes.length === 0) return;

    const games = await db.models.Game.bulkCreate(
      teamsWithByes.map((homeTeam) => ({
        homeTeam,
        awayTeam: null,
        round,
        status: 'COMPLETED',
        homeTeamResult: 1,
        awayTeamResult: null,
        ...(scheduledDate ? { scheduledDate } : {}),
      }))
    ).then((results) => results.map(({ dataValues }) => dataValues));

    await db.models.DivisionSeasonGame.bulkCreate(
      games.reduce((prev: any[], curr: any) => {
        const homeDs = divTeams.find((t) => t.teamId === curr.homeTeam);
        if (homeDs) prev.push({ gameId: curr.id, divisionSeasonId: homeDs.id });
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

  const getChampion = async (year: number): Promise<{ teamId: number } | undefined> => {
    const result = await db.models.SeasonResult.findOne({ where: { divisionId: id, year } });
    const championTeamId = result?.dataValues?.championTeamId;
    return championTeamId == null ? undefined : { teamId: championTeamId };
  };

  // @spec API-002,API-003,API-004
  const getBracket = async (year: number): Promise<DivisionBracket> => {
    const division = await db.models.Division.findByPk(id);
    if (!division) throw Error(`Failed to load Division '${id}'`);

    const champion = await getChampion(year);
    const { format } = division.dataValues.config;
    if (format.structure === 'ROUND_ROBIN') {
      return { divisionId: id!, year, ...(champion ? { champion } : {}), rounds: [] };
    }

    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: id, year },
      include: [
        { model: db.models.Team },
        { model: db.models.Game, through: { attributes: [] } },
      ]
    });

    const teamNameById = new Map<number, string>(
      divisionSeasons.map((ds: any) => [ds.dataValues.teamId, ds.dataValues.Team?.config?.name ?? `Team ${ds.dataValues.teamId}`]),
    );
    const bracketSlotByTeamId = new Map<number, number>(
      divisionSeasons.map((ds: any) => [ds.dataValues.teamId, ds.dataValues.bracketSlot ?? Number.MAX_SAFE_INTEGER]),
    );
    const initialTeamCount = divisionSeasons.length;

    const seen = new Set<number>();
    const games = divisionSeasons
      .flatMap((ds: any) => (ds.dataValues.Games ?? []) as any[])
      .filter((g: any) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; })
      .sort((a: any, b: any) => (a.round ?? 0) - (b.round ?? 0) || a.id - b.id);

    if (games.length === 0) {
      return { divisionId: id!, year, ...(champion ? { champion } : {}), rounds: [] };
    }

    const roundNumbers = [...new Set<number>(games.map((g: any) => g.round).filter((round): round is number => round != null))]
      .sort((a, b) => a - b);
    const rounds: BracketRound[] = roundNumbers.map((round) => {
      const roundGames = games.filter((g: any) => g.round === round);
      const ties = buildBracketTies(roundGames, teamNameById, bracketSlotByTeamId);
      const allDecided = ties.every((tie) => tie.kind === 'BYE' || tie.winnerTeamId != null);

      return {
        round,
        label: getKnockoutRoundLabel(initialTeamCount, round),
        status: allDecided ? 'COMPLETE' : 'IN_PROGRESS',
        ties,
      };
    });

    const lastRound = rounds[rounds.length - 1];
    const winnerCount = lastRound.ties.filter((tie) => tie.kind === 'BYE' || tie.winnerTeamId != null).length;
    if (!champion && lastRound.status === 'COMPLETE' && winnerCount > 1) {
      rounds.push({
        round: lastRound.round + 1,
        label: getKnockoutRoundLabel(initialTeamCount, lastRound.round + 1),
        status: 'PENDING',
        ties: [...Array(winnerCount / 2).keys()].map(() => ({
          kind: 'SERIES',
          teamA: { teamId: null, teamName: null },
          teamB: { teamId: null, teamName: null },
          games: [],
        })),
      });
    }

    return {
      divisionId: id!,
      year,
      ...(champion ? { champion } : {}),
      rounds,
    };
  };

  return {
    isSeasonComplete,
    getBracket,
    getStandings,
    // @spec CUP-009,CUP-010
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
          ? shuffleTeams(teams)
          : [...teams];

        const reducedPower = nextLowerPowerOfTwo(ordered.length);
        const roundOneByes = (2 * reducedPower) - ordered.length;
        const pairedTeams = ordered.slice(roundOneByes);
        const teamsWithByes = ordered.slice(0, roundOneByes);

        const round1Pairings: [number, number][] = [];
        for (let i = 0; i < pairedTeams.length - 1; i += 2) {
          round1Pairings.push([pairedTeams[i], pairedTeams[i + 1]]);
        }

        // (5) create round 1 games
        await createRoundGames(round1Pairings, 1, scheduleDate(schedulingConfig, 0), divTeams);
        await createByeGames(teamsWithByes, 1, scheduleDate(schedulingConfig, 0), divTeams);

        // (6) TWO_LEG: also create round 1 return legs immediately (home/away swapped)
        if (format.legs === 'TWO_LEG') {
          const returnLeg: [number, number][] = round1Pairings.map(([h, a]) => [a, h]);
          await createRoundGames(returnLeg, 1, scheduleDate(schedulingConfig, 1), divTeams);
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

const buildBracketTies = (
  games: any[],
  teamNameById: Map<number, string>,
  bracketSlotByTeamId: Map<number, number>,
): BracketTie[] => {
  const tiesByPair = new Map<string, any[]>();
  const byes: any[] = [];

  for (const game of games) {
    if (game.awayTeam == null) {
      byes.push(game);
      continue;
    }

    const key = [game.homeTeam, game.awayTeam].sort((a, b) => a - b).join('-');
    if (!tiesByPair.has(key)) tiesByPair.set(key, []);
    tiesByPair.get(key)!.push(game);
  }

  const tieEntries: Array<{ order: number; tie: BracketTie }> = [];

  byes.forEach((game) => {
    tieEntries.push({
      order: bracketSlotByTeamId.get(game.homeTeam) ?? Number.MAX_SAFE_INTEGER,
      tie: {
        kind: 'BYE',
        teamA: { teamId: game.homeTeam, teamName: teamNameById.get(game.homeTeam) ?? `Team ${game.homeTeam}` },
        teamB: null,
        winnerTeamId: game.homeTeam,
        games: [toBracketGame(game, teamNameById)],
      },
    });
  });

  [...tiesByPair.values()].forEach((tieGames) => {
    const orderedGames = [...tieGames].sort((a, b) => a.id - b.id);
    const [teamAId, teamBId] = [...new Set(orderedGames.flatMap((game) => [game.homeTeam, game.awayTeam]))]
      .filter((teamId): teamId is number => teamId != null)
      .sort((a, b) => (bracketSlotByTeamId.get(a) ?? Number.MAX_SAFE_INTEGER) - (bracketSlotByTeamId.get(b) ?? Number.MAX_SAFE_INTEGER));
    const winnerTeamId = resolveTieWinner(orderedGames);

    tieEntries.push({
      order: Math.min(
        bracketSlotByTeamId.get(teamAId) ?? Number.MAX_SAFE_INTEGER,
        bracketSlotByTeamId.get(teamBId) ?? Number.MAX_SAFE_INTEGER,
      ),
      tie: {
        kind: 'SERIES',
        teamA: { teamId: teamAId, teamName: teamNameById.get(teamAId) ?? `Team ${teamAId}` },
        teamB: { teamId: teamBId, teamName: teamNameById.get(teamBId) ?? `Team ${teamBId}` },
        ...(winnerTeamId != null ? { winnerTeamId } : {}),
        games: orderedGames.map((game) => toBracketGame(game, teamNameById)),
      },
    });
  });

  return tieEntries.sort((a, b) => a.order - b.order).map(({ tie }) => tie);
};

const toBracketGame = (game: any, teamNameById: Map<number, string>): BracketGame => ({
  gameId: game.id,
  status: game.status,
  homeTeamId: game.homeTeam,
  homeTeamName: teamNameById.get(game.homeTeam) ?? `Team ${game.homeTeam}`,
  awayTeamId: game.awayTeam,
  awayTeamName: game.awayTeam == null ? null : (teamNameById.get(game.awayTeam) ?? `Team ${game.awayTeam}`),
  homeTeamResult: game.homeTeamResult,
  awayTeamResult: game.awayTeamResult,
});

const resolveTieWinner = (games: any[]): number | undefined => {
  if (!games.every((game) => game.status === 'COMPLETED' && game.homeTeamResult != null)) {
    return undefined;
  }

  const totals = new Map<number, number>();
  for (const game of games) {
    totals.set(game.homeTeam, (totals.get(game.homeTeam) ?? 0) + (game.homeTeamResult ?? 0));
    totals.set(game.awayTeam, (totals.get(game.awayTeam) ?? 0) + (game.awayTeamResult ?? 0));
  }

  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (ordered.length < 2 || ordered[0][1] === ordered[1][1]) return undefined;
  return ordered[0][0];
};

export { DivisionFactory };
