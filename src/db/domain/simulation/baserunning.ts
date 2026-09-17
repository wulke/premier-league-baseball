import { PAOutcome } from './pa-resolver';

// @spec PARP-004,PARP-005,PARP-006,PARP-007
export interface BaseState { first: number | null; second: number | null; third: number | null; }

export interface RunnerTransition {
  playerId: number;
  from: 'batter' | 'first' | 'second' | 'third';
  to: 'first' | 'second' | 'third' | 'home';
}

export interface AdvanceResult { bases: BaseState; transitions: RunnerTransition[]; }

// @spec PARP-004 — force-advance cascade: first is always forced, second only if first was
// occupied, third only if bases were loaded. An unforced runner holds.
const advanceOnWalk = (bases: BaseState, batterId: number): AdvanceResult => {
  const transitions: RunnerTransition[] = [];
  const nextBases: BaseState = { ...bases };

  if (bases.first != null && bases.second != null && bases.third != null) {
    transitions.push({ playerId: bases.third, from: 'third', to: 'home' });
  }
  if (bases.first != null && bases.second != null) {
    transitions.push({ playerId: bases.second, from: 'second', to: 'third' });
    nextBases.third = bases.second;
  }
  if (bases.first != null) {
    transitions.push({ playerId: bases.first, from: 'first', to: 'second' });
    nextBases.second = bases.first;
  }
  transitions.push({ playerId: batterId, from: 'batter', to: 'first' });
  nextBases.first = batterId;

  return { bases: nextBases, transitions };
};

// @spec PARP-005 — advance every existing runner (and the batter) exactly N bases
// (1/2/3); reaching or passing home (base index 4) scores. No aggressive send/hold
// logic — a reversible Depth-0 slot.
const BASE_INDEX: Record<'batter' | 'first' | 'second' | 'third', number> = { batter: 0, first: 1, second: 2, third: 3 };

const advanceOnHit = (bases: BaseState, batterId: number, basesToAdvance: 1 | 2 | 3): AdvanceResult => {
  const destinationFrom = (from: 'batter' | 'first' | 'second' | 'third'): 'first' | 'second' | 'third' | 'home' => {
    const destIndex = BASE_INDEX[from] + basesToAdvance;
    return destIndex >= 4 ? 'home' : (['first', 'second', 'third'] as const)[destIndex - 1];
  };

  const transitions: RunnerTransition[] = [];
  const nextBases: BaseState = { first: null, second: null, third: null };

  (['third', 'second', 'first'] as const).forEach((from) => {
    const runnerId = bases[from];
    if (runnerId == null) return;
    const dest = destinationFrom(from);
    transitions.push({ playerId: runnerId, from, to: dest });
    if (dest !== 'home') nextBases[dest] = runnerId;
  });

  const batterDest = destinationFrom('batter');
  transitions.push({ playerId: batterId, from: 'batter', to: batterDest });
  if (batterDest !== 'home') nextBases[batterDest] = batterId;

  return { bases: nextBases, transitions };
};

// @spec PARP-006 — HR clears the bases; batter and every existing runner score.
const advanceOnHomeRun = (bases: BaseState, batterId: number): AdvanceResult => {
  const transitions: RunnerTransition[] = [];
  (['third', 'second', 'first'] as const).forEach((base) => {
    const runnerId = bases[base];
    if (runnerId != null) transitions.push({ playerId: runnerId, from: base, to: 'home' });
  });
  transitions.push({ playerId: batterId, from: 'batter', to: 'home' });
  return { bases: { first: null, second: null, third: null }, transitions };
};

export const advanceRunners = (
  bases: BaseState,
  outcome: PAOutcome,
  batterId: number,
): AdvanceResult => {
  switch (outcome) {
    case 'BB': return advanceOnWalk(bases, batterId);
    case '1B': return advanceOnHit(bases, batterId, 1);
    case '2B': return advanceOnHit(bases, batterId, 2);
    case '3B': return advanceOnHit(bases, batterId, 3);
    case 'HR': return advanceOnHomeRun(bases, batterId);
    default: return { bases, transitions: [] };   // 'out' / 'SO' — no advancement
  }
};
