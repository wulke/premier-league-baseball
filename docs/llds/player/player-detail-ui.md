# LLD: Player Detail UI

> Upstream: [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility) ·
> Backend sibling LLD: [`player-detail-read-api.md`](./player-detail-read-api.md) ·
> EARS: `docs/specs/player/player-detail-ui-specs.md` (`PDETUI-001`..) ·
> Gherkin: `test/ui/features/player-detail-ui.feature` ·
> Decision record: [#148 Player detail UI](https://github.com/wulke/premier-league-baseball/issues/148) (prototype: branch `prototype/148-player-detail-ui`)

## Scope

Adds the **player detail page** at top-level `/:gwId/player/:playerId` — an **FM-style page-level tab bar** (Overview / Positions / Pitch repertoire) with a persistent identity masthead. The two viz-worthy cores from #148 — the dense 9-position affinity map and the pitch repertoire — live on dedicated tabs. Depends on [`player-detail-read-api.md`](./player-detail-read-api.md) (full `attributes` verbatim + `contract`). Does **not** cover the roster view ([`team-roster-ui.md`](./team-roster-ui.md)), stats (→ #139), or contract history (→ #140).

## Interface / Data Model

### Routing (`src/ui/routes.tsx` — top-level under `:gwId`, per #149)

```tsx
<Route path="player/:playerId" element={<PlayerDetail />} />   // top-level — forward-proofs free agents
```

### `PlayerDetail` (NEW page, `src/ui/pages/player-detail.tsx`)

```ts
// Consumes GET /api/player/:playerId → PlayerDetail (player-detail-read-api.md)
// Persistent identity masthead + page-level tab bar (state: which tab).
type Tab = 'overview' | 'positions' | 'pitches';
// pitches tab is rendered ONLY when primaryPosition === 'Pitcher' (hidden for fielders).

// Sub-views (all render from the single PlayerDetail response — no extra fetches):
//   Overview : flat-7 tinted ratings + contract block (team+term)
//              + a deferred "Career & accomplishments" hook (graduates with #139/#140/awards)
//   Positions: view-switcher — field diagram (default) · bar grid · coverage pills
//   Pitches   : 4-pitch cards (VEL/CTL/SPN) — pitchers only
```

## Logic Flow

```
Roster row click (team-roster-ui.md) → navigate(`/${gwId}/player/${playerId}`)
  → PlayerDetail mounts:
      fetch(Endpoints.GetPlayerDetail.replace(':playerId', playerId))
        .then(r => r.ok ? r.json() : null)                      // non-ok → null → not-found state (PDETUI-001)
      render:
        masthead (persistent across tabs):
          name, primaryPosition badge (group hue), always-visible display-only OVR badge, team link OR "Free Agent" chip (#146 edge),
          country (flag + ISO-2), bats/throws, age (+ birthDate), primary position
        tab bar: [Overview] [Positions] [Pitch repertoire (if pitcher)]
        active tab's content, all from the one response
      Overview tab:
        flat-7 tinted ratings; OVR is computed client-side as the rounded mean of those seven ratings and is displayed unconditionally in the masthead beside the primary-position badge (never API-carried)
        contract block: team (linked) + term (start–end); Free Agent chip if contract === null
        "Career & accomplishments" deferred block (stats #139 / contract-history #140 / awards)
      Positions tab:
        segmented view-switcher (field diagram | bar grid | coverage pills), all over the 9-key `positions` map
        field diagram = stylized baseball field (striped grass, dirt infield, mound, plate, bases, foul lines)
                        with realistic defensive-depth markers; every marker exposes label + affinity
        affinity tint = shared, high-contrast scale used by field markers, bars/pills, and masthead badge
        primary (argmax) = explicit text label in every view; field includes an explanatory tint legend
      Pitches tab (pitchers only):
        4 pitch cards, each VEL/CTL/SPN tinted
```

### Key decisions embedded in this flow

- **Top-level route** (`/:gwId/player/:playerId`) — forward-proofs nullable `teamId` / free agents; a nested-under-team URL would break on a free agent. The roster row is the single link origin (#149).
- **Page owns its own tab bar** — distinct from the team hub's tabs; no collision because the routes don't nest.
- **Overview de-duplicated** — Overview carries *no* position-affinity content (an earlier draft had a field-diagram hero that duplicated the Positions tab; removed). Each tab has genuinely distinct content.
- **Pitch tab = pitchers only** — `PlayerFactory` generates pitches for every player but they're meaningless for fielders; the tab is hidden for non-pitchers (FM hides inapplicable tabs). The cleaner fix (don't generate them for fielders) → #136.
- **No stored OVR** — ratings are shown verbatim; a *display-only* OVR is computed client-side as the rounded flat-7 mean, rendered unconditionally as a masthead badge beside the primary-position badge, and never carried by the API (#145/#146 additive constraint). Full visibility is for the owned-team context; future scouting/fog-of-war rules for other teams must introduce their own conditional visibility policy rather than a manual toggle.
- **Contract block, not a tab** — team + term only; no salary (no schema field), no history (no writer → #140). A contract-history view graduates when #140 lands — same deferral as stats (#139: detail never renders an always-empty section).
- **Affinity presentation remains one data source** — all three Positions views render the keys actually present in `positions`, including LF and RF. The primary is the existing argmax, but is named in text rather than conveyed by a border alone. The masthead badge uses the same affinity tint so it agrees with the field rendering.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | Player fetch fails / `playerId` not found | Degrades to a not-found state (the masthead cannot render without identity); no partial render. | PDETUI-001 |
| u2 | Free agent (`contract: null`) | Masthead shows a "Free Agent" chip instead of a team link; the Overview contract block renders the same Free-Agent state; Positions/Pitches tabs render normally (they don't depend on team). | PDETUI-002 |
| u3 | Non-pitcher primary position | The "Pitch repertoire" tab is **omitted** from the tab bar entirely (not disabled) — FM hides inapplicable tabs. A fielder's `pitches` array still arrives in the response but is not surfaced. | PDETUI-003 |
| u4 | User on the Pitches tab, then switches to a fielder player | Cannot occur via in-app navigation — switching player re-mounts with the new player's tab set; default tab is Overview. (A direct URL has no tab in the path, so no stale-tab hazard.) | — |
| u5 | Positions view-switcher persistence | Client-side state; default is the field diagram on every mount. No URL encoding of the sub-view in v1. | PDETUI-004 |
| u6 | "Career & accomplishments" block is empty | Renders as a deferred-state hook (text explaining what graduates in and from which map), NOT as an empty data section — consistent with the #139 deferral logic. | PDETUI-005 |
| u7 | A low-affinity or colorblind user cannot infer the primary marker from hue/border alone | Every view renders the affinity number and an explicit “Primary” label; the field also includes a non-hover legend. | PDETUI-007 |
| u8 | `positions` includes LeftField or RightField | The same map iteration renders LF/RF in the field, bar, and pill views at their dedicated defensive locations. | PDETUI-007 |
| u9 | Future scouting/fog-of-war limits an opposing player's visibility | This owned-team masthead remains always visible; the future scouting design owns any conditional visibility for other teams. No manual OVR toggle returns. | PDETUI-008 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-team-roster--player-visibility) |
| Backend sibling LLD | `docs/llds/player/player-detail-read-api.md` |
| **This LLD** | `docs/llds/player/player-detail-ui.md` |
| Sibling UI LLD | `docs/llds/manager/team-roster-ui.md` (links here) |
| EARS | `docs/specs/player/player-detail-ui-specs.md` — `PDETUI-001`.. |
| Gherkin | `test/ui/features/player-detail-ui.feature` |
| Code | `src/ui/routes.tsx` (`player/:playerId`), `src/ui/pages/player-detail.tsx` |
| Decision record | [#148](https://github.com/wulke/premier-league-baseball/issues/148) |
