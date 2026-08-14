import { Transaction } from 'sequelize';
import { DefaultMatchRules, MatchRules, PlayerPosition } from '../../api/models';
import db from '../client';
import { FIELDER_POSITIONS, PLAYER_POSITIONS, primaryPosition } from './player';

type LineupRole = 'STARTER' | 'BENCH' | 'BULLPEN';
type Entry = { playerId: number; role: LineupRole; battingOrder: number | null; fieldingPosition: PlayerPosition | null };
type Player = { id: number; attributes: any };

const valueOf = <T>(row: T): any => (row as any)?.dataValues ?? row;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const battingScore = (player: Player) => player.attributes.contact + player.attributes.power + player.attributes.vision + player.attributes.discipline;
const onBaseScore = (player: Player) => player.attributes.contact + player.attributes.vision + player.attributes.discipline;
const pitchQuality = (player: Player) => mean(player.attributes.pitches.map((pitch: any) => pitch.control + pitch.velocity + pitch.spin));
const pitcherScore = (player: Player) => ({ control: mean(player.attributes.pitches.map((pitch: any) => pitch.control)), velocity: mean(player.attributes.pitches.map((pitch: any) => pitch.velocity)) });
const comparePitchers = (a: Player, b: Player) => pitcherScore(b).control - pitcherScore(a).control || pitcherScore(b).velocity - pitcherScore(a).velocity || a.id - b.id;
const sortBatters = (players: Player[]) => [...players].sort((a, b) => battingScore(b) - battingScore(a) || a.id - b.id);

// @spec LIN-002
const resolveMatchRules = (leagueConfig?: { matchRules?: Partial<MatchRules> }, divisionConfig?: { matchRules?: Partial<MatchRules> }): MatchRules => ({
  ...DefaultMatchRules,
  ...leagueConfig?.matchRules,
  ...divisionConfig?.matchRules,
});

