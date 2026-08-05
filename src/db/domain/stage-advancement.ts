import db from '../client';
import { DivisionFactory } from './division';

/** Resolve the completed game's league/year, then consider its next dependent stage. */
// @spec MSS-006,MSS-007
export const resolveCrossStageAdvancement = async (gameId: number): Promise<void> => {
  const link = await db.models.DivisionSeasonGame.findOne({
    where: { gameId }, include: [{ model: db.models.DivisionSeason }],
  });
  const seasonNode: any = link?.dataValues.DivisionSeason;
  const season = seasonNode?.dataValues ?? seasonNode;
  if (!season) return;
  const division = await db.models.Division.findByPk(season.divisionId, { include: [db.models.League] });
  if (!division) return;
  const leagueNode: any = division.dataValues.League;
  const league = leagueNode?.dataValues ?? leagueNode;
  // Single-stage legacy leagues have no dependent stage. Avoid the further league
  // and division scans on every ordinary PL/Cup game completion.
  if (!league?.config?.stages || league.config.stages.length < 2) return;
  await advanceStageIfReady(division.dataValues.leagueId, season.year);
};

/** Start one ready dependent stage at most once for a league season. */
// @spec MSS-006,MSS-007
export const advanceStageIfReady = async (leagueId: number, year: number): Promise<void> => {
  const league = await db.models.League.findByPk(leagueId, { include: [db.models.Division] });
  if (!league) return;
  const stages = league.dataValues.config.stages ?? [{ id: '_default', divisions: league.dataValues.config.divisions ?? [] }];
  const divisions = ((league.dataValues.Divisions ?? []) as any[]).map((node: any) => node.dataValues ?? node);

  for (let index = 0; index < stages.length - 1; index += 1) {
    const sourceStage = stages[index];
    const nextStage = stages[index + 1];
    const sourceDivisions = divisions.filter((division: any) => division.config?.stageId === sourceStage.id);
    const dependents = divisions.filter((division: any) =>
      division.config?.stageId === nextStage.id && division.config?.seedingSelection?.fromStage === sourceStage.id,
    );
    if (sourceDivisions.length === 0 || dependents.length === 0) continue;
    if (!(await Promise.all(sourceDivisions.map((division: any) => DivisionFactory(division.id).isSeasonComplete(year)))).every(Boolean)) continue;

    const unstarted: any[] = [];
    for (const division of dependents) {
      const existing = await db.models.DivisionSeason.findOne({ where: { divisionId: division.id, year } });
      if (!existing) unstarted.push(division);
    }
    if (unstarted.length === 0) continue;
    for (const division of unstarted) {
      await DivisionFactory(division.id).newSeason(year, year);
    }
    return;
  }
};
