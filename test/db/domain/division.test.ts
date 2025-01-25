import { GameFormula, LeagueConfig, LeagueType, TeamConfig } from '../../../src/api/models';
import db from '../../../src/db/client';
import { DivisionFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';

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
        gameFormula: [GameFormula.TWO_LEG, GameFormula.Bo1, GameFormula.ROUND_ROBIN, GameFormula.AGGREGATE]
      }
    ]
  };

  beforeAll(async () => {
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
});