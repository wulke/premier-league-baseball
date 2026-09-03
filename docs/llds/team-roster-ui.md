# LLD: Team Hub & Roster View UI

> Upstream: [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility) ·
> Backend sibling LLD: [`roster-read-api.md`](./roster-read-api.md) ·
> EARS: `docs/specs/manager/team-roster-ui-specs.md` (`ROSTUI-001`..) ·
> Decision record: [#149 Team hub & entry points](https://github.com/wulke/premier-league-baseball/issues/149), [#147 Roster view UI](https://github.com/wulke/premier-league-baseball/issues/147) (prototype: branch `prototype/147-roster-view-ui`)

## Scope

Adds the **team hub page** at `/:gwId/team/:teamId` (nested routing; existing `…/calendar` URL preserved; index redirects to Calendar) with **Calendar + Roster** tabs, and the **roster view** on the Roster tab — a flat table whose positions-coverage cell is the organizer, with 7 tinted rating columns and client-side sort/filter. Roster entry is via a team click from standings (League page); the nav rail is **untouched**. Depends on [`roster-read-api.md`](./roster-read-api.md) and [`player-detail-ui.md`](./player-detail-ui.md) (roster row → player detail link). Does **not** cover player detail itself, or the nav rail's deferred "TEAM" section (#137).

## Interface / Data Model

### Routing (`src/ui/routes.tsx` — nested under `:gwId`, inside `AppShell`)

```tsx
<Route path="team/:teamId">
  <Route index element={<Navigate to="calendar" replace />} />   // #149: index → Calendar
  <Route path="calendar" element={<TeamCalendar />} />            // EXISTING URL preserved
  <Route path="roster" element={<TeamRoster />} />                // NEW Roster tab
</Route>
```

### `TeamHub` (NEW page, `src/ui/pages/team-hub.tsx`)

```ts
// A thin shell mirroring team-calendar.tsx's identity block, plus an internal tab bar.
// The existing TeamCalendar component is reused unchanged under the hub's Calendar tab.
type Tab = 'calendar' | 'roster';
// team identity (name) resolved from the route's teamId (already fetched by TeamCalendar's
// getSchedule; the hub may share/ refetch — implementation detail, not a design question).
```

### `TeamRoster` (NEW component — the roster view, `src/ui/pages/team-roster.tsx`)

```ts
// Consumes GET /api/team/:teamId/roster → RosterPlayer[] (roster-read-api.md)
// Renders a FLAT table; no grouping by default (Flat · FM, per #147):
//   row = { name → link, age, country, bats/throws, primaryPosition badge, positionCoverage cell,
//           7 tinted rating columns (CON/POW/ARM/ACC/REA/VIS/DIS) }
// positionCoverage cell: multi-pos players show all positions (primary bolded, secondaries dimmed).
// Sort + filter: client-side, from the flat-7 + coverage already in the response — no new query params.
// Rating tint: Baseball-Savant-style low→red/high→green hue, same scale the player-detail view uses.
```

## Logic Flow

```
League standings (src/ui/pages/league.tsx) — team row click
  → navigate(`/${gwId}/team/${teamId}`)                         # ROSTUI-001 (entry point)
  → TeamHub renders; index route redirects to `calendar`
  → user clicks the "Roster" tab → navigate(`/${gwId}/team/${teamId}/roster`)
  → TeamRoster mounts:
      fetch(Endpoints.GetTeamRoster.replace(':teamId', teamId))
        .then(r => r.ok ? r.json() : [])                        // non-ok → [] (degrades to empty, #147)
      render flat table:
        each RosterPlayer row:
          name → <Link to={`/${gwId}/player/${player.id}`}>     # ROSTUI-004 → player detail (#149)
          positionCoverage cell (primary bold + secondaries dim)
          7 rating cells, tinted by value
        sort/filter controls act on local state (no refetch)    # ROSTUI-003
```

### Key decisions embedded in this flow

- **Team hub owns an internal tab bar; the rail is untouched** — preserves the symmetric/no-My-Club boundary. The nav rail's deferred "TEAM" section is #137's to own, not this view's.
- **Flat · FM default** — one flat roster where the positions-coverage cell is the organizer (multi-pos players show all positions); by-position grouping is an optional toggle, not the default.
- **No OVR column** — 7 additive rating columns only; a display-only OVR is the player-detail view's toggle, never the roster's (#145/#147).
- **Roster row is the single link origin** for player detail (#149) — no other entry point to `/:gwId/player/:playerId` is introduced here.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | Roster fetch fails (network / 4xx) | Resolves to `[]`; the table renders empty. No error UI in v1 — same degrade-to-empty posture as the GameWorld home "Today" fetch (`league-today-ui.md` u1). | ROSTUI-002 |
| u2 | Empty roster (`[]`) | The table renders with headers but zero rows; no "no players" message in v1 (omit, per #147's omit-empty posture). | ROSTUI-002 |
| u3 | `teamId` not found (404 from API) | Falls through to the empty-table degrade path (u1); a dedicated "team not found" state is not designed in v1. | ROSTUI-002 |
| u4 | Nav rail interaction | The rail is deliberately not modified — no "Roster" item is added to it. Entry is standings-team-click only, per the symmetric/no-My-Club boundary. | ROSTUI-005 |
| u5 | Direct navigation to `/:gwId/team/:teamId` (no tab) | Index route redirects to `calendar` (existing URL preserved) — so the hub never renders without a tab selected. | ROSTUI-006 |
| u6 | `positionCoverage` threshold mismatch with player detail | Both views derive coverage from the same `≥ COVERAGE_THRESHOLD` rule (roster-read-api #147 corrigendum; detail derives client-side from the 9-key map) — same language, no mismatch. Calibration → #136. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-team-roster--player-visibility) |
| Backend sibling LLD | `docs/llds/roster-read-api.md` |
| **This LLD** | `docs/llds/team-roster-ui.md` |
| Sibling UI LLD | `docs/llds/player-detail-ui.md` (roster row links here) |
| EARS | `docs/specs/manager/team-roster-ui-specs.md` — `ROSTUI-001`.. |
| Gherkin | `test/ui/features/team-roster-ui.feature` |
| Code | `src/ui/routes.tsx` (nested team route), `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-roster.tsx` |
| Decision record | [#149](https://github.com/wulke/premier-league-baseball/issues/149), [#147](https://github.com/wulke/premier-league-baseball/issues/147) |
