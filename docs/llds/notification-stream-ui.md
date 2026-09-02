# LLD: Notification Stream UI

> Upstream: [HLD: Client Notification & Alert Stream](../high-level-design.md#hld-client-notification--alert-stream) ·
> Backend sibling LLD: [`notification-stream.md`](./notification-stream.md) ·
> EARS: `docs/specs/notification-stream-ui-specs.md` (`NOTIFUI-001`..) ·
> Decision record: [#261](https://github.com/wulke/premier-league-baseball/issues/261)

## Scope

Adds the **minimal validation UI** the HLD calls for: a bare list of notifications for the
current `GameWorld`, backfilled via REST on mount and appended live via SSE, filtered
client-side to the managed team where a notification's `teamId` is set. Proves the
integration end-to-end (backfill path + live path + per-team filtering); does **not**
cover a real inbox page, toast styling, badge counts, or read/unread state — all pushed to
a future mailbox system (HLD Out of scope). Depends on
[`notification-stream.md`](./notification-stream.md) for both endpoints and the
`NotificationRow` shape.

## Interface / Data Model

```tsx
// src/ui/pages/notification-stream.tsx — new component, mounted inside the existing
// GameWorld page shell (src/ui/pages/game-world.tsx) — not a new route (this is a
// validation strip, not a page of its own; a real inbox page is future/downstream).

interface NotificationStreamProps {
  gwId: number;
  managedTeamId: number | null;   // from the existing GameWorld route-loader data
}

// Local component state — no global store; this component owns its own list.
type NotificationStreamState = {
  notifications: NotificationRow[];   // from src/api/models.ts (backend sibling LLD)
};
```

## Logic Flow

```
GameWorld page mounts (existing `/:gwId` route already renders here)
  → NotificationStream mounts with gwId, managedTeamId (from route-loader data)
  → on mount:
      fetch(Endpoints.GetGameWorldNotifications.replace(':gwId', gwId))    # NOTIFUI-001
        .then(r => r.ok ? r.json() : [])                                   // non-ok → [] (degrade, mirrors ROSTUI-002)
        .then(rows => setNotifications(rows))
      const es = new EventSource(
        Endpoints.StreamGameWorldNotifications.replace(':gwId', gwId))     # NOTIFUI-002
      es.onmessage = (e) => {
        const row = JSON.parse(e.data)
        setNotifications(prev => [...prev, row])                          # NOTIFUI-003
      }
      return () => es.close()                                             # NOTIFUI-004 — cleanup on unmount
  → render:
      visible = notifications.filter(n => n.teamId == null || n.teamId === managedTeamId)  # NOTIFUI-005
      bare list, newest-last (append order), each row: type + a type-specific
      one-line render (v1: only 'GAME_RESULT' is registered, so only that
      renderer exists — unknown `type` values render a raw fallback line)     # NOTIFUI-006
```

### Key decisions embedded in this flow

- **No global notification store or context** — this component owns its list locally;
  a shared store belongs to the future mailbox system, not this validation strip.
- **Client-side team filtering, not a server-side `?teamId=` param** — the backend LLD
  deliberately returns every row for the `gameWorldId` (world-wide + all teams); the HLD
  chose per-team filtering as a client concern so the REST/SSE contract stays generic
  (a future non-team-scoped consumer, e.g. a commissioner view, needs no new param).
- **Unknown `type` gets a raw fallback render, not a crash or a dropped row** — the
  registry is designed to grow (HLD Not-yet-specified: trade-finalized, injury,
  season-complete); the UI must not assume `GAME_RESULT` is the only type it will ever
  see, even though it's the only one registered today.
- **Mounted inside the existing GameWorld page, not a new route** — matches the HLD's
  "minimal list-based UI component" framing; a dedicated inbox page/route is explicitly
  future work (HLD Out of scope: "Notification UI polish… real inbox page").

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | REST backfill fetch fails (network / 4xx) | Resolves to `[]`; the list starts empty and SSE-appended rows still arrive normally — same degrade-to-empty posture as `team-roster-ui.md` u1. | NOTIFUI-001 |
| u2 | SSE connection fails to open or drops | `EventSource` auto-reconnects per the browser spec; on reconnect the component does **not** re-run the REST backfill (v1 has no gap-detection), so any row missed during the drop is only recovered on a full remount — acceptable per the HLD's "no guaranteed delivery" trade-off. | NOTIFUI-002 |
| u3 | A row arrives via SSE that duplicates one already present from the REST backfill (race between mount-time fetch and stream open) | **Not deduplicated in v1** — `id` is available on every row for a future dedup key, but the validation scope accepts a possible duplicate row rather than adding client-side dedup logic. | NOTIFUI-003 |
| u4 | `managedTeamId` is `null` (no managed team set for this GameWorld) | Filter shows every world-wide notification (`teamId == null`) and hides every team-scoped one (`n.teamId === null` is always false when `managedTeamId` is `null`) — never shows another team's notification. | NOTIFUI-005 |
| u5 | Component unmounts (navigation away from the GameWorld page) | `EventSource.close()` runs in the effect cleanup — no leaked open connection after navigating away. | NOTIFUI-004 |
| u6 | A notification `type` with no registered client-side renderer arrives | Falls back to a raw `type: JSON.stringify(payload)` line rather than throwing or silently dropping the row. | NOTIFUI-006 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-client-notification--alert-stream) |
| Backend sibling LLD | `docs/llds/notification-stream.md` |
| **This LLD** | `docs/llds/notification-stream-ui.md` |
| EARS | `docs/specs/notification-stream-ui-specs.md` — `NOTIFUI-001`.. |
| Gherkin | `test/ui/features/notification-stream-ui.feature` |
| Code | `src/ui/pages/notification-stream.tsx`, `src/ui/pages/game-world.tsx` (mount point) |
| Decision record | [#261](https://github.com/wulke/premier-league-baseball/issues/261) |
