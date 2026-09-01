// @spec IVEV-001..IVEV-013
import {
  applyEarnedDelta,
  createAttributeState,
  createEarningPolicy,
  createPersonNatures,
  readPersonAttribute,
  resolveAgeDiscount,
  resolveNatureMultiplier,
  type AttributeAgingProfile,
  type AttributeReadPolicy,
  type NatureCatalogEntry,
} from '../../../src/db/domain/iv-ev-person-attribute';

const AGE_META = { primeOffset: 0, accelerationRate: 1 };

const PHYSICAL_PROFILE: AttributeAgingProfile = {
  primeAge: 30,
  hardFloor: 0.2,
  yearlyRate: 0.01,
  curvature: 2,
};

const NATURES: readonly NatureCatalogEntry[] = [
  {
    id: 'Explosive',
    expressionMultiplierByAttributeKind: { speed: 1.1, discipline: 0.9 },
  },
  {
    id: 'Disciplined',
    expressionMultiplierByAttributeKind: { discipline: 1.05 },
  },
];

const LINEAR_GAME_READ: AttributeReadPolicy = {
  consumerId: 'game-decision',
  formMode: 'included',
  usesProjection: false,
  combination: { kind: 'linear', fadedCapacityWeight: 1, formWeight: 1 },
  clamp: { kind: 'bounded', min: -100, max: 100 },
};

const SALARY_READ: AttributeReadPolicy = {
  consumerId: 'salary',
  formMode: 'excluded',
  usesProjection: false,
  combination: { kind: 'linear', fadedCapacityWeight: 0, formWeight: 0 },
  clamp: { kind: 'none' },
  aggregate: 'unfaded-ev',
};

