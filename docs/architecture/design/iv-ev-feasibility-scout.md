# Worked Example: IV/EV Feasibility — The Scouting Report

> **Purpose.** A pressure-test artifact for the **IV/EV feasibility map**. Runs a
> **scout's read on a player** — projected ceiling vs. current form vs. risk — through
> the two model branches (faithful Pokémon **port** vs **reimagined**). Scouting is
> where the reimagined branch's superpower should shine most: **the same attribute
> combining differently per consumer** — a scout reads *ceiling* (IV-heavy, form-blind,
> projected), a manager reads *current form* (form-window-heavy, the #180/#186 read),
> a salary read takes the *aggregate* (unfaded EV resume) — all from the same
> `(IV, EV, form-window)`. It asks the things the ticket built toward:
>
> 1. **Does the per-consumer split actually work** — one storage tuple, three formulas,
>    three different (and each legitimately correct) answers? *(the ticket's core question)*
> 2. **Does the port branch actually fail to represent scouting**, as the steal example
>    suggested — and *how*, precisely? *(the foil's stress-test)*
> 3. The two **#184-scope extensions**: the **fading-veteran vs prime-age attribution**
>    (does the scout attribute a vet's bad read to age-decline or a cold streak?), and
>    the **elite-compression** flag from the *scout's* angle (does the scout distinguish
>    two similarly-rated players past their prime?) — the latter doubling as the **third
>    angle on the (b)-vs-(c) age-mechanic feel-call** shared with #186/#187.
>
> Not a spec; not a migration plan. Implementation-agnostic. **All constants (`C`,
> weights, primes, accel rates, the EV@prime headroom) are illustrative** — this map
> fixes *mechanics*, not tuning. Every number below is a reproducible artifact of
> [`iv-ev-feasibility-scout.ts`](./iv-ev-feasibility-scout.ts) — run with
> `TS_NODE_PROJECT=docs/architecture/design/tsconfig.scout.json npx ts-node docs/architecture/design/iv-ev-feasibility-scout.ts`
> (the sibling [`tsconfig.scout.json`](./tsconfig.scout.json) isolates the standalone script from the app tsconfig),
> not a proposed balance.
>
> **Parent map:** _IV/EV Feasibility & Feel Report_ ([#178](https://github.com/wulke/premier-league-baseball/issues/178)).

## The model under test (locked by the map so far)

The **effective-read pipeline** settled across [#179](https://github.com/wulke/premier-league-baseball/issues/179) → [#181](https://github.com/wulke/premier-league-baseball/issues/181) → [#183](https://github.com/wulke/premier-league-baseball/issues/183) → [#184](https://github.com/wulke/premier-league-baseball/issues/184), with the age mechanic run under **(c) discount-IV-only / EV-resists** — #186 overturned the provisional asymmetric-freeze and recommends (c), #187 cast a second vote; §3 gives the third angle:

```
CAPACITY (per attribute a):
   cap_a   = Nature_a × ( IV_a + EV_a )            # Nature — fixed-at-birth ±% trade (#183)
   faded_a = Nature_a × ( disc_a·IV_a + EV_a )     # (c): ages the INNATE; earned craft resists
FORM (per attribute a):
   form_a  = Σ(recent event-deltas)                # ring window, NOT age-discounted (#181)
PER FORMULA (the consumer OWNS its combination):
   manager: clamp[−C,+C]( Σ w_a·faded_a + 0.5·Σ w_a·form_a )      # today's lineup read (#180/#186)
   scout:   Σ w_a·Nature_a·( IV_a + ½·EV@prime_a )·disc_a(t+2)    # forward ceiling; form-blind
   salary:  Σ w_a·Nature_a·( IV_a + EV_a )          — UNclamped   # the career-resume aggregate (#181)
PORT FOIL (Branch A, #182):
   one flat Nature×(IV+EV) number — same for every consumer, monotonic EV, no form,
   no aging, no clamp. (Structurally identical to the salary read.)
```

The scout's one new piece is the **EV@prime extrapolation** — pre-prime, a player can
still "cash in" up to +1×IV more EV — a **read-side projection from the same tuple**
(illustrative; the findings do not hang on its exact shape). Everything above is
`f(person-attribute inputs' IV, EV)` — **the axiom holds unchanged**: a scout is just
another formula owning its combination. (The *scout's own* fidelity — report accuracy
graded when realized performance arrives — is the #185 earning case, settled there;
not modeled numerically here.)

Per-attribute aging profiles (#184): plate discipline **endures** (Eye: prime +3, fade ×0.6), contact is the baseline (×1.0), bat-speed **Power fades early/fast** (prime −2, ×1.4). `C = 85`, weights `.3/.4/.3` — matching #186/#187 for comparability.

## The cast

| Player | Age | Shape | (IV, EV) Eye / Contact / Power | Nature | recent form |
|---|---|---|---|---|---|
| **Pete** — the Prospect | 21 | elite innate, thin returns | (26, +6) / (29, +8) / (24, +4) | 1.00 / **1.10** / 0.90 | mild, mixed |
| **Víctor** — the Prime | 27 | proven, in form | (19, +44) / (21, +52) / (18, +38) | 1.00 / 1.00 / **1.10** | warm |
| **Thomás** — the Fading Star | 36 | **innate-built** superstar, in a slump | (36, +40) / (32, +44) / (30, +32) | 1.00 / 1.00 / **1.10** | deeply cold |

Thomás is deliberately **IV-heavy**: under (c) an EV-heavy veteran barely fades
(craft resists) — the fading-star archetype must carry his value in the *innate* for
Father Time to have something to bite. (That tension is itself a finding — see §3a.)

---

## §1 — One tuple, three consumers, one flat port number

| player | **Port** (one #) | **Manager** today | **Scout** forward | **Salary** aggregate |
|---|---:|---:|---:|---:|
| Pete (21, prospect) | 33.4 | 34.3 | **42.7** | 33.4 |
| Víctor (27, prime) | 66.6 | **68.0** | 40.9 | 66.6 |
| Thomás (36, fading star) | **73.7** | 56.1 | 32.3 | **73.7** |

**Four columns, three orderings — each consumer crowns a different player:**

- **port:** Thomás ≫ Víctor ≫ Pete — the 36-year-old slump is the "best player in baseball"
- **manager:** Víctor ≫ Thomás ≫ Pete — start the prime vet, not the slumping star
- **scout:** Pete ≳ Víctor ≫ Thomás — the unproven kid ranks *above* the star, going forward
- **salary:** Thomás ≫ Víctor ≫ Pete — …which is the port ordering, *exactly*

**Finding 1 — the per-consumer split works, and the port IS the salary read.** The
same `(IV, EV, form-window)` tuple legitimately orders the same three players three
different ways; each consumer is *right for its purpose*. The port's flat
`Nature×(IV+EV)` over unfaded storage is **structurally identical to the
career-resume aggregate** (#181's pristine EV): the port branch is an *accountant* —
it can price a résumé and nothing else. It cannot slump (#180), cannot age (#186),
cannot project — structurally blind to two of the three consumers. And the shape of
its blindness is specific: **pro-veteran, anti-prospect** — the port says Víctor is
**2.0×** the player Pete is, while the scout has Pete *ahead* going forward. No
single number can hold both truths; only per-consumer combination can.

---

## §2 — Attribution: the fading vet vs the prime vet (#184 scope extension)

Thomás is bad **today** (56.1, down from a 72.7 prime-age read). Why? The two forces
live on **different quantities** (#181) — so the scout doesn't *choose* between
slump and decline; the partition hands him **both, separately sized**:

| read | value | what it is |
|---|---:|---|
| unfaded aggregate (salary) | 73.7 | the career résumé — never fades (#181) |
| capacity at prime (30) | 72.7 | same tools, same banked EV, no slump |
| faded capacity at 36 | 62.9 | **structural**: the age-discount's bite |
| + form drag | −6.9 | **temporary**: the slump window |
| = manager read TODAY | 56.1 | what the lineup sees |

**Of the 16.7 gap vs his prime self: 59% structural (age), 41% form (the window).**
Prognosis: expect reversion toward **62.9** (capacity) — not 72.7 (prime), not 56.1
(today): *"rest him, buy-low if priced off today — but he is not the résumé, either."*
(Víctor's same-sized gap rides on an undented capacity — one 0.924 discount on a
single attr; form-noise dominates at 27.)

**The port sees none of it** — its number for Thomás today is **73.7, an all-time
career high**. The port attributes nothing because the port *noticed* nothing. Made
concrete across his career (illustrative EV accrual; slump stripped — the capacity curve):

| age | port (aggregate) | manager read (true) |
|---:|---:|---:|
| 24 | 50.2 | 50.2 |
| 26 | 55.8 | 55.8 |
| 28 | 61.4 | 61.4 |
| 30 | 67.0 | 66.0 |
| 32 | 69.2 | 65.5 |
| 34 | 71.4 | 63.7 |
| 36 | **73.7** | 62.9 |
| 38 | 73.7 | 60.4 |

**Finding 2 — the branches agree exactly through the 20s and cross at ~30.** The
port's failure is *specifically late-career blindness*: monotonic EV + no aging
means the port scout grades the 36-year-old slump **above** the 27-year-old MVP and
calls him "best ever" at 36. Past the crossover the port is not merely uninformative
— it is **inverted**. This is the concrete answer to the ticket's question: the port
doesn't fail scouting at the margin; it fails it *directionally*.

---

## §3a — The twin veterans: same rating, opposite composition — the (b)-vs-(c) third angle

Two 33-year-olds, same prime (28), same accel (0.018), same Natures — **composition
is the only difference**: Tomás is **innate-built** (tools), Cristóbal is
**earned-built** (craft). Today they read 71.8 vs 74.0 under (c) — similarly rated;
the port says 79.2 vs 78.4, near-identical. The question is the **future** a scout
projects:

| age | (c) IV-only: Tomás / Cristóbal | (b) subtractive: Tomás / Cristóbal |
|---:|---|---|
| 33 | 71.8 / 74.0 | 59.5 / 58.9 |
| 35 | 69.1 / 72.5 — Δ3.3 | 52.4 / 51.7 — Δ−0.6 |
| 37 | 67.1 / 71.3 — Δ4.2 | 47.1 / 46.4 — Δ−0.6 |
| 40 | 65.5 / 70.4 — **Δ4.9** | 42.9 / 42.4 — **Δ−0.5** |

**Finding 3 — only (c) lets the storage's IV/EV composition reach the consumer.**
Under **(c)** the twins' futures **separate** (+4.9 for the craft-built by 40): the
innate-built player's value sits in IV, which fades; the earned-built player's sits
in EV, which resists — the scout reads the composition and grades them
*differently*. Under **(b)** the twins are **interchangeable** (Δ−0.5): the tax hits
the whole raw equally, so same-rated players decline as one, and the scout's report
degenerates to *"he is 33; he declines k%."*

**Third vote for (c), from a new angle** — not which curve is more poetic on the
field (#186), nor which lands kinder on the earned (#187), but **which mechanic
makes aging *legible to the consumer***: under (c), decline has *structure* the
storage already knows (wheels go, craft stays); under (b) it is one flat tax. Still
the **author's feel-call** — evidence only, cross-referenced on [#184](https://github.com/wulke/premier-league-baseball/issues/184).

---

## §3b — Elite compression, the scout's angle (#186's ace pair re-read)

Two aces, same peak profile, different aging meta-modulators (primes 25/28). During
the prime flat-top the **game** read pins both at +C — #186's blur. What does the
**scout** see *during* the blur?

| age 25 (flat-top) | Toolsy Cole | Crafty Marcus |
|---|---:|---:|
| game read (today, clamped) | **85.0** | **85.0** |
| scout's 2-year projection | **47.2** | **59.7** |

**Finding 4 — compression binds the game-read, not the scout.** The blur lives in
one formula's clamp; the talent-read is built from **pre-clamp storage** (IV, EV, the
aging meta-modulator) plus trajectory, so the ceiling never blinded it. #186's
"distinct on the decline" now has its missing half: the scout sees the split
**during** the flat-top (Cole's fast accel bites inside the projection window;
Marcus is still pre-prime), not only after it. The `+C` compression worry is
therefore a *game-read* phenomenon — real, but confined (per #186) and now shown not
to propagate into talent evaluation.

---

## Outcome of this artifact

1. **The three-consumer read works from one tuple** — manager/scout/salary each crown
   a different player, each right for its purpose. The port is *exactly* the salary
   read and nothing else: an accountant. Scouting is where the port fails hardest —
   not at the margin but *directionally* (pro-veteran, anti-prospect, inverted past
   the crossover at ~30). **Reimagined confirmed at its supposed superpower; port
   disqualified for it.**
2. **Attribution is a decomposition, not a judgement call** — the #181 partition hands
   the scout both forces, separately sized (59/41 structural/form in the worked case),
   with a concrete prognosis (revert to capacity, not prime, not today). The port sees
   neither force — its read of the slump is an all-time career high.
3. **Third vote for (c) discount-IV-only**, new angle: consumer-legibility — only (c)
   lets the storage's IV/EV composition reach the scout; (b) makes same-rated veterans
   interchangeable. (b)-vs-(c) remains the author's feel-call, cross-ref on #184.
4. **Compression binds the game-read, not the talent-read** — the scout reads
   pre-clamp storage + trajectory and splits #186's pair *during* the flat-top blur.

**Storage contract untouched by every stress above** — every read (manager, scout,
salary, projection) is a per-formula combination over the same
`(IV, EV, Nature, form-window, age)` tuple; the one new piece (EV@prime headroom) is
a read-side projection, not storage. Consistent with #180/#186/#187: the strongest
recurring feasibility signal. The axiom `f(person IV, EV)` absorbs a *fourth*
consumer without amendment.

Feeds the go/no-go (this was the last worked example on the map's frontier).
