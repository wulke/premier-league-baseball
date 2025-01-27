import { GameFormula } from '../../api/models';
import { GameFactory } from './game';
import db from '../client';

interface IDivision {
  isSeasonComplete: (year: number) => Promise<boolean>;
  newSeason: (year: number) => any;
};

const DivisionFactory = (id?: number): IDivision => {
  const getSeedTeamIdsForDivision = async (year: number) => {
    /**
     * responsible for determining list of teams that will be in this division
     * use cases:
     * 1. Default list of teams for initial season
     * 2. promotion / relegation between divisions in a standard league
     * 3. Knockout tournament roudn progression
     * .???
     * 
     * Will need to determine logic basd on DivisionConfig or parent LeagueConfig.
     * 
     * For the time being we will just return the default list of teams
     */
    return await db.models.Division.findByPk(id)
      .then((division) => {
        if (!division) throw Error(`Failed to load Division '${id}'`);
        return division.dataValues;
      })
      .then(({ config }) => config.defaultTeams );
  };
  const isSeasonComplete = async (year: number): Promise<boolean> => {
    // todo implement, check that all games have a result
    return true;
  };
  const generateGames = async (teams: any[], gameFormula: GameFormula[]) => {
    const rounds: [number, number][][] = [];

    if (gameFormula.includes(GameFormula.ROUND_ROBIN)) {
      // each team plays each other team once or twice
      // Homw/Away is random

      const num = teams.length;
      const rotatedTeams = [...teams];

      for (let round = 0; round < num - 1; round++) {
        const pairings: [number, number][] = [];
        for (let i = 0; i < num / 2; i++ ) {
          if (round % 2 == 0)
            pairings.push([rotatedTeams[i], rotatedTeams[num - 1 - i]]);
          else
            pairings.push([rotatedTeams[num - 1 - i], rotatedTeams[i]]);
        }
        rounds.push(pairings);

        rotatedTeams.splice(1,0, rotatedTeams.pop());
      }

      rounds.sort(() => Math.random() - 0.5);
      // console.debug(rounds);

      if (gameFormula.includes(GameFormula.TWO_LEG)) {
        let copy: [number, number][][] = [...rounds];
        // shuffle
        copy.sort(() => Math.random() - 0.5);
        // console.debug(copy);
        copy.forEach((round: [number, number][]) => {
          // todo figure out how to swap home/away 

          rounds.push([...round]);
        });
      }
    }

    return rounds;
  };

  return {
    isSeasonComplete,
    newSeason: async (currentYear: number) => {
      // (0) fetch division config
      const div = await db.models.Division.findByPk(id)
        .then((result) => { if (!result) throw Error('division error'); return result })
        .then(({ dataValues }) => dataValues);

      // (1) check that hte season is complete for this division
      if (!isSeasonComplete(currentYear)) throw Error(`Season is not complete for div='${id}' and year='${currentYear}'`);
      // # todo # check that season doesn't already exist for new year
      // (2) get the udpated list of teams for this division
      // # todo # probably can pass a seeded set of teams as well (for knockout tournaments)
      const teams = await getSeedTeamIdsForDivision(currentYear + 1);
      // (3) create entries in DivisionSeason wiht this.id + [...team.id] + year
      const divTeams = await db.models.DivisionSeason.bulkCreate(
        teams.map((teamId) => ({
          divisionId: id,
          teamId,
          year: currentYear + 1
        }))
      ).then((results) => results.map(({ dataValues }) => dataValues));

      /**
       * TODO:
       * 
       * Need to generate the games for this division.
       * Based on League config for game weeks
       * League config will determine when the actual Division game weeks are scheduled
       * 
       * ... how to determine scheduledDate? ...
       */
      const gameWeeks = await generateGames(teams, div.config.gameFormula);
      gameWeeks.forEach(async (week: [number, number][]) => {
        /* todo: scheduledDate will be determined by the game week requirements of the League */
        const games = await db.models.Game.bulkCreate(week.map((game) => {
          return {
            homeTeam: game[0],
            awayTeam: game[1],
            // scheduldDate: ???
          }
        })).then((result) => result.map(({ dataValues }) => dataValues));
        const divGames = await db.models.DivisionSeasonGame.bulkCreate(
          games.reduce((prev, curr) => {
            prev.push(
              { gameId: curr.id, divisionSeasonId: divTeams.find((t) => t.teamId === curr.homeTeam).id },
              { gameId: curr.id, divisionSeasonId: divTeams.find((t) => t.teamId === curr.awayTeam).id }
            )
            return prev;
          }, [])).then((d) => d.map(({ dataValues }) => dataValues));
      });

      return divTeams;
    },
  }
};

export { DivisionFactory };