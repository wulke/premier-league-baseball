# Specs: Decoupled IV/EV Person-Attribute Pattern

Implementation-neutral requirements for the shared person-attribute pattern defined in
[`docs/llds/iv-ev-person-attribute-pattern.md`](../llds/iv-ev-person-attribute-pattern.md).
These requirements do not authorize a Sequelize migration or the grader/event system; their future
tests first exercise the pattern through a storage-independent domain contract.

| ID | Requirement | Status |
| --- | --- | --- |
| IVEV-001 | WHEN a person-entity attribute is initialized THE system SHALL retain immutable IV and age-discount meta-modulator values, a signed unbounded EV aggregate, and a bounded recent-delta form window as distinct logical values | [ ] → #244 |
| IVEV-002 | WHEN a person is initialized with named Natures THE system SHALL retain those Natures as immutable person-level traits rather than duplicating anonymous Nature multipliers into each attribute | [ ] → #244 |
| IVEV-003 | WHEN resolving a named Nature for an attribute kind THE system SHALL use that Nature's per-kind multiplier, allowing the same Nature to contribute a multiplier above `1` to one kind and below `1` to another, and SHALL return `1` when no selected Nature applies | [ ] → #244 |
| IVEV-004 | WHEN several selected Natures apply to one attribute kind THE system SHALL compose their per-kind multipliers multiplicatively in stable catalog order | [ ] → #244 |
| IVEV-005 | WHEN calculating an attribute age discount THE system SHALL apply a decline-only, convex/accelerating per-attribute profile with a hard floor and SHALL apply the resulting discount to IV only | [ ] → #244 |
| IVEV-006 | WHEN a consumer reads an attribute through the effective-read pipeline THE system SHALL derive faded capacity from discounted IV, unfaded EV, and resolved applicable-Nature effects, derive form independently from the form window, and SHALL NOT persist or fall back to a global effective attribute | [ ] → #244 |
| IVEV-007 | WHEN a consumer uses the default combination policy THE system SHALL combine faded capacity and form with that policy's linear weighted sum; IF a consumer declares a gated-saturating policy THE system SHALL confine its gates and saturation to that consumer's formula | [ ] → #244 |
| IVEV-008 | WHEN a consumer's catalog policy requires a bounded performance read THE system SHALL clamp only its final consumed value to that policy's bounds and SHALL NOT clamp stored EV; IF the policy declares an aggregate/unclamped read THE system SHALL preserve the unfaded aggregate | [ ] → #244 |
| IVEV-009 | WHEN an attributable graded outcome supplies one signed delta for a person-attribute THE system SHALL atomically add it to EV and append the same delta to the form ring buffer exactly once for that outcome identity | [ ] → #244 |
| IVEV-010 | WHEN an attributable graded outcome has delta zero THE system SHALL append the neutral event to the form window while leaving EV unchanged; IF the form window has no events THE system SHALL read neutral form | [ ] → #244 |
| IVEV-011 | WHEN an entity class adopts the earning loop THE system SHALL declare exactly one delta-zero convention—raw outcome, versus-own-expectation, or versus-league-line—before it applies deltas for that class | [ ] → #244 |
| IVEV-012 | WHEN one graded outcome contributes to several people THE system SHALL apply a separately attributed delta only to each contributor's own attribute state and SHALL NOT write one person's EV or form window through another person's result | [ ] → #244 |
| IVEV-013 | WHEN a consumer requests an IV/EV attribute read without a declared catalog policy THE system SHALL reject the read as a design/configuration error rather than use a global-rating fallback | [ ] → #244 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Decoupled IV/EV Person-Attribute Pattern](../high-level-design.md#hld-decoupled-ivev-person-attribute-pattern)
- LLD: [`docs/llds/iv-ev-person-attribute-pattern.md`](../llds/iv-ev-person-attribute-pattern.md)
- Formula registry: [`docs/FORMULA-REGISTRY.md`](../FORMULA-REGISTRY.md) — `F-IVEV-001..004` (Draft; verified unchanged at EARS stage)
- Tests: Next LID stage — storage-independent domain tests, tagged `@spec IVEV-*`
- Code: Next LID stage — no implementation entry point selected
- Decision record: [#178](https://github.com/wulke/premier-league-baseball/issues/178) → [#209](https://github.com/wulke/premier-league-baseball/issues/209)
