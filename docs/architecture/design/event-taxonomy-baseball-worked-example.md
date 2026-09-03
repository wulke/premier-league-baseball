# Baseball In-Game Event Taxonomy — Worked Example

Resolves [#219](https://github.com/wulke/premier-league-baseball/issues/219), a child ticket of
[Map: Event, Grading & Reward Architecture](https://github.com/wulke/premier-league-baseball/issues/218).

## Purpose

This is a **worked example**, not a spec. It grounds the generic event-registration contract
([#220](https://github.com/wulke/premier-league-baseball/issues/220)) against one real causal
chain — baseball's in-game events for a plate appearance and its consequences — so the contract
is validated against something concrete rather than designed in the abstract. The eventual
Event, Grading & Reward HLD ([#223](https://github.com/wulke/premier-league-baseball/issues/223))
points to this document as its worked example; it does not embed this content.

**This taxonomy is not exhaustive.** It names the minimal ordered chain needed to validate the
pattern, plus one demonstration that the pattern extends cleanly to a sibling event
(`PickoffAttemptEvent`). Baseball has many more event types (balk, wild pitch, passed ball,
catcher's interference, ground-rule double, ...) that will surface naturally as
[#191](https://github.com/wulke/premier-league-baseball/issues/191)'s implementation decomposes
further — they're expected to slot into the same pattern, not to require taxonomy redesign.

Non-Player / non-in-game event types (Scouting, Recruiting, contract negotiation, ...) are
explicitly out of scope here — deferred fog on the map, validated only structurally (not
concretely designed) by [#222](https://github.com/wulke/premier-league-baseball/issues/222).

## Relation to #191's resolution-depth ladder

[#136](https://github.com/wulke/premier-league-baseball/issues/136) decision #2 established a
resolution-depth ladder: Depth 0 = coarse per-PA resolution (real box-score stats, emergent team
score); Depth 1 = decompose into count / swing / contact; Depth 2 = baserunning, steals, full
fielding. This taxonomy's events map onto that ladder directly — only two event types are real
today; the rest are named placeholders for depths not yet built.

| Depth | Meaning here |
|---|---|
| **Depth 0** | Real today. Corresponds to `resolvePA`'s coarse 7-outcome set + baserunner-advancement, per #191. |
| **Depth 1** | Named now; not real until #191 decomposes `resolvePA` into pitch/swing/contact. |
| **Depth 2** | Named now; not real until fielding and baserunning/steals are built (no fielding exists in the sim today — ball-in-play resolves via a default fallback). |

## The event chain

```
                         ┌─── no-contact route ───┐
                         │  (BB / SO / HBP)        │
PitchEvent → SwingDecisionEvent                    ├──→ PlateAppearanceResolutionEvent ──→ BaserunningEvent (×N runners)
                         │                          │
                         └─ContactEvent (fair)──→ TrajectoryEvent → FieldingAttemptEvent ─┘

StealAttemptEvent      — independent root (runner-initiated), not caused by the current PA
PickoffAttemptEvent    — independent root (pitcher-initiated), same shape as StealAttemptEvent
```

`PlateAppearanceResolutionEvent` is a single terminal event type reached via **two** causal
routes: directly from the pitch/swing loop (walk, strikeout, hit-by-pitch — no ball ever put in
play), or via contact → trajectory → fielding (a ball-in-play out or hit). It is not modeled as
three-plus separate terminal event types for BB/SO/HBP — they're outcome values of the same
resolution, matching `resolvePA`'s existing 7-outcome set.

## Event types

### 1. `PitchEvent` — Depth 1

One pitch thrown. Not real until #191 decomposes `resolvePA`'s count progression.

### 2. `SwingDecisionEvent` — Depth 1

Batter's swing/take decision on a given pitch. Not real until Depth 1.

### 3. `ContactEvent` — Depth 1

Whether a swing produced contact (whiff / foul / fair), and contact quality. Not real until
Depth 1.

### 4. `TrajectoryEvent` — Depth 2

Fair contact resolves to a batted-ball trajectory (exit velocity, launch angle, direction). Not
real until Depth 2 — today, ball-in-play resolves via `resolvePA`'s default fallback with no
fielding at all.

### 5. `FieldingAttemptEvent` — Depth 2

A fielder (or fielders) attempt to convert the trajectory into an out, hit, or error. Not real
until Depth 2 (#136: "no fielding" is a Depth-0 slot left empty).

### 6. `PlateAppearanceResolutionEvent` — **Depth 0 (real today)**

The terminal aggregate of the batting chain, reached via either route above.

- **Input context**: batter attributes, pitcher attributes (today: flat-7 placeholder IV,
  `EV = 0`, per #191's attribute-read seam); count/situation state.
- **Actual result**: one of `{out, 1B, 2B, 3B, HR, BB, SO}` — `resolvePA`'s existing 7-outcome
  set. Pure mechanical sim output; no expected-vs-actual judgment is computed here (see
  [Actual result vs. grading](#actual-result-vs-grading) below).

### 7. `BaserunningEvent` — **Depth 0 (real today), one per runner**

Triggered by `PlateAppearanceResolutionEvent`'s outcome (hit type, or a walk's force advance).
One event per existing runner — not one event for the whole play — because each runner's
advancement is its own independent grade (a runner's own speed/instincts attribute earns its own
reward), matching the uniform per-event reward-payload shape #220's contract expects.

- **Input context**: the triggering `PlateAppearanceResolutionEvent`'s outcome, runner's
  attributes, runner's starting base.
- **Actual result**: the runner's resulting base (including scoring), pure mechanical output.

### 8. `StealAttemptEvent` — Depth 2

Runner-initiated, **independent root** — not caused by the current plate appearance's outcome
(a runner can attempt a steal on any pitch, regardless of what that PA eventually resolves to).
Not real until Depth 2 (#136 names steals as an empty Depth-0 slot; #180 prototyped its IV/EV
worked example separately).

Known gap, explicitly deferred: a steal attempt can in reality be affected by the concurrent
pitch/contact outcome (e.g. a strikeout-throw-out double play, contact fouling off an attempt).
That cross-chain dependency is **not designed here** — it's deferred to whichever future ticket
actually builds Depth-2 steals.

### 9. `PickoffAttemptEvent` — Depth 2

Pitcher-initiated, same shape as `StealAttemptEvent` (independent root, Depth 2, input context
deferred). Named here specifically to demonstrate the pattern extends cleanly to a second
sibling event without needing taxonomy redesign — the acceptance bar the parent map sets for
"generic but concretely grounded."

## Actual result vs. grading

**Actual result = pure mechanical sim output only.** None of the event types above compute or
carry an expected-vs-actual comparison — that's #220's contract (comparison-mode slot) applied
afterward. Grading is computed **post-game**, not in-sim, to keep simulation latency and
complexity down. This is a settled framing for #220 to build against, not a re-litigation of
#178's still-open "when do EVs settle" cadence question — #220's contract makes cadence a
per-event-type declaration, not a single global answer.

## What this does not decide

- The concrete field-level schema of #220's registration contract (input-context shape,
  comparison-mode enum, reward-payload type) — that's #220's job, validated against this chain.
- Where this module lives relative to `src/db/domain/simulation/` — that's #221's job.
- Whether the contract generalizes to non-Player entities — that's #222's job.
- Full input-context/actual-result schemas for the Depth-1/Depth-2-only event types — deferred
  until their owning depth is actually built (per #136's "load-bearing principle": build slots
  and contracts, never committed behavior ahead of when it's needed).
