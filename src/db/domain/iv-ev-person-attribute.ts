// @spec IVEV-001..IVEV-013

export type AgeDiscountMeta = {
  primeOffset: number;
  accelerationRate: number;
};

export type AttributeAgingProfile = {
  primeAge: number;
  hardFloor: number;
  yearlyRate: number;
  curvature: number;
};

export type FormDelta = {
  outcomeId: string;
  delta: number;
  occurredAt: Date;
};

export type PersonAttributeState = {
  readonly iv: number;
  readonly ev: number;
  readonly formWindow: readonly FormDelta[];
  readonly ageDiscountMeta: AgeDiscountMeta;
  readonly maxFormEvents: number;
  readonly appliedOutcomeIds: readonly string[];
};

export type NatureCatalogEntry = {
  id: string;
  expressionMultiplierByAttributeKind: Readonly<Record<string, number>>;
};

export type ClampPolicy =
  | { kind: 'bounded'; min: number; max: number }
  | { kind: 'none' };

export type LinearCombinationPolicy = {
  kind: 'linear';
  fadedCapacityWeight: number;
  formWeight: number;
};

export type GatedSaturatingCombinationPolicy = {
  kind: 'gated-saturating';
  fadedCapacityWeight: number;
  formWeight: number;
  gates: readonly { minimum: number; multiplierBelowMinimum: number }[];
  saturationAt: number;
};

export type AttributeReadPolicy = {
  consumerId: string;
  formMode: 'included' | 'excluded';
  usesProjection: boolean;
  combination: LinearCombinationPolicy | GatedSaturatingCombinationPolicy;
  clamp: ClampPolicy;
  aggregate?: 'unfaded-ev';
};

export type AttributeReadResult = {
  fadedCapacity: number;
  form: number;
  combined: number;
  consumed: number;
};

export type DeltaZeroConvention = 'raw' | 'versus-own-expectation' | 'versus-league-line';

export type EarningPolicy = {
  entityClass: string;
  deltaZero: DeltaZeroConvention;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// @spec IVEV-001
export const createAttributeState = ({
  iv,
  ev = 0,
  formWindow = [],
  ageDiscountMeta,
  maxFormEvents,
}: {
  iv: number;
  ev?: number;
  formWindow?: readonly FormDelta[];
  ageDiscountMeta: AgeDiscountMeta;
  maxFormEvents: number;
}): PersonAttributeState => ({
  iv,
  ev,
  formWindow: formWindow.slice(-maxFormEvents),
  ageDiscountMeta: { ...ageDiscountMeta },
  maxFormEvents,
  appliedOutcomeIds: formWindow.map(({ outcomeId }) => outcomeId),
});

// @spec IVEV-002
export const createPersonNatures = (natures: readonly string[]): readonly string[] => Object.freeze([...natures]);

// @spec IVEV-003,IVEV-004
export const resolveNatureMultiplier = (
  personNatures: readonly string[],
  attributeKind: string,
  catalog: readonly NatureCatalogEntry[],
): number => catalog.reduce((multiplier, nature) => {
  if (!personNatures.includes(nature.id)) return multiplier;
  return multiplier * (nature.expressionMultiplierByAttributeKind[attributeKind] ?? 1);
}, 1);

// @spec IVEV-005
export const resolveAgeDiscount = (
  profile: AttributeAgingProfile,
  personAge: number,
  meta: AgeDiscountMeta,
): number => {
  const yearsPastPrime = Math.max(0, personAge - (profile.primeAge + meta.primeOffset));
  const decline = profile.yearlyRate * meta.accelerationRate * Math.pow(yearsPastPrime, profile.curvature);
  return clamp(1 - decline, profile.hardFloor, 1);
};

const deriveForm = (formWindow: readonly FormDelta[], formMode: AttributeReadPolicy['formMode']): number => (
  formMode === 'included' ? formWindow.reduce((sum, { delta }) => sum + delta, 0) : 0
);

const combine = (
  fadedCapacity: number,
  form: number,
  policy: AttributeReadPolicy['combination'],
): number => {
  let result = fadedCapacity * policy.fadedCapacityWeight + form * policy.formWeight;
  if (policy.kind === 'gated-saturating') {
    policy.gates.forEach(({ minimum, multiplierBelowMinimum }) => {
      if (fadedCapacity < minimum) result *= multiplierBelowMinimum;
    });
    result = clamp(result, -policy.saturationAt, policy.saturationAt);
  }
  return result;
};

// @spec IVEV-006,IVEV-007,IVEV-008,IVEV-013
export const readPersonAttribute = ({
  state,
  personNatures,
  attributeKind,
  profile,
  personAge,
  policy,
  catalog,
}: {
  state: PersonAttributeState;
  personNatures: readonly string[];
  attributeKind: string;
  profile: AttributeAgingProfile;
  personAge: number;
  policy: AttributeReadPolicy;
  catalog: readonly NatureCatalogEntry[];
  at: Date;
}): AttributeReadResult => {
  if (!policy) throw new Error('An IV/EV read requires a catalog policy');

  const discount = resolveAgeDiscount(profile, personAge, state.ageDiscountMeta);
  const fadedCapacity = resolveNatureMultiplier(personNatures, attributeKind, catalog)
    * (discount * state.iv + state.ev);
  const form = deriveForm(state.formWindow, policy.formMode);
  const combined = policy.aggregate === 'unfaded-ev' ? state.ev : combine(fadedCapacity, form, policy.combination);
  const consumed = policy.clamp.kind === 'bounded'
    ? clamp(combined, policy.clamp.min, policy.clamp.max)
    : combined;

  return { fadedCapacity, form, combined, consumed };
};

// @spec IVEV-009,IVEV-010,IVEV-012
export const applyEarnedDelta = (state: PersonAttributeState, delta: FormDelta): PersonAttributeState => {
  if (state.appliedOutcomeIds.includes(delta.outcomeId)) {
    throw new Error(`Outcome '${delta.outcomeId}' already applied to this attribute`);
  }

  return {
    ...state,
    ev: state.ev + delta.delta,
    formWindow: [...state.formWindow, delta].slice(-state.maxFormEvents),
    appliedOutcomeIds: [...state.appliedOutcomeIds, delta.outcomeId],
  };
};

// @spec IVEV-011
export const createEarningPolicy = ({ entityClass, deltaZero }: Partial<EarningPolicy> & { entityClass: string }): EarningPolicy => {
  if (deltaZero !== 'raw' && deltaZero !== 'versus-own-expectation' && deltaZero !== 'versus-league-line') {
    throw new Error('An entity class requires exactly one delta-zero convention');
  }
  return { entityClass, deltaZero };
};
