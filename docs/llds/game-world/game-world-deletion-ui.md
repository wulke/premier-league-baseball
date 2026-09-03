# LLD: GameWorld Deletion UI (`Home` page, `ConfirmDeleteModal`)

> Backend LLD (sibling): [`game-world-deletion.md`](./game-world-deletion.md) ·
> EARS: `docs/specs/game-world/game-world-deletion-ui-specs.md` (`GWDUI-001`…`GWDUI-007`) ·
> Gherkin: `test/ui/features/game-world-deletion-ui.feature`

## Scope

Adds a per-card delete affordance to the GameWorld grid on the home page
(`src/ui/pages/home.tsx`) and a small reusable confirmation modal component
(`src/ui/components/confirm-delete-modal.tsx`, **NEW** — the first modal in this codebase). Calls
the `DELETE /api/gameWorld/:gwId` endpoint defined in the backend LLD. Desktop-mouse-hover only;
no keyboard/touch affordance is added in this pass (existing home page has no hover states or
focus-visible patterns to extend, and none are introduced here).

## Interface / Data Model

### `ConfirmDeleteModal` (`src/ui/components/confirm-delete-modal.tsx`, NEW)

```ts
type ConfirmDeleteModalProps = {
  title: string;                    // e.g. "Delete 'National League 2024'?"
  message: string;                  // e.g. "This will permanently delete this game world and all of its data. This cannot be undone."
  status: 'confirming' | 'submitting' | 'error';
  errorMessage?: string;            // shown when status === 'error'
  onConfirm: () => void;            // Delete / Retry button
  onCancel: () => void;             // Cancel button; disabled while status === 'submitting'
};
```

Presentational only — owns no fetch logic or async state itself. The caller (`Home`) owns the
state machine and passes `status` down, matching the `AppHeader` batch-simulate precedent
(`src/ui/pages/game-world.tsx`) of caller-owned status machines rather than self-fetching
components.

### `Home` (`src/ui/pages/home.tsx`, MODIFIED)

```ts
type DeleteStatus = 'confirming' | 'submitting' | 'error';

// NEW state:
//   hoveredGwId: number | null                         — which card is hovered (drives icon visibility)
//   deleteTarget: { id: number; name: string } | null   — non-null opens the modal
//   deleteStatus: DeleteStatus                          — only meaningful while deleteTarget is set
//   deleteError: string | undefined
```

## Logic Flow

```
1. Card hover (desktop only):
   onMouseEnter → setHoveredGwId(gw.id)
   onMouseLeave → setHoveredGwId(null)
   The "[x]" icon renders only when hoveredGwId === gw.id.                          # GWDUI-001

2. Click "[x]":
   a. event.stopPropagation()   — the card's own onClick navigates to `/${gw.id}`;
      without this, clicking delete would also navigate.                            # GWDUI-002
   b. setDeleteTarget({ id: gw.id, name: gw.config?.name ?? `Game World ${gw.id}` })
   c. setDeleteStatus('confirming')
   → ConfirmDeleteModal renders with title built from deleteTarget.name.            # GWDUI-003

3. Modal "Cancel" (status confirming or error):
   setDeleteTarget(null)  — modal unmounts, no request was ever sent.               # GWDUI-004

4. Modal "Delete" (status confirming) / "Retry" (status error):
   a. setDeleteStatus('submitting')
   b. DELETE Endpoints.GetGameWorld.replace(':gwId', String(deleteTarget.id))
   c. on 200:
        setGameWorlds((prev) => prev.filter((gw) => gw.id !== deleteTarget.id))     # GWDUI-005
        setDeleteTarget(null)                                                       # modal closes
   d. on non-200 / network error:
        setDeleteStatus('error')
        setDeleteError(<message from response body, fallback "Failed to delete game world">)
        # modal stays open, card is NOT removed from the list                       # GWDUI-006/007

5. gameWorlds list is otherwise unchanged — no refetch on success (optimistic-on-success
   removal, not a full reload).                                                     # GWDUI-005
```

Fetch uses the existing `Endpoints.GetGameWorld` constant (`/api/gameWorld/:gwId`) with
`method: 'DELETE'` — no new endpoint constant is needed on the frontend since the backend LLD's
`DeleteGameWorld` enum value is string-identical to `GetGameWorld`; only the HTTP verb differs.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | Card hover reveals `[x]`, but the whole card is also clickable | `stopPropagation()` on the icon's `onClick` prevents the card's navigate handler from firing. Verified as the only guard needed since there's no drag/long-press affordance on the card today. | GWDUI-002 |
| u2 | User clicks "[x]" on card A, then (without cancelling) clicks "[x]" on card B | Not reachable in practice: once `deleteTarget` is set the modal renders and is expected to cover/block the grid (see u5); if it doesn't fully block clicks, the second click's `setDeleteTarget` simply replaces the first — no stacked modals, single `deleteTarget` value by construction. | GWDUI-003 |
| u3 | Delete succeeds while `deleteStatus` transitions were mid-flight from a previous failed attempt (Retry loop) | State is fully reset (`deleteTarget = null`) only on success; each Retry re-enters `submitting` from `error`, so there is exactly one in-flight request at a time — the modal's Delete/Retry button should be disabled while `status === 'submitting'` to prevent double-submit. | GWDUI-006 |
| u4 | Network/server error message shape | Backend `sendError` sends `{ error: string }`; the modal shows `response.error` if present, else a generic fallback string — never a raw stack trace or unparsed body. | GWDUI-007 |
| u5 | No modal component/overlay convention exists yet in this codebase | `ConfirmDeleteModal` is new; it must render as a full-viewport overlay (fixed position, dimmed backdrop) so it visually blocks the grid underneath — otherwise stray clicks on other cards' `[x]` or card-navigate remain reachable while a delete is in flight. This is a new pattern, not an extension of an existing one. | GWDUI-003 |
| u6 | GameWorld list is empty after deleting the last card | Falls through to the existing "No game worlds yet." empty state (`home.tsx`, already handles `gameWorlds.length === 0`) — no new empty-state handling needed. | GWDUI-005 |
| u7 | `gw.config?.name` is undefined (untitled game world) | Modal title falls back to `Game World ${gw.id}`, matching the card's own existing fallback label. | GWDUI-003 |

## Traceability

| Layer | Artifact |
|---|---|
| Backend LLD (sibling) | `docs/llds/game-world/game-world-deletion.md` |
| **This LLD** | `docs/llds/game-world/game-world-deletion-ui.md` |
| EARS | `docs/specs/game-world/game-world-deletion-ui-specs.md` — `GWDUI-001`…`GWDUI-007` |
| Gherkin | `test/ui/features/game-world-deletion-ui.feature` |
| Code entry points | `src/ui/pages/home.tsx` (MODIFIED), `src/ui/components/confirm-delete-modal.tsx` (NEW) |
