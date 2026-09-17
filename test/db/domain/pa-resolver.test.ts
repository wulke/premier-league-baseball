import { resolvePA, PAOutcome } from '../../../src/db/domain';
import { PlayerAttributes } from '../../../src/api/models';

// @spec PARP-002,PARP-003,PARP-019 (resolvePA — unit level)
// Gherkin pairing: PARP-002 also has test/bdd/features/attribute-driven-pa-resolution.feature.
// PARP-003 (outcome-weight floor before normalizing) has none — see
// docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md Traceability.

const VALID_OUTCOMES: PAOutcome[] = ['out', '1B', '2B', '3B', 'HR', 'BB', 'SO'];

const withAttributes = (overrides: Partial<PlayerAttributes>): PlayerAttributes => ({
  contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50,
  positions: {} as any, pitches: [],
  ...overrides,
});

describe('resolvePA (PARP-002)', () => {
  it('always produces one of the seven valid outcomes, for many attribute combinations and rolls', () => {
    for (let i = 0; i <= 100; i += 1) {
      const rating = Math.min(i + 1, 100);
      const batter = withAttributes({ discipline: rating, contact: 101 - rating, power: rating });
      const pitcher = withAttributes({ accuracy: 101 - rating, armStrength: rating });
      const roll = i / 100;
      const outcome = resolvePA({ batter, pitcher, rng: () => roll });
      expect(VALID_OUTCOMES).toContain(outcome);
    }
  });

  it('consumes exactly one rng() call per resolution (PARP-016)', () => {
    let calls = 0;
    const rng = () => { calls += 1; return 0.5; };
    resolvePA({ batter: withAttributes({}), pitcher: withAttributes({}), rng });
    expect(calls).toBe(1);
  });
});

describe('resolvePA current-form IV/EV combination (PARP-019)', () => {
  it('lets earned effort change the seed-stable outcome for equal innate ratings', () => {
    const batter = withAttributes({
      ivEv: { discipline: { iv: 50, ev: 50 } },
    });
    const pitcher = withAttributes({
      ivEv: { accuracy: { iv: 50, ev: 0 } },
    });

    expect(resolvePA({ batter, pitcher, rng: () => 0.1 })).toBe('BB');
    expect(resolvePA({ batter: withAttributes({}), pitcher: withAttributes({}), rng: () => 0.1 })).toBe('SO');
  });
});

describe('resolvePA outcome-weight floor (PARP-003)', () => {
  it('floors the BB weight to 0 at an extreme discipline/accuracy differential, so BB is never drawn', () => {
    const batter = withAttributes({ discipline: 1 });
    const pitcher = withAttributes({ accuracy: 100 });
    for (let step = 0; step <= 100; step += 1) {
      const roll = step / 100;
      const outcome = resolvePA({ batter, pitcher, rng: () => roll });
      expect(outcome).not.toBe('BB');
    }
  });

  it('does not floor BB at a moderate differential — BB remains drawable near roll 0', () => {
    const batter = withAttributes({ discipline: 60 });
    const pitcher = withAttributes({ accuracy: 40 });
    const outcome = resolvePA({ batter, pitcher, rng: () => 0 });
    expect(outcome).toBe('BB');
  });

  it('never throws and always normalizes to a resolvable outcome at any roll, even with every shift maxed out', () => {
    const batter = withAttributes({ discipline: 1, contact: 100, power: 1 });
    const pitcher = withAttributes({ accuracy: 100, armStrength: 1 });
    for (let step = 0; step <= 100; step += 1) {
      const roll = step / 100;
      expect(() => resolvePA({ batter, pitcher, rng: () => roll })).not.toThrow();
    }
  });
});