describe('Decoupled IV/EV person-attribute pattern', () => {
  // @spec IVEV-001,IVEV-002
  it('@spec IVEV-001 @spec IVEV-002 keeps immutable seeds distinct from EV, form, and named person-level Natures', () => {
    const state = createAttributeState({
      iv: 80,
      ageDiscountMeta: AGE_META,
      maxFormEvents: 2,
    });

    expect(state).toMatchObject({
      iv: 80,
      ev: 0,
      formWindow: [],
      ageDiscountMeta: AGE_META,
      maxFormEvents: 2,
    });
    expect(createPersonNatures(['Explosive'])).toEqual(['Explosive']);
    expect(state).not.toHaveProperty('nature');
  });

  // @spec IVEV-003,IVEV-004
  it('@spec IVEV-003 @spec IVEV-004 resolves named Nature tradeoffs by attribute kind and composes several matching effects', () => {
    expect(resolveNatureMultiplier(['Explosive'], 'speed', NATURES)).toBeCloseTo(1.1);
    expect(resolveNatureMultiplier(['Explosive'], 'discipline', NATURES)).toBeCloseTo(0.9);
    expect(resolveNatureMultiplier(['Explosive', 'Disciplined'], 'discipline', NATURES)).toBeCloseTo(0.945);
    expect(resolveNatureMultiplier(['Explosive'], 'contact', NATURES)).toBe(1);
  });

  // @spec IVEV-005
  it('@spec IVEV-005 discounts IV only with an accelerating decline that stops at the profile floor', () => {
    expect(resolveAgeDiscount(PHYSICAL_PROFILE, 30, AGE_META)).toBe(1);
    expect(resolveAgeDiscount(PHYSICAL_PROFILE, 31, AGE_META)).toBeCloseTo(0.99);
    expect(resolveAgeDiscount(PHYSICAL_PROFILE, 32, AGE_META)).toBeCloseTo(0.96);
    expect(resolveAgeDiscount(PHYSICAL_PROFILE, 90, AGE_META)).toBe(0.2);
  });

  // @spec IVEV-006,IVEV-007,IVEV-008,IVEV-013
  it('@spec IVEV-006 @spec IVEV-007 @spec IVEV-008 @spec IVEV-013 reads capacity and form through consumer-owned policies only', () => {
    const state = createAttributeState({
      iv: 100,
      ev: 20,
      ageDiscountMeta: AGE_META,
      maxFormEvents: 3,
      formWindow: [{ outcomeId: 'recent-good', delta: 5, occurredAt: new Date('2040-05-01') }],
    });

    const gameRead = readPersonAttribute({
      state,
      personNatures: ['Explosive'],
      attributeKind: 'speed',
      profile: PHYSICAL_PROFILE,
      personAge: 32,
      policy: LINEAR_GAME_READ,
      catalog: NATURES,
      at: new Date('2040-05-02'),
    });
    const salaryRead = readPersonAttribute({
      state,
      personNatures: ['Explosive'],
      attributeKind: 'speed',
      profile: PHYSICAL_PROFILE,
      personAge: 32,
      policy: SALARY_READ,
      catalog: NATURES,
      at: new Date('2040-05-02'),
    });

    expect(gameRead.fadedCapacity).toBeCloseTo(127.6); // 1.1 × (0.96 × 100 + 20)
    expect(gameRead.form).toBe(5);
    expect(gameRead.consumed).toBe(100); // final game-read clamp only
    expect(salaryRead.consumed).toBe(20); // EV remains unfaded and unclamped
    expect(() => readPersonAttribute({ ...({} as any), policy: undefined })).toThrow(/policy/i);
  });

  // @spec IVEV-007
  it('@spec IVEV-007 keeps a specialist gate and saturation local to its declared consumer policy', () => {
    const state = createAttributeState({
      iv: 60,
      ageDiscountMeta: AGE_META,
      maxFormEvents: 2,
    });
    const gatedPolicy: AttributeReadPolicy = {
      ...LINEAR_GAME_READ,
      consumerId: 'pitcher-duel',
      combination: {
        kind: 'gated-saturating',
        fadedCapacityWeight: 1,
        formWeight: 0,
        gates: [{ minimum: 75, multiplierBelowMinimum: 0.5 }],
        saturationAt: 90,
      },
    };

    const linear = readPersonAttribute({ state, personNatures: [], attributeKind: 'command', profile: PHYSICAL_PROFILE, personAge: 30, policy: LINEAR_GAME_READ, catalog: NATURES, at: new Date() });
    const gated = readPersonAttribute({ state, personNatures: [], attributeKind: 'command', profile: PHYSICAL_PROFILE, personAge: 30, policy: gatedPolicy, catalog: NATURES, at: new Date() });

    expect(linear.consumed).toBe(60);
    expect(gated.consumed).toBe(30);
  });

  // @spec IVEV-009,IVEV-010
  it('@spec IVEV-009 @spec IVEV-010 applies each outcome once to EV and the bounded form ring, including neutral outcomes', () => {
    const initial = createAttributeState({ iv: 50, ageDiscountMeta: AGE_META, maxFormEvents: 2 });
    const first = applyEarnedDelta(initial, { outcomeId: 'a', delta: 4, occurredAt: new Date('2040-01-01') });
    const neutral = applyEarnedDelta(first, { outcomeId: 'b', delta: 0, occurredAt: new Date('2040-01-02') });
    const third = applyEarnedDelta(neutral, { outcomeId: 'c', delta: -3, occurredAt: new Date('2040-01-03') });

    expect(third.ev).toBe(1);
    expect(third.formWindow.map(({ outcomeId }) => outcomeId)).toEqual(['b', 'c']);
    expect(() => applyEarnedDelta(third, { outcomeId: 'c', delta: -3, occurredAt: new Date('2040-01-03') })).toThrow(/already applied/i);
    expect(readPersonAttribute({ state: initial, personNatures: [], attributeKind: 'speed', profile: PHYSICAL_PROFILE, personAge: 30, policy: LINEAR_GAME_READ, catalog: NATURES, at: new Date() }).form).toBe(0);
  });

  // @spec IVEV-011,IVEV-012
  it('@spec IVEV-011 @spec IVEV-012 requires one entity-class delta-zero convention and preserves each contributor state', () => {
    expect(createEarningPolicy({ entityClass: 'Umpire', deltaZero: 'versus-league-line' })).toEqual({
      entityClass: 'Umpire',
      deltaZero: 'versus-league-line',
    });
    expect(() => createEarningPolicy({ entityClass: 'Manager' } as any)).toThrow(/delta-zero/i);

    const batter = createAttributeState({ iv: 70, ageDiscountMeta: AGE_META, maxFormEvents: 2 });
    const captain = createAttributeState({ iv: 70, ageDiscountMeta: AGE_META, maxFormEvents: 2 });
    const nextBatter = applyEarnedDelta(batter, { outcomeId: 'outcome-1:batter', delta: 3, occurredAt: new Date() });
    const nextCaptain = applyEarnedDelta(captain, { outcomeId: 'outcome-1:captain', delta: 1, occurredAt: new Date() });

    expect(nextBatter.ev).toBe(3);
    expect(nextCaptain.ev).toBe(1);
    expect(batter.ev).toBe(0);
    expect(captain.ev).toBe(0);
  });
});
