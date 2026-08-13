# Worked Example: IV/EV Feasibility — The Pitcher-vs-Batter At-Bat

> **Purpose.** A pressure-test artifact for the **IV/EV feasibility map**. Runs the most
> attribute-dense play in baseball — a pitcher's **stuff / command / control** vs. a
> batter's **eye / contact / power** — through the two model branches (faithful Pokémon
> **port** vs **reimagined**), with **3 + 3 = 6 attributes feeding one outcome**. It asks
> three things the map has been building toward:
>
> 1. **Does the reimagined branch still distinguish potential from form** when so many
>    attributes feed one outcome — i.e. does per-formula weighted combination survive
>    the load? *(the ticket's core question)*
> 2. **Where does linearity break** — the starting contract is a weighted sum; baseball
>    may demand thresholds / diminishing returns. *(the combination-catalog fog)*
> 3. The two **#184-scope edge tests**: the **no-positive-regression** edge (does the
>    provisional *asymmetric-freeze* hold or read wrong?) and the **elite-compression**
>    check (prime-age elite vs aging elite — distinct, or blurred at `+C`?).
>
> Not a spec; not a migration plan. Implementation-agnostic. **All constants (`C`,
> weights, age-discount values, primes) are illustrative** — this map fixes *mechanics*,
> not tuning. Every number below is a reproducible artifact of
> [`iv-ev-feasibility-at-bat.ts`](./iv-ev-feasibility-at-bat.ts) (run with `ts-node`),
> not a proposed balance.
>
> **Parent map:** _IV/EV Feasibility & Feel Report_ ([#178](https://github.com/wulke/premier-league-baseball/issues/178)).

## The model under test (locked by the map so far)

The **effective-read pipeline** settled across [#179](https://github.com/wulke/premier-league-baseball/issues/179) → [#181](https://github.com/wulke/premier-league-baseball/issues/181) → [#183](https://github.com/wulke/premier-league-baseball/issues/183) → [#184](https://github.com/wulke/premier-league-baseball/issues/184):

```
CAPACITY (per attribute a):
   raw_a   = IV_a + EV_a                         # combine (per-attr)
   cap_a   = Nature_a × raw_a                    # Nature — fixed-at-birth ±% trade (#183)
   faded_a = ageDiscount_a × cap_a               # convex, per-attr, ≤1.0 (#184)
             ⚠ if raw_a < 0: FROZEN (asymmetric-freeze, #184 Q8 — PROVISIONAL, under test here)
FORM (per attribute a):
   form_a  = Σ(recent event-deltas)              # ring window, NOT age-discounted (#181)
PER FORMULA:
   strength = clamp[−C,+C] ( Σ_a wCap_a·faded_a  +  formW·Σ_a wForm_a·form_a )
   P(outcome) = strength_P / (strength_P + strength_B)        # Bradley-Terry
```

The at-bat is a **today's-game read**, so it weighs **form** heavily (as the steal example
[#180](https://github.com/wulke/premier-league-baseball/issues/180) established). `C = 85`
is chosen *illustratively low* so that a **prime elite binds the `+C` ceiling** — the
worst case for the compression worry (§3).

## The cast

Each attribute carries `(IV, EV, Nature)`; everyone is prime-age (age-discount ≈ 0.99).

| Entity | Attribute | IV | EV | Nature | recent form |
|---|---|---|---|---|---|
| **Cole** (P) | Stuff | 24 | +60 | **1.10** | +10 |
| | Command | 19 | +48 | **0.90** | +4 |
| | Control | 17 | +38 | 1.00 | +3 |
| **Ramírez** (B) | Eye | 19 | +44 | 1.00 | +2 |
| | Contact | 21 | +42 | 1.00 | +5 |
| | Power | 25 | +52 | **1.10** | +7 |

Cole trades Command for Stuff (the power-pitcher Nature); Ramírez is a +Power slugger.

---

## Branch B — Reimagined (per-formula weighted combination)

```
faded capacities:  P Stuff 84×1.10×0.99 = 91.5   Cmd 67×0.90×0.99 = 59.7   Ctrl 55×1.00×0.99 = 54.5
                   B Eye 63×1.00×0.99 = 62.4      Contact 63×1.00×0.99 = 62.4   Power 77×1.10×0.99 = 83.9

pitcher_strength = .5·91.5 + .3·59.7 + .2·54.5 + .5·(.5·10+.3·4+.2·3) = 77.9   (< C, not clamped)
batter_strength  = .3·62.4 + .4·62.4 + .3·83.9 + .5·(.3·2+.4·5+.3·7) = 71.2

P(pitcher gets the outcome) = 77.9 / (77.9 + 71.2) ≈ 52%     ← a real, non-trivial read
```

The same `(IV, EV)` would combine **differently** for a scouting report (ceiling-heavy on
`faded capacity`, form-weight → 0) or a salary read (aggregate `EV`). Form moves the read
±without touching capacity; potential (IV) and career aggregate (unfaded EV) stay inspectable
outside the clamp. **Six attributes in, the engine still separates potential from form.**

## Branch A — Faithful Pokémon-port foil (same play)

Flat additive, EV-monotonic (success-only), Nature a blunt ±10%, **no form, no aging, no
effective-read clamp** ([#182](https://github.com/wulke/premier-league-baseball/issues/182)):

```
pitcher = 1.10·(24+60) + 0.90·(19+48) + 1.00·(17+38) = 208
batter  = 1.00·(19+44) + 1.00·(21+42) + 1.10·(25+52) = 211      P ≈ 50%
```

Same ballpark probability — but **structurally incapable** of every distinction above: one
number in every context, cannot slump, cannot age, cannot distinguish potential from form.
Kept as the foil, not the destination (consistent with [#180](#)).

---

## §2 — The no-positive-regression edge (#184 Q8, provisional)

The age-discount is a multiplier on a **signed** input (`IV+EV`, which can go negative per
[#179](#)). Take **Thomás**, an age-38 slugger whose Contact has eroded to `IV 28, EV −50 →
raw = −22`, age-discount ≈ 0.80. The four candidate mechanics read this *one* attribute:

| mechanic | formula | faded read | verdict |
|---|---|---|---|
| **(bug)** blind multiplier | `0.80 × −22` | **−17.6** | ⛔ *improved* — **positive regression**, physically backwards |
| **(a)** asymmetric-freeze *(provisional)* | freeze if `raw<0` | **−22** | ⚠ age **stops biting** once you're bad |
| **(b)** subtractive erosion | `−22 − Δ(age)` | **−38.5** | ✓ keeps declining (correct direction) |
| **(c)** discount-IV-only / EV-resists | `0.80·28 + (−50)` | **−27.6** | ✓ keeps declining, gentler ("crafty veteran") |

**Finding — the freeze reads wrong at exactly the edge it was meant to protect.** A fading
veteran whose tool is *gone* should keep declining; freezing means "once bad, age no longer
matters" — which inverts the aging story precisely where Father Time should bite hardest.
The freeze was chosen only to dodge the blind multiplier's sign-flip; **(b)** and **(c)**
both dodge it *and* keep declining — the real fix is one of them. **Recommendation: overturn
the provisional freeze; adopt (c) discount-IV-only** (cleanest math, most baseball-poetic —
earned craft endures, innate wheels fade), with **(b)** held as the alternative. The
**(b)-vs-(c)** lock is an author feel-call; posted as a cross-ref on [#184](#) so its
provisional Q8 reads one click from the evidence.

---

## §3 — The elite-compression sweep (#184's deferred quantitative flag)

Two aces, **identical peak attribute profile**, different aging meta-modulator
([#184](#)'s combined prime-offset + accel-rate): **Toolsy Cole** (prime 25, fades fast) vs
**Crafty Marcus** (prime 28, endures). Per-attribute fade: Stuff fast (×1.4), Control (×1.0),
Command slow (×0.6); prime offsets Stuff −1 / Command +2; hard floor 0.5. `C = 85`.

| age | Toolsy: Stuff/Cmd/Ctrl → str | Crafty: Stuff/Cmd/Ctrl → str | read |
|---:|---|---|---|
| 24 | 119 / 76.5 / 64.0 → **85·CEIL** | 119 / 76.5 / 64.0 → **85·CEIL** | both clamped — blurred |
| 25 | 111 / 76.5 / 64.0 → **85·CEIL** | 119 / 76.5 / 64.0 → **85·CEIL** | both clamped — blurred |
| 27 | 75 / 76.5 / 55 → 71.7 | 119 / 76.5 / 64.0 → **85·CEIL** | **distinct** |
| 29 | 59 / 70 / 37.5 → 58.3 | 106 / 76.5 / 62.4 → **85·CEIL** | **distinct** |
| 31 | 59 / 57.5 / 32 → 53.4 | 80.6 / 75.4 / 54.7 → 73.8 | **distinct** |
| 33 | 59 / 40 / 32 → 48.2 | 59 / 70 / 43 → 59.3 | **distinct** |
| 35 | 59 / 38 / 32 → 47.6 | 59 / 61 / 32 → 54.5 | **distinct** |
| 38 | 59 / 38 / 32 → 47.6 | 59 / 44 / 32 → 49.5 | **distinct** |

**Finding — compression is real at the ceiling, but confined to the prime flat-top; the
per-player accel-rate spreads the top at the margin.** Both elites pin `+C` across their
(overlapping) prime window — *that* is the "too many elites blurred together" worry made
concrete. But they **leave the ceiling at different ages** (Toolsy ~27, Crafty ~31) and stay
distinct throughout the decline, converging only toward the hard floor at the very end.
[#184](#)'s qualitative read ("peak-duration varies by player ⟹ spreads the top ⟹ *reduces*
compression at the margin") **holds quantitatively**. "Blurring" is the **intended flat-top of
a career**, not a defect — acceptable as far as feasibility can show without a locked `C`.

> **Sub-question left as fog — Nature-vs-clamp ordering.** Under the current pipeline Nature
> sits **before** the final clamp, so a `+Nature` speedster's higher capacity hits `+C` sooner
> (more compression among same-Nature elites at the ceiling). The alternative — Nature
> **after** the clamp — lets a Speedster break `+C` (spread, but the bound stops meaning "peak
> performance"). Sharp, but depends on `C` + per-formula weights (**tuning**) → stays fog.

---

## §4 — The linearity break (the ticket's core stress-test)

Two pitchers with the **same weighted average** but opposite shapes — a **Specialist**
(overpowering Stuff, collapsed Command/Control — walks the park) vs a **Balanced** craftsman:

| pitcher | faded Stuff / Cmd / Ctrl | **linear** strength | **nonlinear** strength |
|---|---|---:|---:|
| Specialist | 131 / 15.1 / 16.8 | **73.3** | **34.9** |
| Balanced | 76.2 / 62.4 / 69.3 | **70.7** | **70.7** |

A pure weighted sum reads them **~identical** (the Specialist even *slightly higher*!) — yet
they are opposite pitchers. **The linear combine has no notion of a collapsed dimension.**
This is where the starting contract breaks. Baseball demands **per-attribute nonlinearity**
inside the combine — two illustrative transforms flip the read correctly:

- **Threshold gate** — a dimension below a floor (Command < 35) *amplifies downward* (walks
  spike): the Specialist's collapsed Command is punished.
- **Saturation / diminishing returns** — a dimension above a ceiling (Stuff > 100) adds only
  `√` excess: the Specialist's stacked Stuff stops compounding.

Under `gate + saturation` the Specialist drops to **34.9** and the Balanced ace holds
**70.7** — the distinction a sim needs.

**Finding — the break is real, but it stays *inside* a formula's combine.** The nonlinearity
is a property of *one formula's combination function*, not of the `(IV, EV, Nature,
form-window)` storage or the universal axiom `f(person-inputs' IV, EV)`. The pattern **absorbs
the complexity without growing it**: storage stays the clean 4-tuple; each formula owns its own
(gate / saturation / interaction) shape. This sharpens the **combination-catalog** fog (which
formulas need which nonlinear treatment) — now evidenced, not just suspected — but it is not
itself a go/no-go blocker; it is work for the eventual spec.

---

## Outcome of this artifact

1. **Per-formula weighted combination survives the attribute-dense case** (6 attrs → 1
   outcome) and **still separates potential from form** — the reimagined branch's defining
   feature holds under the heaviest load tested. **Reimagined confirmed again; port stays the
   foil.**
2. **Linearity breaks at the combine** — baseball needs per-attribute gates/saturation — but
   the break is **local to a formula's combine**, leaving storage and the axiom untouched
   (sharpens combination-catalog fog; not a go/no-go blocker).
3. **The provisional asymmetric-freeze is overturned by evidence** (§2): it freezes decline
   exactly when aging should bite hardest. **Recommend (c) discount-IV-only**; the (b)-vs-(c)
   lock is an author feel-call, cross-referenced onto [#184](#).
4. **Elite-compression is quantified** (§3): compression is real but confined to the prime
   flat-top; the per-player accel-rate spreads the top at the margin. [#184](#)'s qualitative
   read confirmed; Nature-vs-clamp ordering stays fog (tuning-dependent).

**Storage contract untouched by every stress above** — the strongest single feasibility
signal this example produces. Feeds the go/no-go (still pending #187 / #188).
