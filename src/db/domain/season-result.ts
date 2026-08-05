import { DefaultStandingsConfig } from '../../api/models';
import db from '../client';
import { DivisionFactory } from './division';

/** Write (without overwriting) the champion SeasonResult row for (divisionId, year). */
// @spec CUP-002,LCH-002,LCH-004,MSS-008
export const recordSeasonChampionIfMissing = async (
  divisionId: number,
  year: number,
  championTeamId: number,
): Promise<void> => {
  const division = await db.models.Division.findByPk(divisionId);
  if (!division || division.dataValues.config?.isTopTier !== true) return;
  const existing = await db.models.SeasonResult.findOne({ where: { divisionId, year } });
  if (existing) {
    if (existing.dataValues.championTeamId == null) {
      await existing.update({ championTeamId });
    }
    return;
  }

  await db.models.SeasonResult.create({ divisionId, year, championTeamId });
};

/** Completion-path entry point for top-tier round-robin champion recording. */
// @spec LCH-002,LCH-003,LCH-004,MSS-008
export const resolveRoundRobinGameCompletion = async (gameId: number): Promise<void> => {
  const dsg = await db.models.DivisionSeasonGame.findOne({
    where: { gameId },
    include: [{ model: db.models.DivisionSeason }],
  });
  if (!dsg) return;

  const dsNode: any = dsg.dataValues.DivisionSeason;
  const ds = dsNode?.dataValues ?? dsNode;
  if (!ds) return;

  const division = await db.models.Division.findByPk(ds.divisionId);
  if (!division) return;

  const config = division.dataValues.config ?? {};
  if (config.format?.structure !== 'ROUND_ROBIN') return;
  const existing = await db.models.SeasonResult.findOne({
    where: { divisionId: ds.divisionId, year: ds.year },
  });
  if (existing) return;

  const isComplete = await DivisionFactory(ds.divisionId).isSeasonComplete(ds.year);
  if (!isComplete) return;

  const league = await db.models.League.findByPk(division.dataValues.leagueId);
  if (!league) return;

  const standings = await DivisionFactory(ds.divisionId).getStandings(
    ds.year,
    league.dataValues.config.standingsConfig ?? DefaultStandingsConfig,
  );
  const championTeamId = standings[0]?.teamId;
  if (championTeamId == null) return;

  await recordSeasonChampionIfMissing(ds.divisionId, ds.year, championTeamId);
};
