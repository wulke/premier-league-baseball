# Formula Registry

Canonical index of formula contracts. A formula's owner, inputs, output, dependencies, trigger,
and status are maintained here; LLDs explain the surrounding component behavior.

| ID | Formula | Owner | Reads | Writes / Influences | Depends On | Used By | Trigger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-IVEV-001 | Effective person-attribute read | Future IV/EV pattern module | Person attribute state (`IV`, `EV`, `formWindow`, `ageDiscountMeta`), person-level named Natures, attribute kind, per-attribute aging profile, consumer read policy, read time | A consumer's faded-capacity/form/aggregate input; normally a clamped consumed value | F-IVEV-002, F-IVEV-004 | Future game, manager, scout, and salary formula catalog entries | A consumer requests an attribute read | Draft |
| F-IVEV-002 | IV-only age discount | Future IV/EV pattern module | Person age, per-attribute aging profile, fixed `ageDiscountMeta` | Decline-only discount in `[floor, 1]` applied to IV before IV/EV capacity composition | None | F-IVEV-001 | F-IVEV-001 evaluates an age-sensitive read | Draft |
| F-IVEV-003 | Earned delta application | Future IV/EV pattern module | Existing person-attribute state and one grader-attributed signed delta | Adds delta to unbounded EV and appends it to the bounded form ring buffer | Future grader/event system (#218) | F-IVEV-001, future event application | A grader accepts one attributable outcome | Draft |
| F-IVEV-004 | Applicable-Nature resolution | Future IV/EV pattern module | Fixed person-level named Natures, attribute kind, Nature catalog's per-kind multipliers | Fixed expression multiplier for that attribute; a Nature may contribute `>1` to one kind and `<1` to another; `1` when no Nature applies | None | F-IVEV-001 | F-IVEV-001 reads an attribute | Draft |

## Registry conventions

- **Draft** entries define approved architecture but have no persistence, API, UI, or simulation
  implementation yet.
- A consumer-specific combination is a catalog policy consumed by `F-IVEV-001`; it is not a new
  storage formula. A new consumer must be added to this registry only if it changes the formula's
  inputs, output, dependency, owner, or trigger.
- The grader/event system owns attribution and delta calculation. It is an external dependency of
  `F-IVEV-003`, not a hidden responsibility of the IV/EV pattern.
