# Worked Example: IV/EV Feasibility — The Stolen-Base Attempt

> **Purpose.** A pressure-test artifact for the **IV/EV feasibility map**. Runs one concrete
> play — a stolen-base attempt — through two model branches (faithful Pokémon **port** vs.
> **reimagined**), to see whether the pattern *feels like a game* or just a spreadsheet, and to
> surface the fog ahead. Not a spec; not a migration plan. Implementation-agnostic.
>
> **Parent map:** _IV/EV Feasibility & Feel Report_ (GitHub issue — see tracker).

## The model under test (locked during charting)

- **IV** = a fixed **innate baseline**, born with, *never moves*. (Not a ceiling, not a cap — a
  reference point the effective value can sit above *or sink below*.)
- **EV** = **earned effort**, stacks on top of IV; **can be negative** (failures erode it).
  Symmetric, bounded `EV ∈ [−C, +C]` (this example uses `[−100, +100]`).
- **No global "effective attribute."** IV and EV **live on attributes** (visible *and* hidden),
  but **each consuming formula owns its own combination** of the two. The pattern is a
  _storage convention + a per-consumer combination contract_, not one algorithm.
- **Aging = sustained −EV drift over time** (Father Time), kept distinct from short-term form
  (a slump). Same quantity, two causal origins → no separate "level" or multiplier.
- **Hidden attributes** carry their own IV/EV and split into two roles: **meta-modulators**
  (feed formulas _about_ the system, e.g. EV-gain rate) and **gameplay-hidden** (drive outcomes
  the player can't see).
- **Universal axiom (scope-narrowed to person-entities):** every game-result formula is
  `f(person-attribute inputs' IV, EV)`. Gear/weather stay flat (out of scope this effort).

## The cast

Each attribute carries `(IV, EV)`. IV fixed; EV ∈ `[−100, +100]`.

| Entity | Attribute | IV | EV | Visible? |
|---|---|---|---|---|
| **Marco** (Runner) | Speed | 22 | +60 | yes |
| | Instinct | 18 | +20 | yes |
| | *Work Ethic* | 25 | +40 | **hidden (meta)** |
| **Díaz** (Catcher) | Arm | 28 | +35 | yes |
| | Accuracy | 20 | +15 | yes |
| **Vargas** (Manager) | Aggression | 15 | +30 | yes — gates the green-light |

---

## Branch B — Reimagined (per-formula weighted combination)

A steal is a **today's-game** read, so the formula weighs current **form (EV)** heavily over raw
**potential (IV)**. That weighting is the formula's *own* choice — the same `(IV, EV)` pair would
combine differently for a scouting report (ceiling-heavy) or a salary read.

```
offense = .3·IV_speed + .9·EV_speed + .2·IV_instinct + .5·EV_instinct
        = .3(22)+.9(60)+.2(18)+.5(20) = 6.6+54+3.6+10 = 74.2

defense = .3·IV_arm + .9·EV_arm + .2·IV_accuracy + .5·EV_accuracy
        = .3(28)+.9(35)+.2(20)+.5(15) = 8.4+31.5+4+7.5 = 51.4

P(safe) = offense / (offense + defense) = 74.2 / 125.6 ≈ 0.59
```

Vargas's high Aggression green-lights it. **Marco is safe (~59%).**

### Outcome feedback (±EV)

- **Positive outcome → +EV** to Speed & Instinct. The *rate* is modulated by the hidden
  **Work Ethic** — a **meta-read**, IV-heavy (grit is mostly innate):
  `WE_eff = .6·IV + .4·EV = .6(25)+.4(40) = 31` → grit multiplier ≈ **1.5×** vs a baseline-20 player.
  `ΔEV_speed = base_award(4) × 1.5 = +6` → Marco's Speed `60 → 66`.
- **Had he been thrown out → −EV.** _Open design choice the example surfaces: does Work Ethic
  also **shrink the loss**? "Learns from failure, doesn't crater" feels right — grit = faster
  gain, slower loss._

---

## Branch A — Faithful Pokémon-port foil (same play)

Flat additive combination, EV-on-success-only, Nature as a blunt +10%/−10% trade.

```
offense = (IV_speed+EV_speed) + (IV_instinct+EV_instinct) = 82 + 38 = 120
defense = (IV_arm+EV_arm) + (IV_accuracy+EV_accuracy)     = 63 + 35 = 98

P(safe) = 120 / 218 ≈ 0.55
```

Same ballpark number — but **structurally incapable** of the distinctions the reimagined branch
makes (potential vs form, ±EV, hidden modulation).

---

## Pressure test — what the example reveals

✅ **Finding 1 — Per-formula weighted combination is the pattern's defining feature.** The *same*
`(IV=22, EV=60)` serves a scouting report (`.9·IV + .1·EV` → "raw ceiling"), today's game
(`.3·IV + .9·EV` → "current form"), and a salary read (aggregate). The flat-additive port reads
**120 in all three contexts** — it literally cannot tell potential from form. _Reimagined wins
decisively here._

✅ **Finding 2 — A single hidden meta-attribute does real work, cheaply.** Work Ethic modulating
EV-gain rate feels like baseball (gritty vets out-develop lazy phenoms from the same reps) and
costs one hidden attribute, not a subsystem.

✅ **Finding 3 — ±EV with symmetric bounds makes slumps and aging fall out of one engine.** No
separate "aging stat," no second multiplier; a sustained −EV drift past prime *is* decline. The
`[−C, +C]` bound is **load-bearing** here — without it, a slump spirals.

⚠️ **Finding 4 — The example surfaces genuine fog (the valuable kind).** Aging/form are wanted
**both** — short-term form (last X events) *and* career aggregate. But **EV is a single number
per attribute** — it collapses the two. The formula above quietly treated EV as "current form,"
yet it's really *all-time net effort*. So: **how is recent form represented?** Candidate shapes:

- **(i)** a separate rolling *form* buffer alongside EV (two quantities);
- **(ii)** EV = aggregate only; form = a recent-events window each formula reads directly;
- **(iii)** **EV decays toward zero over time** so it self-represents recent form — and (deliciously)
  this *also* makes −EV aging cleaner, because old effort naturally fades. _One mechanic, two jobs._

⚠️ **Finding 5 — Does a meta hidden attribute also gate *losses*?** Work Ethic modulated +EV gain
cleanly; whether it should also dampen −EV loss is undecided. Small, but it shapes the feel of
"clutch vs fragile."

---

## Outcome of this artifact

The core engine **held up under a real play**. The example graduated **two sharp questions** out
of the fog (form-vs-aggregate; does-grit-shrink-losses) and confirmed the reimagined branch is the
worthier spine, with the port kept as a structural foil — not the destination. These feed open
tickets on the map.
