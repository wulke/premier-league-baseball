# Worked Example: IV/EV Feasibility — The Umpire's Ball/Strike Call

> **Purpose.** A pressure-test artifact for the **IV/EV feasibility map**. Runs the
> **cleanest non-Player earning case** ([#185](https://github.com/wulke/premier-league-baseball/issues/185)'s
> words) — an umpire calling balls and strikes, graded by replay — through the two model
> branches (faithful Pokémon **port** vs **reimagined**). It asks the three things the
> ticket names:
>
> 1. **What earns EV for a Referee?** An umpire has no "game outcome" in the player
>    sense — the write side (the earning loop) is the star here, not the read side.
> 2. **Does a hidden meta-attribute ("Focus") slot in as cleanly as a Player's Work Ethic** ([#180](https://github.com/wulke/premier-league-baseball/issues/180))?
> 3. A **third angle** on the (b)-vs-(c) age-discount feel-call ([#184](https://github.com/wulke/premier-league-baseball/issues/184) / [#186](https://github.com/wulke/premier-league-baseball/issues/186)).
>
> Not a spec; not a migration plan. Implementation-agnostic. **All constants (σ scales,
> δ, baselines, primes) are illustrative** — this map fixes *mechanics*, not tuning. Every
> number below is a reproducible artifact of
> [`iv-ev-feasibility-umpire.ts`](./iv-ev-feasibility-umpire.ts) (run with `ts-node`;
> the career sims are seeded).
>
> **Parent map:** _IV/EV Feasibility & Feel Report_ ([#178](https://github.com/wulke/premier-league-baseball/issues/178)).

## The model under test (locked by the map so far)

The **effective-read pipeline** settled across [#179](https://github.com/wulke/premier-league-baseball/issues/179) → [#181](https://github.com/wulke/premier-league-baseball/issues/181) → [#183](https://github.com/wulke/premier-league-baseball/issues/183) → [#184](https://github.com/wulke/premier-league-baseball/issues/184), with [#186](https://github.com/wulke/premier-league-baseball/issues/186)'s recommendation:

```
CAPACITY (per attribute a):
   raw_a   = IV_a + EV_a                         # EV storage: unbounded career aggregate (#181)
   faded_a = Nature_a × (ageDisc_a × IV_a + EV_a) # (c) discount-IV-only (#184 curve, #186 rec)
FORM (per attribute a):
   form_a  = Σ(recent event-deltas)              # ring window, NOT age-discounted (#181)
PER FORMULA (this one owns its own combination, #179):
   σ_acuity = K_A / read(Acuity)                 # discrimination floor (read clamped [8,110])
   σ_scatter = K_S·(1 − read(Consistency)/S_REF) # zone scatter (clamped ≥ 0)
   φ = 1 + lev·max(0, F_REF − read(Focus))/F_REF # fatigue amplifier — Focus's READ-side meta role
   P(correct | pitch margin m) = Φ(|m| / (σ_acuity + σ_scatter)·φ)
WRITE (per graded call — replay ground truth, #185 Q7):
   δ = k·(1[correct] − p̄)·gainMult(Focus)        # surprise vs league line, × Focus's WRITE-side meta role
   EV_a += w_a·δ  (same δ into the form window)   # split across the attrs the formula read
```

The call formula is a **degenerate duel**: the umpire's "opponent" is the rulebook zone —
a constant baseline, not another person-entity. The pitch's true margin `m` is a **flat
world input** (per #179's axiom: person-attrs carry IV/EV; the world stays flat). This is
the map's **first single-person formula** — the axiom `f(person IV, EV)` holds with one
signatory.

## The cast

Two primes, two roads to the same white shirt (age 34, age-discount ≈ 0.99):

| Entity | Attribute | IV | EV | Nature | visible? |
|---|---|---|---|---|---|
| **Moreno** "The Machine" (talent) | Acuity | 60 | +32 | **1.08** | yes |
| | Consistency | 48 | +10 | 1.00 | yes |
| | *Focus* | 30 | +2 | 1.00 | **hidden (meta)** |
| **Okafor** "The Grinder" | Acuity | 52 | +26 | 1.00 | yes |
| | Consistency | 48 | +44 | **1.10** | yes |
| | *Focus* | 30 | +36 | 1.00 | **hidden (meta)** |
| **Kowalski** (the washout) | all three | 42 / 40 / 28 | 0 → | 1.00 | IVs **below** the league line |

The umpire catalog is illustrative ([#185](https://github.com/wulke/premier-league-baseball/issues/185):
only the catalog differs per entity). Focus plays **two meta-modulator roles** — read-side
(fatigue amplifier inside the call formula) and write-side (EV-gain multiplier, the exact
"EV-gain rate" role #179 named and #180 gave Work Ethic) — with one ordinary
`(IV, EV, Nature, form)` tuple.

---

## §1 — The call read (reimagined vs port)

**Reimagined.** P(correct) by pitch margin × leverage:

| Umpire | state | σ | P(6″ fat) | P(2″ edge) | P(0.75″ paint) |
|---|---|---|---|---|---|
| Moreno | calm | 1.65″ | 100.0% | **88.8%** | 67.5% |
| Moreno | wired (9th) | 2.11″ | 99.8% | **82.9%** | 63.9% |
| Okafor | calm | 1.69″ | 100.0% | **88.2%** | 67.1% |
| Okafor | wired | 1.69″ | 100.0% | **88.2%** | 67.1% |

Two roads to the same calm-night read: the talent **sees** it (σ_acuity 1.33); the grinder
never **wavers** (scatter 0.00). In the 9th the talent wobbles (untrained Focus, φ 1.28 —
−5.9pp on the edge call); the grinder does not move. **Neither distinction exists in the
port.**

**Pokémon-port foil.** Flat additive → one number, one σ, every context:
Moreno 150 → σ 1.75″ (P 87.4% on 2″), Okafor 170 → σ 1.54″ (P 90.3%) — same ballpark
numbers, but structurally blind: no fatigue state, no slump, no career arc. The port cannot
even *ask* whether the talent is worse wired than calm — it has no such lever. And Focus
has no read-side slot at all in the port (a flat sum has nowhere to put a modulator).

## §2 — The earning loop: what earns EV for a Referee

Seeded 25-season sim (115 games × 95 called pitches; league line p̄ = .905; every call
graded vs replay; δ split across attrs by the formula's weights):

| age | Moreno acc | EV (A/C/F) | Okafor acc | EV (A/C/F) | Kowalski acc | EV (A/C) |
|---|---|---|---|---|---|---|
| 24 | 93.3% | +1 / +1 / 0 | 91.8% | +1 / 0 / 0 | 86.7% | −2 / −1 |
| 32 | 95.5% | +14 / +9 / +6 | 92.2% | +6 / +4 / +2 | 66.7% | −36 / −22 |
| 40 | 96.7% | +36 / +21 / +14 | 94.5% | +19 / +11 / +8 | 59.2% | −106 / −63 |
| 48 | 97.6% | +63 / +38 / +25 | 95.4% | +34 / +21 / +14 | 58.2% | −172 / −103 |

- **What earns EV:** being better than the keep-your-job line on calls replay can grade —
  *nothing else writes*. Moreno is +EV from year 1 (born reads above the line). Okafor
  starts barely above it with a **slow gain loop** (Focus gain-mult 0.96 as a rookie) — a
  decade of dues while his Focus EV compounds the gain rate (mult 1.39 by prime) — then
  climbs to .954: two points shy of the talent (the IV ceiling is real) but a star. Note
  Moreno's wired-σ gap **closes over his career** (3.30→1.26 spread at 24; 1.26→1.26 at
  48): his Focus EV *trains*. Same ±δ loop a Player walks — no "umpire XP" subsystem.
- **Kowalski (IVs below the line):** the loop is a one-way door **down** — every call
  writes −δ, reads sink, σ widens, worse calls. He does not "develop through it"; **the
  spiral IS the talent evaluation** (in the sim league he never leaves Triple-A).
- **Port foil, write side:** the faithful port accrues EV by **activity** (games worked —
  its EVs come from reps, not results), so all three accrue identically over 25 seasons.
  Call quality is structurally invisible to it. **The port dies hardest on the write side.**

### The δ-zero spectrum (the convention this example surfaces)

The write side must choose **what δ measures against** — invisible for Players, forced
here:

| δ rule | behavior | breaks |
|---|---|---|
| **raw ±sign** (player-style, #180) | everyone above coin-flip earns | a .95 umpire can *never* slump — window saturates positive; reputation unreadable |
| **vs own expectation** | δ ≈ 0 forever | self-fulfilling; no development channel at all |
| **vs league line** (used here) | slump readable, development compounds for the selected | doom-spiral for the below-line — which is *selection working* |

For 50/50 duels all three coincide — which is why #180 never saw the choice. The zero is a
**grader-side choice** (#185 kept graders out of scope, same bucket as `C`), but every
truth-graded entity class must pick one, and the pick changes what EV *means*. This is a
write-side convention for the eventual spec, not an amendment to the storage/axiom.

## §3 — Reputation vs shaky month (two timescales, high-frequency end)

Prime Moreno (age-34 snapshot, career .958) has a month at .870 — the ejection, the viral
clip. One storage, three reads:

- **Reputation card** (formW→0, reads faded capacity): still elite — 85% on 2″ calls.
- **This-month report** (the window): Σδ = 1200·0.008·(.870−.905) = **−0.336** (a normal
  month: +0.505) — negative. *"His zone has been drifting."*
- **Tonight's formula** (formW 40): P(2″) 83.2% vs 84.7%, P(0.75″) 64.1% vs 65.0% — a
  point and a half on the border calls ≈ 2–3 extra blown calls a month: visible in the
  grade sheet, invisible in the career line, gone when the window rolls over.

The [#181](https://github.com/wulke/premier-league-baseball/issues/181) partition at the
**high-frequency end** of the spectrum (#185's dormant-window end is the Scout, #188):
a ~120k-call career aggregate vs a 1200-call window, one δ writing to both. The player
couldn't slump below coin-flip; the umpire can't slump below the *line* — but below the
line is exactly where reputations live.

## §4 — Father Time, third angle: (b) subtractive vs (c) discount-IV-only

Both umps frozen at career-end EVs; per-attribute primes Acuity 33 / Consistency 45 / Focus 38:

| age | Moreno (c) A/C/F | Moreno (b) A/C/F | Okafor (c) A/C/F | Okafor (b) A/C/F |
|---|---|---|---|---|
| 34 | 132 / 86 / 55 | 133 / 86 / 55 | 86 / 76 / 44 | 86 / 75 / 44 |
| 48 | 104 / 84 / 46 | 122 / 76 / 45 | 63 / 74 / 34 | 77 / 65 / 34 |
| 58 | 104 / 68 / 40 | 109 / 63 / 33 | 63 / 56 / 29 | 64 / 51 / 21 |

- **(c)** lands the fade on the **innate**: Moreno's born eyes (IV 60) take the whole hit;
  Okafor's EV-crafted Consistency and Focus hold longest. *"Veteran judgment, tired eyes"*
  — reads like every real 50-something crew chief, and retirement (~56–58, when σ widens
  past the border calls) **emerges from the read** rather than being scheduled. Long
  umpire careers need no special case: per-attribute primes (Consistency 45) do it.
- **(b)** taxes Okafor's **earned** craft as hard as Moreno's innate eyes — at 58 his
  Consistency reads 51 under (b) vs 56 under (c), Focus 21 vs 29. The umpire case **votes
  (c) again** (same direction as #186's vet slugger) but the margin is thinner here
  (career EV dominates reads at these scales) — **a vote, not a verdict**. (b)-vs-(c)
  stays the author feel-call.

---

## Findings

1. ✅ **The generalization survives end-to-end for a non-Player — and the axiom holds for
   a single-person formula.** The umpire duels the rulebook (a constant), the pitch margin
   is a flat world input, and `f(umpire IV, EV)` is the whole read side. No amendment to
   #179; no parallel machinery anywhere.
2. ✅ **Earning for a Referee = replay-graded surprise vs the league line.** Reputation is
   the EV aggregate; development is the same compounding loop (the grinder's Focus-EV
   accelerating his own gain rate is the Work-Ethic story wearing blue); the below-line
   spiral is selection, not a bug. **The port dies hardest on the write side** —
   activity-based accrual is structurally quality-blind.
3. ⚠ **The δ-zero spectrum is a real write-side convention the spec must name** (raw-sign
   / vs-own-expectation / vs-line). It was invisible in #180/#186 because 50/50 duels make
   all three coincide; every truth-graded entity class must pick, and the pick changes
   what EV *means*. Grader-side (#185-consistent out-of-scope), not a storage/axiom change.
4. ✅ **Focus slots in *twice* with zero new machinery.** One `(IV, EV, Nature, form)`
   tuple serves a read-side meta role (fatigue amplifier) and the write-side meta role
   #179 named for hidden attrs (EV-gain rate — Work Ethic's exact slot). Hidden means
   *invisible*, not *structurally different*. As clean as #180, arguably cleaner.
5. ✅ **Two-timescale partition holds at the high-frequency extreme** (#181's other end
   from the Scout): a blown-calls month flips the window negative while the career
   aggregate and capacity barely move — "shaky month" and "elite reputation" coexist on
   one storage.
6. ✅ **Storage contract untouched by every stress** — per-entity pristine throughout;
   umpire longevity falls out of per-attribute primes; (c)-vs-(b) gets a second vote for
   (c), still the author's call.

## Outcome of this artifact

The cleanest non-Player earning case confirms the pattern's universality where it is
weakest-on-paper (no game outcome, no adversary, hidden meta-attrs). Two things feed
forward: the **δ-zero convention** (write-side, for the eventual spec's grader section,
fogged on the map) and a **second vote for (c)** on #184's open feel-call. Feeds go/no-go
(pending [#188](https://github.com/wulke/premier-league-baseball/issues/188), the
scouting report — the sparse/delayed end of the grading spectrum).
