import { Transaction } from 'sequelize';
import db from '../client';
import { TeamFactory } from './team';
import { DomainError } from './errors';
import { SimulationResult } from './simulation/engine';
import { PlayerGameStatsProjection } from './simulation/stat-projection';

type Side = { teamId: number; runs: number };
type PlayerStatRow = Record<string, number | boolean> & { playerId: number; gameId: number };

const battingWeights = [1.14, 1.11, 1.08, 1.05, 1.00, 0.96, 0.92, 0.89, 0.85];

const allocate = (total: number, playerIds: number[], weights?: number[]): Map<number, number> => {
  const values = new Map(playerIds.map((playerId) => [playerId, 0]));
  const pool = weights ?? playerIds.map(() => 1);
  const weightTotal = pool.reduce((sum, weight) => sum + weight, 0);
  for (let count = 0; count < total; count += 1) {
    let roll = Math.random() * weightTotal;
    const selected = pool.findIndex((weight) => {
      roll -= weight;
      return roll < 0;
    });
    const playerId = playerIds[selected < 0 ? playerIds.length - 1 : selected];
    values.set(playerId, (values.get(playerId) ?? 0) + 1);
  }
  return values;
};

const generatedTotal = (): number => Math.floor(Math.random() * 10);

const validFrozenLineup = async (teamId: number, gameId: number): Promise<any[] | null> => {
  try {
    await TeamFactory(teamId).snapshotForGame(gameId);
  } catch (error) {
    if (error instanceof DomainError && (error.statusCode === 404 || error.statusCode === 422)) return null;
    throw error;
  }

  const lineup = await db.models.Lineup.findOne({ where: { teamId, gameId } });
  if (!lineup) return null;
  const entries = await db.models.LineupEntry.findAll({ where: { lineupId: lineup.dataValues.id } })
    .then((rows: any[]) => rows.map(({ dataValues }) => dataValues));
  const starters = entries.filter((entry: any) => entry.role === 'STARTER');
  const battingOrders = starters.map((entry: any) => entry.battingOrder).sort((a: number, b: number) => a - b);
  const validBattingOrder = starters.length === 9
    && new Set(starters.map((entry: any) => entry.playerId)).size === 9
    && battingOrders.every((order: number, index: number) => order === index + 1);
  const pitchers = starters.filter((entry: any) => entry.fieldingPosition === 'Pitcher');
  if (!validBattingOrder || pitchers.length !== 1) return null;

  const participants = entries.filter((entry: any) => entry.role === 'STARTER' || entry.role === 'BULLPEN');
  const playerIds = [...new Set(participants.map((entry: any) => entry.playerId))];
  const currentPlayers = await db.models.Player.findAll({ where: { id: playerIds, teamId } });
  if (currentPlayers.length !== playerIds.length) return null;
  return entries;
};

const addStat = (rows: Map<number, PlayerStatRow>, playerId: number, name: string, value: number | boolean) => {
  const row = rows.get(playerId)!;
  if (typeof value === 'boolean') row[name] = value;
  else row[name] = Number(row[name] ?? 0) + value;
};

const writeSide = async (gameId: number, side: Side): Promise<void> => {
  const entries = await validFrozenLineup(side.teamId, gameId);
  if (!entries) return;
  const starters = entries.filter((entry: any) => entry.role === 'STARTER')
    .sort((a: any, b: any) => a.battingOrder - b.battingOrder);
  const bullpen = entries.filter((entry: any) => entry.role === 'BULLPEN');
  const starterPitcherId = starters.find((entry: any) => entry.fieldingPosition === 'Pitcher').playerId;
  const playerIds = [...new Set([...starters, ...bullpen].map((entry: any) => entry.playerId))];
  const rows = new Map<number, PlayerStatRow>(playerIds.map((playerId) => [playerId, {
    playerId, gameId, AB: 0, H: 0, R: 0, RBI: 0, HR: 0, '2B': 0, '3B': 0, BB: 0, SO: 0,
    GS: false, IP: 0, pitchingH: 0, pitchingBB: 0, pitchingSO: 0, ER: 0,
  }]));

  const battingIds = starters.map((entry: any) => entry.playerId);
  for (const [stat, total] of Object.entries({ AB: generatedTotal(), H: generatedTotal(), R: side.runs, RBI: generatedTotal(), HR: generatedTotal(), '2B': generatedTotal(), '3B': generatedTotal(), BB: generatedTotal(), SO: generatedTotal() })) {
    allocate(total, battingIds, battingWeights).forEach((value, playerId) => addStat(rows, playerId, stat, value));
  }

  const pitcherIds = [starterPitcherId, ...bullpen.map((entry: any) => entry.playerId)];
  const innings = 1 + generatedTotal();
  const starterInnings = Math.floor(innings / 2) + 1;
  const bullpenPitcherIds = pitcherIds.slice(1);
  addStat(rows, starterPitcherId, 'GS', true);
  addStat(rows, starterPitcherId, 'IP', starterInnings);
  // @spec PGSW-004 — with no bullpen, the starter owns the entire fabricated outing.
  if (bullpenPitcherIds.length === 0) {
    addStat(rows, starterPitcherId, 'IP', innings - starterInnings);
  } else {
    allocate(innings - starterInnings, bullpenPitcherIds).forEach((value, playerId) => addStat(rows, playerId, 'IP', value));
  }
  for (const [stat, total] of Object.entries({ pitchingH: generatedTotal(), pitchingBB: generatedTotal(), pitchingSO: generatedTotal(), ER: generatedTotal() })) {
    allocate(total, pitcherIds).forEach((value, playerId) => addStat(rows, playerId, stat, value));
  }
  await db.models.PlayerGameStats.bulkCreate([...rows.values()]);
};

// @spec PARP-018 — model ownership stays with PlayerGameStatsWriter (backend-standards §1);
// plain insert, same surface-duplicate-write posture as writeForCompletedGame (PGSW-005) —
// the existing (playerId, gameId) unique index throws on a second call, by design.
export const persistPlayerGameStats = async (
  rows: PlayerGameStatsProjection[],
  transaction?: Transaction,
): Promise<void> => {
  await db.models.PlayerGameStats.bulkCreate(rows as any[], { transaction });
};

// @spec PGSW-001,PGSW-002,PGSW-003,PGSW-004,PGSW-005
export const PlayerGameStatsWriter = () => ({
  writeForCompletedGame: async ({ gameId, homeTeamId, awayTeamId, result }: {
    gameId: number;
    homeTeamId: number;
    awayTeamId: number;
    result: SimulationResult;
  }): Promise<void> => {
    await writeSide(gameId, { teamId: homeTeamId, runs: result.homeTeamResult });
    await writeSide(gameId, { teamId: awayTeamId, runs: result.awayTeamResult });
  },
});
