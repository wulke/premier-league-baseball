# LLD: Rapid Simulate Season UI (`AppHeader`)

> Backend LLD (sibling): [`rapid-simulate-season.md`](./rapid-simulate-season.md) ·
> EARS: `docs/specs/game-world/rapid-simulate-season-ui-specs.md` (`RSSUI-001`…`RSSUI-006`) ·
> Gherkin: `test/ui/features/rapid-simulate-season-ui.feature`

## Scope

Adds a second, dev-only control to `AppHeader` (`src/ui/components/app-header.tsx`), alongside the
existing "Simulate Today" batch control (Flow B, `SIMUI-008..018`). Calls the
`POST /api/gameWorld/:gwId/rapid-simulate` endpoint defined in the backend LLD. Visible only when
the shared `GameWorld` context's `gw.devToolsEnabled` is `true` — a field the server now computes
from `ENABLE_DEV_TOOLS` and includes on every `GET /api/gameWorld/:gwId` response (backend LLD,
`getGameWorld`). No new route, page, or component — this extends `AppHeader`'s existing
caller-owned state-machine pattern with a second, independent state machine.

Out of scope: the backend loop itself (see sibling LLD), any Action/interruption UI (no Action
model exists yet — see backend LLD Scope), progress bars/streaming (the request blocks until the
whole season is simulated, per the backend LLD's single-response design).

## Interface / Data Model

```ts
// src/ui/components/app-header.tsx (MODIFIED)
type RapidStatus = 'idle' | 'submitting' | 'success' | 'error';
type RapidResult = { daysAdvanced: number; simulated: unknown[]; skipped: unknown[] };

// NEW state, alongside existing batchStatus/batchResult:
//   rapidStatus: RapidStatus
//   rapidResult: RapidResult | null
//   rapidError: string | undefined
```

No new props on `AppHeader` — `devToolsEnabled` is read off the existing `gw` object from
`useGameWorldContext()`, the same source `canBatch` already reads `config`/`currentDate` from.

## Logic Flow

```
1. Visibility guard, evaluated alongside the existing canBatch guard:
   canRapidSimulate = Boolean(
     gw && gw.devToolsEnabled === true && gw.config?.inProgress && gw.currentDate
   )                                                                              # RSSUI-001/002
   The control renders only when canRapidSimulate (or rapidStatus !== 'idle', so a
   persistent error/success region still shows after state changes — same pattern as
   the existing canBatch / batchStatus relationship).

2. Cross-control locking: while EITHER batchStatus === 'submitting' OR
   rapidStatus === 'submitting', BOTH the "Simulate Today" and "Rapid Simulate Season"
   buttons are disabled — they write to overlapping Game/GameWorld rows, so only one
   in-flight request is allowed at a time from this header.                         # RSSUI-006

3. Click "Rapid Simulate Season" (idle, canRapidSimulate, nothing else in flight):
   a. setRapidStatus('submitting')                                                 # RSSUI-003
   b. POST Endpoints.RapidSimulateSeason.replace(':gwId', String(gw.id))
   c. on 200:
        setRapidResult({ daysAdvanced, simulated, skipped })
        setRapidStatus('success')
        invalidate()                                                              # RSSUI-004
   d. on non-200 / network error:
        setRapidStatus('error')
        setRapidError(<message from response body, fallback "Rapid simulation failed">)
        # no invalidate() — mirrors SIMUI-018 for the existing batch control          # RSSUI-005

4. 'success' state shows a summary line (days advanced · simulated · skipped) with no
   auto-dismiss timer (unlike the existing batch control's 3s auto-dismiss) — a season-
   level result is denser information the operator is more likely to want to read fully
   before it clears; a manual dismiss/re-click resets to idle.
5. 'error' state shows a persistent error region with a "Retry" button (same shape as the
   existing batch control's error state), which re-enters step 3 from 'error'.
```

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | `gw` is `null` (still loading / fetch failed) | `canRapidSimulate` short-circuits on `gw &&` before dereferencing anything else — same defensive ordering as the existing `canBatch` guard (LLD u7 in `simulate-game-ui.md`). No button rendered, no error shown. | RSSUI-002 |
| u2 | `gw.devToolsEnabled` is `false`, `undefined`, or missing entirely (older cached response shape) | Control never renders, regardless of season state — a strict boolean check (`=== true`), not a truthy check, so `undefined` fails closed. | RSSUI-002 |
| u3 | Player clicks "Simulate Today" while a rapid-simulate request is in flight (or vice versa) | Both buttons are disabled while either `batchStatus` or `rapidStatus` is `'submitting'` — the click is unreachable, not merely ignored. | RSSUI-006 |
| u4 | Rapid simulation succeeds with `skipped.length > 0` (e.g. some games were already `COMPLETED` going in) | Still renders as a success summary (not the batch control's "warning" success-skipped variant) — for a season-level operation, some pre-completed games among hundreds is expected/normal, not a warning-worthy anomaly the way a single skipped "Simulate Today" game is. | RSSUI-004 |
| u5 | Rapid simulation aborts with the backend's "stuck game" 422 (LLD `RSS-005`) | Surfaces through the same `error` state/path as any other non-200 response — the response body's `error` message (e.g. naming the blocking date) is shown verbatim, so the operator knows why and that partial progress was made (per backend LLD e5, prior days are already persisted; a `Retry` re-attempts from wherever `currentDate` now sits). | RSSUI-005 |
| u6 | Network/server error message shape | Same convention as the deletion modal (`confirm-delete-modal.tsx` precedent): backend `sendError` sends `{ error: string }`; the error region shows `response.error` if present, else a generic fallback — never a raw stack trace. | RSSUI-005 |
| u7 | Visual confusion with the player-facing "Simulate Today" button | The control is styled distinctly (e.g. a dashed/amber border and a small "DEV" label) so it reads as an operator tool even in an environment where `devToolsEnabled` is mistakenly on — it must never look like a second player-facing action. | RSSUI-001 |

## Traceability

| Layer | Artifact |
|---|---|
| Backend LLD (sibling) | `docs/llds/rapid-simulate-season.md` |
| **This LLD** | `docs/llds/rapid-simulate-season-ui.md` |
| EARS | `docs/specs/game-world/rapid-simulate-season-ui-specs.md` — `RSSUI-001`…`RSSUI-006` |
| Gherkin | `test/ui/features/rapid-simulate-season-ui.feature` |
| Code entry points | `src/ui/components/app-header.tsx` (MODIFIED) |