// Hungarian minimum-cost assignment on a rectangular 8-position x N-fielder matrix.
// Negating ratings turns the maximum-weight fielding problem into minimum cost in O(8 * N²).
// @spec LIN-004
const optimalFieldingAssignment = (fielders: Player[]): Array<{ player: Player; position: Exclude<PlayerPosition, 'Pitcher'> }> => {
  if (fielders.length < FIELDER_POSITIONS.length) throw Error('Roster cannot fill the eight non-pitcher positions');
  const rowCount = FIELDER_POSITIONS.length;
  const columnCount = fielders.length;
  const u = Array(rowCount + 1).fill(0);
  const v = Array(columnCount + 1).fill(0);
  const p = Array(columnCount + 1).fill(0);
  const way = Array(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    let column = 0;
    const minCost = Array(columnCount + 1).fill(Infinity);
    const used = Array(columnCount + 1).fill(false);
    do {
      used[column] = true;
      const currentRow = p[column];
      let delta = Infinity;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) continue;
        const rating = fielders[candidate - 1].attributes.positions[FIELDER_POSITIONS[currentRow - 1]];
        const cost = 100 - rating - u[currentRow] - v[candidate];
        if (cost < minCost[candidate]) {
          minCost[candidate] = cost;
          way[candidate] = column;
        }
        if (minCost[candidate] < delta) {
          delta = minCost[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= columnCount; candidate += 1) {
        if (used[candidate]) {
          u[p[candidate]] += delta;
          v[candidate] -= delta;
        } else {
          minCost[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (p[column] !== 0);
    do {
      const previousColumn = way[column];
      p[column] = p[previousColumn];
      column = previousColumn;
    } while (column !== 0);
  }

  const assignment = Array(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column] !== 0) assignment[p[column] - 1] = column - 1;
  }
  return assignment.map((index, positionIndex) => ({
    player: fielders[index], position: FIELDER_POSITIONS[positionIndex] as Exclude<PlayerPosition, 'Pitcher'>,
  }));
};

// @spec LIN-003,LIN-005,LIN-006
const validateLineup = (lineup: any, rules: MatchRules): void => {
  const entries: Entry[] = (lineup.LineupEntries ?? lineup.entries ?? []).map(valueOf);
  const starters = entries.filter((entry) => entry.role === 'STARTER');
  const batting = starters.filter((entry) => entry.battingOrder != null);
  const positions = starters.map((entry) => entry.fieldingPosition).filter((position): position is PlayerPosition => position != null);
  const dhEntries = starters.filter((entry) => entry.fieldingPosition == null);
  if (new Set(entries.map((entry) => entry.playerId)).size !== entries.length) throw Error('A player may appear only once per lineup');
  if (batting.length !== 9 || new Set(batting.map((entry) => entry.battingOrder)).size !== 9 || ![...Array(9)].every((_, index) => batting.some((entry) => entry.battingOrder === index + 1))) throw Error('Starters must have batting orders 1 through 9 exactly once');
  if (positions.length !== 9 || new Set(positions).size !== 9 || !PLAYER_POSITIONS.every((position) => positions.includes(position))) throw Error('Starters must cover every fielding position exactly once');
  if (dhEntries.length !== (rules.dhEnabled ? 1 : 0) || starters.length !== (rules.dhEnabled ? 10 : 9)) throw Error('DH starter count does not match match rules');
  const pitcher = starters.find((entry) => entry.fieldingPosition === 'Pitcher');
  if (!pitcher || (rules.dhEnabled ? pitcher.battingOrder != null : pitcher.battingOrder !== 9)) throw Error('Pitcher batting order does not match match rules');
  if (entries.filter((entry) => entry.role === 'BENCH').length > rules.benchSize) throw Error('Bench exceeds match rule cap');
  if (entries.filter((entry) => entry.role === 'BULLPEN').length > rules.bullpenSize) throw Error('Bullpen exceeds match rule cap');
};

interface GenerateOptions { transaction?: Transaction; matchRules?: MatchRules; }

const LineupFactory = () => ({
  // @spec LIN-003,LIN-004,LIN-005,LIN-006
  generateActive: async (teamId: number, gameWorldId: number, players: Player[], options: GenerateOptions = {}) => {
    const matchRules = options.matchRules ?? DefaultMatchRules;
    const existing = await db.models.Lineup.findOne({ where: { teamId, gameId: null }, transaction: options.transaction });
    if (existing) return existing.dataValues;
    const pitchers = players.filter((player) => primaryPosition(player as any) === 'Pitcher');
    const startingPitcher = [...(pitchers.length > 0 ? pitchers : players)].sort(comparePitchers)[0];
    const nonPitcherFielders = players.filter((player) => (
      player.id !== startingPitcher.id && primaryPosition(player as any) !== 'Pitcher'
    ));
    // Generated rosters have enough primary fielders. The fallback keeps legacy or
    // all-tied attribute fixtures constructible without letting reserve pitchers inflate
    // the normal matching matrix.
    const fielderPool = nonPitcherFielders.length >= FIELDER_POSITIONS.length
      ? nonPitcherFielders
      : players.filter((player) => player.id !== startingPitcher.id);
    const fielding = optimalFieldingAssignment(fielderPool);
    const selected = new Set<number>([startingPitcher.id, ...fielding.map(({ player }) => player.id)]);
    const remaining = players.filter((player) => !selected.has(player.id));
    const dh = matchRules.dhEnabled ? sortBatters(remaining)[0] : undefined;
    if (dh) selected.add(dh.id);
    const hitters = fielding.map(({ player }) => player).concat(dh ? [dh] : []);
    const leadoff = [...hitters].sort((a, b) => onBaseScore(b) - onBaseScore(a) || a.id - b.id).slice(0, 2);
    const remainingHitters = hitters.filter((player) => !leadoff.includes(player));
    const runProducers = [...remainingHitters].sort((a, b) => b.attributes.power - a.attributes.power || a.id - b.id).slice(0, 2);
    const orderedHitters = [...leadoff, ...runProducers, ...sortBatters(remainingHitters.filter((player) => !runProducers.includes(player)))];
    const entries: Entry[] = [
      ...fielding.map(({ player, position }) => ({ playerId: player.id, role: 'STARTER' as const, battingOrder: orderedHitters.indexOf(player) + 1, fieldingPosition: position })),
      { playerId: startingPitcher.id, role: 'STARTER', battingOrder: matchRules.dhEnabled ? null : 9, fieldingPosition: 'Pitcher' },
      ...(dh ? [{ playerId: dh.id, role: 'STARTER' as const, battingOrder: orderedHitters.indexOf(dh) + 1, fieldingPosition: null }] : []),
    ];
    const unselected = players.filter((player) => !selected.has(player.id));
    const reservePitchers = unselected.filter((player) => primaryPosition(player as any) === 'Pitcher');
    const reserveFielders = unselected.filter((player) => !reservePitchers.includes(player));
    entries.push(...sortBatters(reserveFielders).slice(0, matchRules.benchSize).map((player) => ({ playerId: player.id, role: 'BENCH' as const, battingOrder: null, fieldingPosition: null })));
    const benchIds = new Set(entries.filter((entry) => entry.role === 'BENCH').map((entry) => entry.playerId));
    entries.push(...[...reservePitchers, ...unselected.filter((player) => !benchIds.has(player.id) && !reservePitchers.includes(player))]
      .sort((a, b) => pitchQuality(b) - pitchQuality(a) || a.id - b.id).slice(0, matchRules.bullpenSize)
      .map((player) => ({ playerId: player.id, role: 'BULLPEN' as const, battingOrder: null, fieldingPosition: null })));
    validateLineup({ entries }, matchRules);
    const lineup = await db.models.Lineup.create({ teamId, gameWorldId }, { transaction: options.transaction });
    await db.models.LineupEntry.bulkCreate(entries.map((entry) => ({ lineupId: lineup.dataValues.id, ...entry })), { transaction: options.transaction });
    return lineup.dataValues;
  },
});

// @spec LIN-003
const startingPitcherId = (lineup: any): number | undefined => (lineup.LineupEntries ?? lineup.entries ?? [])
  .map(valueOf).find((entry: Entry) => entry.role === 'STARTER' && entry.fieldingPosition === 'Pitcher')?.playerId;

export { LineupFactory, optimalFieldingAssignment, resolveMatchRules, startingPitcherId, validateLineup };
