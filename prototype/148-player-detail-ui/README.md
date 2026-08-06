# Player detail UI — prototype (#148)

**Map:** [#135 — Team Roster & Player Visibility](https://github.com/wulke/premier-league-baseball/issues/135)
**Ticket:** [#148 — Player detail UI](https://github.com/wulke/premier-league-baseball/issues/148) (`wayfinder:prototype`)
**Branch:** `prototype/148-player-detail-ui` (throwaway, off `main`).

> Throwaway prototype to react to. Not wired into the app; not production code.
> The production player-detail view lands later, as normal LID feature work, once
> this map is clear.

## View it

Open the mockup directly in a browser — no build step:

```
open prototype/148-player-detail-ui/player-detail.html
```

A single self-contained HTML file rendering the player-detail view as **FM-style
page-level tabs** against three hand-authored **fixtures** matching the `#146`
`PlayerDetail` response shape:

```
{ id, givenName, familyName, countryCode, bats, throws, birthDate, age,
  primaryPosition,                                    // derived argmax
  contact, power, armStrength, accuracy, reaction, vision, discipline,   // flat-7
  positions: { Pitcher, Catcher, FirstBase, SecondBase, ThirdBase, Shortstop,
               LeftField, CenterField, RightField },   // 9-key affinity map
  pitches: [ { type, velocity, control, spin } × 4 ],  // repertoire
  contract: { team:{id,name}, startDate, endDate } | null }
```

## Resolved structure — FM-style page tabs

The player page owns its own **page-level tab bar** (top-level route
`/:gwId/player/:playerId` per [#149](https://github.com/wulke/premier-league-baseball/issues/149),
so no collision with the team-hub's Calendar/Roster tabs). The identity masthead
is persistent across tabs (FM-style). Tabs:

| Tab | Contents | When |
|---|---|---|
| **Overview** (default) | Field-diagram **hero** (at-a-glance) + flat-7 tinted ratings (+ optional display-only OVR) + compact **contract block** (team + term) | always |
| **Positions** | View-switcher: **field diagram · bar grid · coverage pills** — depth study of the 9-key map | always |
| **Pitch repertoire** | 4-pitch cards (VEL/CTL/SPN) | **pitchers only** — tab hidden for fielders (FM hides inapplicable tabs) |

**How "I like all three position views" got resolved — by placement, not choice.**
The field diagram is the static hero on Overview (one glance: "where can he play?");
all three (field / bars / pills) live on the Positions tab, where the job is
"study how this guy's position profile breaks down" — exactly where a power-user
toggle belongs. No one view had to be picked; the structure tells you when each
is appropriate. (Pills mirror the roster's `positionCoverage` field from #147, so
the two views speak the same language.)

**Contract — block on Overview, no history tab yet.** Team + term only; the
`Contract` model has no salary field and the roster-mutating writes that create
multi-row history are [#140](https://github.com/wulke/premier-league-baseball/issues/140)
(out of scope, unwritten). A dedicated Contract-history tab graduates when #140
lands — the same deferral logic as the stats-UI (#139: detail never renders a
near-empty section). The page is expected to evolve over time.

## Three fixtures, three shapes

| Player | Why they're here |
|---|---|
| **Marcus Velandez — P (DO)** | A starting pitcher. The **Pitch repertoire** tab is present (4-pitch cards). |
| **Kenji Tanaka — SS (JP)** | A genuine **multi-positional fielder** (SS / 3B / 2B / CF / LF). The Positions tab's depth views shine; no Pitch repertoire tab. |
| **Eduardo Salas — 1B (VE)** | **Free agent** (`contract:null`). Exercises the #146 edge: contract block renders a clear Free-Agent state. |

## Decisions baked in (flag if you disagree)

- **Route** — top-level `/:gwId/player/:playerId` (#149, forward-proofs free agents). Roster row is the single link origin.
- **Identity masthead** — persistent: name + primary-position badge (group hue from #147) + country (flag + ISO-2) + bats/throws + age (with `birthDate`) + team link *or* Free-Agent chip.
- **Ratings** — flat-7 tinted stat cells, no stored/computed OVR (#145/#146 additive constraint). A small **+ Display OVR** toggle (Overview) computes a display-only mean so you can feel the alternative.
- **Position affinity** — field diagram (default hero + Positions-tab option), bar grid, coverage pills (≥ 70). Primary (argmax) always marked.
- **Pitch repertoire** — per-pitch cards (VEL/CTL/SPN), tab present for pitchers only. Pitches are generated for every player by `PlayerFactory` but meaningless for fielders; the cleaner long-term fix (don't generate them) is engine/generation work → [#136](https://github.com/wulke/premier-league-baseball/issues/136), out of scope here.
- **Contract** — team + term block on Overview; no salary (no schema field). History deferred to #140.

## Open sub-question this leaves (minor, not blocking)

- **Coverage threshold (≥70)** is a placeholder, inherited from #147's `positionCoverage` rule. Analytical calibration of where "covers a position" sits over the 9-key map is generation/engine work → #136, out of scope here.

## Aesthetic

The shipping app's inline-style, light, dense data-table look (`team-calendar.tsx` /
`league.tsx`) — **not** the throwaway MLB-dark Tailwind references on
`prototype/ui-styling` (#2/#9), a separate, not-yet-adopted visual-direction
effort (see #147's decision). Rating tint, position-badge hues, fonts and density
are lifted verbatim from the [#147 roster-view prototype](../147-roster-view-ui) so
the two views are visually continuous. Layout ideas (percentile tint, field
diagram, pitch cards) borrowed from Baseball Savant / MLB; rendered in the live app style.
