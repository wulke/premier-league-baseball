import { PlayerAttributes } from '../../../api/models';
import { readAttribute } from './attribute-read';

// @spec PARP-002 — coarse Depth-0 default; a placeholder shape, not tuned formulas
// (real (IV,EV) formulas are #193's job, gated on #178's go/no-go).
export type PAOutcome = 'out' | '1B' | '2B' | '3B' | 'HR' | 'BB' | 'SO';

export interface PAResolverInput {
  batter: PlayerAttributes;
  pitcher: PlayerAttributes;
  rng: () => number;   // one draw consumed per call (PARP-016)
}

const OUTCOMES: PAOutcome[] = ['BB', 'SO', 'out', '1B', '2B', '3B', 'HR'];   // fixed enumeration order — pinned for golden-master reproducibility (PARP-017)

const BASE_WEIGHTS: Record<PAOutcome, number> = { BB: 8, SO: 20, out: 42, '1B': 18, '2B': 6, '3B': 1, HR: 5 };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// @spec PARP-002,PARP-003
export const resolvePA = ({ batter, pitcher, rng }: PAResolverInput): PAOutcome => {
  const batterDiscipline = readAttribute(batter, 'discipline').iv;
  const pitcherAccuracy = readAttribute(pitcher, 'accuracy').iv;
  const batterContact = readAttribute(batter, 'contact').iv;
  const pitcherArm = readAttribute(pitcher, 'armStrength').iv;
  const batterPower = readAttribute(batter, 'power').iv;

  // Scaled to exceed BASE_WEIGHTS.BB (8) at the attribute extremes ([1,100]), so a large
  // enough differential can actually drive the BB weight below zero — otherwise PARP-003's
  // floor would be dead code no input could ever reach.
  const walkShift = clamp(((batterDiscipline - pitcherAccuracy) / 100) * 10, -10, 10);
  const soShift = clamp(((pitcherArm - batterContact) / 100) * 10, -10, 10);
  const powerShift = clamp(((batterPower - 50) / 100) * 8, -8, 8);

  const weights: Record<PAOutcome, number> = { ...BASE_WEIGHTS };
  weights.BB += walkShift;
  weights.out -= walkShift;
  weights.SO += soShift;
  weights['1B'] -= soShift;
  weights.HR += powerShift * 0.5;
  weights['2B'] += powerShift * 0.3;
  weights['1B'] -= powerShift * 0.5;
  weights.out -= powerShift * 0.3;

  // @spec PARP-003 — floor every weight at 0 before normalizing, so a large attribute
  // differential can zero out (never invert) an outcome's probability.
  const floored = OUTCOMES.reduce((acc, outcome) => {
    acc[outcome] = Math.max(0, weights[outcome]);
    return acc;
  }, {} as Record<PAOutcome, number>);
  const total = OUTCOMES.reduce((sum, outcome) => sum + floored[outcome], 0);

  const roll = rng();
  let cumulative = 0;
  for (const outcome of OUTCOMES) {
    cumulative += floored[outcome] / total;
    if (roll < cumulative) return outcome;
  }
  return 'HR';   // floating-point fallback, unreachable in practice
};
