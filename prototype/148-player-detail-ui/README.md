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

It is a single self-contained HTML file rendering the player-detail view against
three hand-authored **fixtures** that match the `#146` `PlayerDetail` response
shape exactly:

```
{ id, givenName, familyName, countryCode, bats, throws, birthDate, age,
  primaryPosition,                                    // derived argmax
  contact, power, armStrength, accuracy, reaction, vision, discipline,   // flat-7
  positions: { Pitcher, Catcher, FirstBase, SecondBase, ThirdBase, Shortstop,
               LeftField, CenterField, RightField },   // 9-key affinity map
  pitches: [ { type, velocity, control, spin } × 4 ],  // repertoire
  contract: { team:{id,name}, startDate, endDate } | null }
```

## Three fixtures, three shapes

| Player | Why they're here |
|---|---|
| **Marcus Velandez — P (DO)** | A starting pitcher. The **pitch repertoire** panel is the point: four pitches × three attributes, presented as cards. |
| **Kenji Tanaka — SS (JP)** | A genuine **multi-positional fielder** (SS / 3B / 2B / CF / LF). The **position affinity** viz is the point. |
| **Eduardo Salas — 1B (VE)** | **Free agent** (`contract:null`). Exercises the #146 edge: identity + ratings + positions only, no team/term. |

## What it decides (the recommended layout)

- **Route — top-level `/:gwId/player/:playerId`** (already locked by [#149](https://github.com/wulke/premier-league-baseball/issues/149); forward-proofs nullable `teamId` / free agents). The roster row is the single link origin.
- **Identity header** — name + primary-position badge (group hue from #147) + country (flag + ISO-2) + bats/throws + age (with `birthDate`) + team link *or* a **Free Agent** chip. Mirrors the `team-calendar.tsx` identity block.
- **Ratings — flat-7 tinted stat cells, no stored OVR.** Same percentile tint and additive constraint as #145/#147. A **Display OVR** toggle computes a display-only mean so you can feel the alternative; the API never carries one.
- **Position affinity — a baseball-field diagram (the headline idea).** The 9 positions are laid out where they actually sit on a baseball field; each node is tinted by its affinity score (same low→red/high→green scale), and the **primary** (argmax) is ringed. Spatial and baseball-native, so a wall of 9 numbers reads at a glance — this is the direct answer to #148's "visualize the positions affinity map without overwhelming the page."
  - Alternatives to flip between: an **FM-style bar grid** (precise ranking, uniform) and **coverage pills** (only positions ≥ 70, mirroring the roster's `positionCoverage` field from #147 so the two views speak the same language).
- **Pitch repertoire — per-pitch cards (VEL/CTL/SPN), gated to pitchers by default.** The model generates pitches for *every* player (incl. fielders); they're meaningless for non-pitchers, so v1 hides them with a clear explanation. An **Always show** toggle reveals the generated-but-meaningless fielder pitches so you can react to the gating decision.
- **Contract — team (linked) + term (start–end).** Free agents get a clear `Free Agent` block. No salary: the `Contract` model has no amount field today — called out rather than invented.

## Live toggles (compare the open decisions)

The toolbar lets you flip each decision in place, and switch the player:

| Control | Options |
|---|---|
| Player | Velandez (P) · Tanaka (SS) · Salas (1B, FA) |
| Positions | Field diagram (default) · Bar grid · Coverage pills |
| Pitches | Pitcher-only (default) · Always show |
| Ratings | 7 tinted (default) · + Display OVR |

## Open sub-questions this surfaces (for the grilling)

1. **Position affinity: field diagram vs bar grid vs coverage pills.** The field diagram is the eye-candy, baseball-native choice; the bar grid is the most precise; the pills match the roster's `positionCoverage` language. Can ship more than one (diagram as the hero, pills as the at-a-glance gist), but a default has to be picked. **This is the headline decision.**
2. **Pitch panel gating.** Generated-for-everyone-but-meaningless-for-fielders is a real quirk of today's `PlayerFactory`. v1 recommends hiding for non-pitchers; "always show" is the honest alternative. (Cleaner long-term: don't generate pitches for fielders — but that's a generation/engine concern → #136 territory, out of scope here.)
3. **Display OVR on detail?** #145/#147 held the line at additive-no-OVR for the roster. Detail is a single player, so a display-only mean is lower-stakes — but consistency argues for keeping it off by default. React to the toggle.
4. **Salary absent.** The contract block can't show money because the schema has none. Is a salary/amount field something this view should *provoke* into the schema, or firmly deferred to the transfers/contract-lifecycle map ([#140](https://github.com/wulke/premier-league-baseball/issues/140))? Default here: deferred — detail shows team + term.
5. **Coverage threshold (≥70) is a placeholder**, inherited from #147's `positionCoverage` rule. Analytical calibration of where "covers a position" sits over the 9-key map is generation/engine work → [#136](https://github.com/wulke/premier-league-baseball/issues/136), out of scope here.

## Aesthetic

The shipping app's inline-style, light, dense data-table look (`team-calendar.tsx` /
`league.tsx`) — **not** the throwaway MLB-dark Tailwind references on
`prototype/ui-styling` (#2/#9), which are a separate, not-yet-adopted visual-direction
effort (see #147's decision). The rating tint, position-badge hues, fonts and density
are lifted verbatim from the [#147 roster-view prototype](../147-roster-view-ui) so the
two views are visually continuous. Layout ideas (percentile tint, field diagram,
pitch cards) borrowed from Baseball Savant / MLB; rendered in the live app style.
