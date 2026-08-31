# LLD: Decoupled IV/EV Person-Attribute Pattern

> Upstream: [HLD: Decoupled IV/EV Person-Attribute Pattern](../high-level-design.md#hld-decoupled-ivev-person-attribute-pattern) ·
> Formula registry: [`docs/FORMULA-REGISTRY.md`](../FORMULA-REGISTRY.md) (`F-IVEV-001..004`, Draft) ·
> Decision record: [Map #178](https://github.com/wulke/premier-league-baseball/issues/178) →
> [GO decision #209](https://github.com/wulke/premier-league-baseball/issues/209)

## Scope

Defines the implementation-neutral component contract for a shared IV/EV pattern: logical state,
read policies, formula catalog boundaries, and event-delta application. It applies to every
person-entity attribute (Player, Manager, Scout, Umpire, and future person-entities).

It does **not** select a Sequelize representation, migrate `Player.attributes`, create entity
attribute catalogs, tune constants, define a grader, or implement a first consumer. The current
flat player ratings remain a separate, pre-pattern schema until a dedicated migration/storage
slice adopts this contract.

## Interface / Data Model

### Person-attribute state

```ts
/** Logical state only; persistence layout is deliberately deferred. */
type PersonAttributeState = {
  iv: number;                         // fixed innate baseline; never written after generation
  ev: number;                         // signed, unfaded, unbounded career aggregate
  formWindow: readonly FormDelta[];   // newest bounded ring-buffer slice of the same delta stream
  ageDiscountMeta: AgeDiscountMeta;   // fixed hidden person-level modulator
};

type FormDelta = {
  delta: number;
  outcomeId: string;                  // future grader's idempotency identity; no storage choice here
  occurredAt: Date;
};

/** Opaque here: one fixed axis jointly determines prime offset and acceleration. */
type AgeDiscountMeta = unknown;

type AttributeAgingProfile = {
  id: string;
  // Defines a convex, accelerating, decline-only family and a hard floor.
  // Prime, floor, curvature, and all numerical values are tuning.
};
```

`iv` and `ageDiscountMeta` are generation-time invariants. `ev` and `formWindow` are the only
members the earning loop changes. A zero delta is still a real, neutral recent event: it is
appended to the window and adds zero to EV, allowing old form observations to age out by the same
ring-buffer rule as every other event.

`FormDelta` expresses the logical ordering/idempotency input required from the future grader. The
event system decides its identity, attribution, timing, and comparison mode; this LLD does not
choose a table, queue, or transaction boundary for it.

### Named person-level Natures

```ts
/** Logical identity only; the catalog owns names, descriptions, and effects. */
type PersonNatures = readonly NatureId[];
type NatureId = string;

type NatureCatalogEntry = {
  id: NatureId;
  // Absent means no-op (×1); one named Nature may raise one kind and lower another.
  expressionMultiplierByAttributeKind: Readonly<Record<string, number>>;
};
```

Natures are selected when a person is generated and never changed by the earning loop. They are
standalone named traits on the person, not anonymous values duplicated into each attribute. The
catalog owns their presentation identity and per-kind effects. A single Nature can explicitly
carry both a positive target (`× > 1`) and a negative target (`× < 1`), as Pokémon Natures do.
Multiple applicable Natures compose as the product of their fixed multipliers in stable catalog
order; no applicable Natures yields `1`. The number of Natures, names, target kinds, and multiplier
values remain tuning/flavor decisions rather than a persistence choice.

### Read policy and catalog entry

```ts
type ClampPolicy =
  | { kind: 'bounded'; min: number; max: number }
  | { kind: 'none' };

type CombinationPolicy =
  | {
      kind: 'linear';
      fadedCapacityWeight: number;
      formWeight: number;
    }
  | {
      kind: 'gated-saturating';
      // Formula-local per-attribute gates and saturation parameters.
      // Their shape and values belong to that formula's catalog entry.
    };

type AttributeReadPolicy = {
  consumerId: string;
  combination: CombinationPolicy;
  clamp: ClampPolicy;
  usesProjection: boolean;
  formMode: 'included' | 'excluded';
};
```

The catalog is keyed by the **consuming formula**, not by entity type and not by a universal
attribute rating. Its first entries carry these contract-level policies:

| Consumer | Capacity/form emphasis | Clamp | Projection |
| --- | --- | --- | --- |
| Manager/game decision | Form-heavy linear default; may use formula-local gate+saturation for a collapsed specialist dimension | bounded | no |
| Scout | IV-heavy, form-excluded or form-light talent/trajectory read | consumer-declared | yes |
| Salary | unfaded career aggregate, form-excluded | none | no |

The values, selected attributes, and any specialist gate/saturation shape are intentionally not
tuned here. A consumer must declare one catalog entry before it may read this state.

## Logic Flow

### `F-IVEV-004`: applicable-Nature resolution

```
resolveNatures(personNatures, attributeKind):
  effects = NatureCatalog entries named by personNatures
    .map(entry => entry.expressionMultiplierByAttributeKind[attributeKind])
    .filter(effect => effect is present)
  return product(effects in stable catalog order), or 1 when empty
```

This resolver makes a Nature's applicability visible and deterministic. It returns a multiplier;
it does not mutate an attribute or introduce a second rating.

### `F-IVEV-002`: age-discount read

```
ageDiscount(profile, personAge, ageDiscountMeta):
  derive the profile's prime offset and acceleration from ageDiscountMeta
  d = profile's convex, accelerating decline curve at personAge
  return clamp(d, profile.hardFloor, 1)
```

The result never rewards aging: it cannot exceed `1`. It applies to IV only, which removes the
signed-input positive-regression problem: a negative earned aggregate is never made less negative
by multiplying the whole `(IV + EV)` value.

### `F-IVEV-001`: effective person-attribute read

```
readAttribute(state, personNatures, attributeKind, profile, personAge, policy, at):
  discount = ageDiscount(profile, personAge, state.ageDiscountMeta)
  natureMultiplier = resolveNatures(personNatures, attributeKind)
  fadedCapacity = natureMultiplier * (discount * state.iv + state.ev)
  formRead = deriveForm(state.formWindow, at)       // neutral when the window is empty

  IF policy reads an unfaded aggregate directly:
    return policy-owned aggregate read of state.ev  // e.g. salary; no final clamp

  combined = policy.combine(fadedCapacity, formRead)
  return policy.clamp(combined)
```

`deriveForm` reads only the ring buffer and never writes or age-discounts it. `at` is the
consumer's read time; projection is a policy-owned forward read over the same state, never a
mutation or a second stored rating. The default `linear` combination is a weighted sum. The
`gated-saturating` arm is an explicit opt-in for a formula where a collapsed dimension must reduce
the outcome more than a sum can represent; it may not change `fadedCapacity`, `formRead`, or the
storage tuple.

### `F-IVEV-003`: earned-delta application

```
applyDelta(state, delta):
  require delta was attributed by the grader to this person-attribute
  require delta.outcomeId has not already been applied to this attribute
  nextEV = state.ev + delta.delta
  nextWindow = appendAsRingBuffer(state.formWindow, delta)
  return state with { ev: nextEV, formWindow: nextWindow }
```

The append is atomic with the EV addition in the eventual persistence design: a single graded
outcome must not update one view without the other. The IV/EV component neither calculates delta
nor decides whether a Player, Manager, Scout, or Umpire deserves attribution. For every entity
class, the future grader must select exactly one delta-zero convention: raw outcome, versus-own-
expectation, or versus-league-line.

## Edge Case Probe

| # | Condition | Handling | Formula |
| --- | --- | --- | --- |
| e1 | A future grader retries the same attributable outcome | `outcomeId` must be idempotent per `(person, attribute)` before `applyDelta`; the eventual persistence layer enforces this identity. No duplicate EV addition or form append. | F-IVEV-003 |
| e2 | Delta is zero | Append the neutral event and add zero to EV. It advances recency without inventing earned history. | F-IVEV-003 |
| e3 | No recent events, as with a sparse Scout or season-graded Manager | `deriveForm([])` is the neutral form value. A dormant window is valid, not an error or a fabricated slump. | F-IVEV-001 |
| e4 | EV is large or negative | Storage remains unbounded and signed. Only a bounded consumer's final read clamps; IV-only discounting cannot improve a negative aggregate through aging. | F-IVEV-001/002 |
| e5 | Before prime or past extreme age | `F-IVEV-002` returns at most `1` before/at prime and never below the profile hard floor afterward. It never creates a development bonus or erases an attribute. | F-IVEV-002 |
| e6 | Specialist has one collapsed required dimension | The owning formula explicitly chooses `gated-saturating`; a linear default must not silently acquire global gates. | F-IVEV-001 |
| e7 | Salary needs career history while a game decision needs present performance | Salary selects its aggregate/unclamped catalog entry; the game consumer selects a capacity+form bounded entry. Neither writes a global effective rating. | F-IVEV-001 |
| e8 | One outcome contributes to several people | The grader creates one attributable delta per `(person, attribute)` contribution. Each call writes only that person's state; cross-person effects are reads, never shared storage writes. | F-IVEV-003 |
| e9 | A person has no applicable Nature for an attribute | `F-IVEV-004` returns `1`; the named trait is a no-op for that attribute, with no placeholder numeric value persisted in the attribute. | F-IVEV-004 |
| e10 | One Nature has a positive and a negative target | Its catalog entry maps the positive kind to a multiplier above `1` and the negative kind to one below `1`; the same named Nature resolves independently for each requested attribute. | F-IVEV-004 |
| e11 | Several named Natures apply to one attribute | `F-IVEV-004` composes their fixed effects multiplicatively in stable catalog order. The catalog, not attribute storage, owns the definition. | F-IVEV-004 |
| e12 | A consumer has no catalog entry | It cannot make an IV/EV read. The missing policy is a design error to resolve before implementation, not a fallback to a global rating. | F-IVEV-001 |

## Dependency / Ownership Boundary

```
future grader/event system (#218)
  owns outcome identity, attribution, delta, delta-zero convention
  → F-IVEV-003 owns atomic state transition: EV + formWindow
  → F-IVEV-002 owns IV-only age discount
  → F-IVEV-004 owns applicable-Nature resolution
  → F-IVEV-001 owns shared state projection
  → consumer formula owns its catalog policy and consumed outcome
```

This order prevents the attribute pattern from smuggling in a grader and prevents a consumer from
reimplementing the shared aging/form/storage semantics. It also keeps a future schema migration
behind the pattern boundary rather than making today's `Player.attributes` JSON a de facto API.

## Traceability

| Layer | Artifact |
| --- | --- |
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-decoupled-ivev-person-attribute-pattern) |
| **This LLD** | `docs/llds/iv-ev-person-attribute-pattern.md` |
| Formula registry | [`docs/FORMULA-REGISTRY.md`](../FORMULA-REGISTRY.md) — `F-IVEV-001..004` (Draft) |
| EARS | [`docs/specs/iv-ev-person-attribute-specs.md`](../specs/iv-ev-person-attribute-specs.md) — `IVEV-001`..`IVEV-013` |
| Tests | Next LID stage — Red tests follow EARS |
| Code | Next LID stage — no implementation entry point selected |
| Decision record | [#178](https://github.com/wulke/premier-league-baseball/issues/178) → [#209](https://github.com/wulke/premier-league-baseball/issues/209) |
