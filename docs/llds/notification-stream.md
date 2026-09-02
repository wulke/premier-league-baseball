# LLD: Notification Stream (Backend)

> Upstream: [HLD: Client Notification & Alert Stream](../high-level-design.md#hld-client-notification--alert-stream) ·
> EARS: `docs/specs/notification-stream-specs.md` (`NOTIF-001`..`NOTIF-011`) ·
> Decision record: [#259](https://github.com/wulke/premier-league-baseball/issues/259), [#260](https://github.com/wulke/premier-league-baseball/issues/260), [#261](https://github.com/wulke/premier-league-baseball/issues/261)

## Scope

Adds the generic notification machinery — the `Notification` model, `NotificationFactory`
(registry, `notify()`, SSE connection map, catch-up read), the two REST/SSE endpoints, and
the one concrete type this map validates with, `GameResultNotification`, registered from
`GameFactory.simulate()`'s completion path. Does **not** cover any UI consumer (see
[`notification-stream-ui.md`](./notification-stream-ui.md)), any notification type beyond
`GameResultNotification` (out of scope per the HLD), read/unread state, or multi-instance
delivery.

## Interface / Data Model

```ts
// src/db/model/notification.ts — new model, owned exclusively by NotificationFactory (backend-standards §1)
// NOTIF-010: envelope carries no read-state field (readAt/isRead)
interface INotificationRow {
  id: number;
  gameWorldId: number;               // FK, required — Notification.gameWorldId
  teamId: number | null;             // FK, nullable — null = world-wide notification
  type: string;                      // registered notification-type key, e.g. 'GAME_RESULT'
  payload: Record<string, any>;      // JSON — shape owned by each registered type, not this model
  createdAt: Date;                   // Sequelize-managed; no updatedAt (envelope is append-only)
}

// src/db/domain/notifications/registry.ts — mirrors #218's registerEventType() convention
type NotificationPayload<T = any> = T;
const registerNotificationType = (type: string): void => { /* … */ };
const isRegisteredNotificationType = (type: string): boolean => { /* … */ };
// NOTIF-011: registerNotificationType('GAME_RESULT') runs at module load in
// game-result-notification.ts (imported by game.ts), before any simulate() call can fire it

// src/db/domain/notifications/notification.ts
interface INotification {
  notify: (
    type: string,
    payload: NotificationPayload,
    scope: { gameWorldId: number; teamId?: number | null },
  ) => Promise<void>;                // NOTIF-005: never throws — swallows + logs internally
  listSince: (
    gameWorldId: number,
    sinceId?: number,
  ) => Promise<INotificationRow[]>;   // catch-up read, ordered by id ascending
  subscribe: (gameWorldId: number, res: Response) => void;   // registers an SSE connection
  unsubscribe: (gameWorldId: number, res: Response) => void; // on `req.on('close', …)`
}
const NotificationFactory = (): INotification => { /* … */ };

// src/db/domain/notifications/game-result-notification.ts — concrete type, registered
// from src/db/domain/game.ts, NOT from the notifications module (backend-standards
// module-placement precedent, ratified in #261)
interface GameResultPayload {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamResult: number;
  awayTeamResult: number;
}
registerNotificationType('GAME_RESULT');

// src/api/endpoints.ts — additions
// @spec NOTIF-006,NOTIF-007
GetGameWorldNotifications = '/api/gameWorld/:gwId/notifications';
// @spec NOTIF-008,NOTIF-009
StreamGameWorldNotifications = '/api/gameWorld/:gwId/notifications/stream';

// src/api/models.ts — response row (raw, unwrapped array per backend-standards §5)
interface NotificationRow {
  id: number;
  gameWorldId: number;
  teamId: number | null;
  type: string;
  payload: Record<string, any>;
  createdAt: string;   // ISO string, serialized
}
```

### Field-semantics table

| Field | Owner | Nullability | Notes |
|---|---|---|---|
| `Notification.gameWorldId` | `NotificationFactory` | required | Only per-instance identity concept in this codebase (no user/session model) — HLD Strategy §3. |
| `Notification.teamId` | `NotificationFactory` | nullable | `null` = world-wide (e.g. season complete); set = team-scoped (e.g. a game result). Mirrors `GameWorld.managedTeamId`'s nullable convention, not an FK to a "current user." |
| `Notification.payload` | the registered type | required, opaque JSON | `NotificationFactory` never inspects payload shape — each type owns its own contract, same as #218's event registry. |
| `Notification.createdAt` | Sequelize | required | Sole ordering key; `listSince`/SSE both use it (via `id`, monotonic) — no separate `readAt`/`isRead` (HLD Out of scope). |

## Logic Flow

```
# Trigger path — GameFactory.simulate() (src/db/domain/game.ts), after existing completion hooks
GameFactory(id).simulate(options)
  → [existing] guarded Game.update({ status: 'COMPLETED' }, { where: { id, status: { [Op.ne]: 'COMPLETED' } } })
  → [existing] resolveKnockoutGameCompletion / resolveRoundRobinGameCompletion / resolveCrossStageAdvancement
  → NEW: for each of homeTeamId/awayTeamId's managed-relevant scope:
       await NotificationFactory().notify('GAME_RESULT', payload, { gameWorldId, teamId })  # NOTIF-001
       # NOTIF-005: notify() wraps its own Notification.create in try/catch — a write
       # failure is console.error'd and swallowed, never thrown back into simulate().
       # simulate()'s guarded Game.update has ALREADY committed by this point (no
       # explicit db.transaction() wraps simulate() today — see Key decisions below),
       # so "never roll back the critical action" is satisfied by ordering, not by an
       # actual transaction rollback.
  → return updated game (unchanged existing behavior)

NotificationFactory().notify(type, payload, { gameWorldId, teamId }):
  IF !isRegisteredNotificationType(type): throw DomainError('unknown notification type', 400)  # NOTIF-002
  TRY:
    row = await db.models.Notification.create({ gameWorldId, teamId: teamId ?? null, type, payload })
    pushToOpenConnections(gameWorldId, row)                                    # NOTIF-004
  CATCH (err):
    console.error(err)   # NOTIF-005 — swallowed, caller (GameFactory) never sees this

GET /api/gameWorld/:gwId/notifications?since=<id>
  → router → handlers.getGameWorldNotifications(gwId, since)
  → NotificationFactory().listSince(gwId, since)
      IF since !== undefined AND Number.isNaN(since): return []             # NOTIF-003 (e4)
      Notification.findAll({ where: { gameWorldId, id: { [Op.gt]: since ?? 0 } }, order: [['id', 'ASC']] })  # NOTIF-006
  → raw array response (backend-standards §5)                                  # NOTIF-007

GET /api/gameWorld/:gwId/notifications/stream   (SSE)
  → router: sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, flushes headers  # NOTIF-008
  → handlers.streamGameWorldNotifications(gwId, res)
      NotificationFactory().subscribe(gwId, res)     # adds res to connectionMap.get(gwId) ?? []
      req.on('close', () => NotificationFactory().unsubscribe(gwId, res))       # NOTIF-009
  → on notify(): pushToOpenConnections writes `data: <json row>\n\n` to every
    open `res` in connectionMap.get(gwId)                                       # NOTIF-004
```

### Key decisions embedded in this flow

- **`notify()` never throws** — the HLD's "logged and swallowed, never blocking the
  critical action" is enforced *inside* `NotificationFactory`, not by the caller
  remembering to wrap the call in try/catch at every trigger site (there will be more
  than one eventually — see HLD's Not-yet-specified on trigger-site proliferation).
- **No explicit `db.transaction()` around `simulate()`** — `GameFactory.simulate()`
  today has no wrapping transaction (its atomicity comes from the guarded
  `WHERE status != 'COMPLETED'` update, not a BEGIN/COMMIT). The HLD's "same
  transaction as the triggering action" is realized here as "call `notify()` only
  after the guarded update has already succeeded," which achieves the same guarantee
  (no notification for a game that didn't actually complete) without introducing a
  transaction the existing code doesn't have. If a future map wraps `simulate()` in an
  explicit transaction, `notify()`'s `Notification.create` call should thread it
  through the same optional `transaction` parameter convention (backend-standards §1).
- **In-memory connection map lives inside `NotificationFactory`, not a module-level
  singleton in `router.ts`** — keeps SSE connection state alongside the domain logic
  that owns the `Notification` model, consistent with domain-layer ownership (§1),
  even though Express request/response objects are normally an API-layer concern; this
  is the one deliberate exception, scoped narrowly to connection bookkeeping.
- **`teamId` resolution for `GAME_RESULT` happens at the trigger site (`game.ts`), not
  inside `notify()`** — `NotificationFactory` stays payload-agnostic (mirrors #218);
  `game.ts` already has `homeTeamId`/`awayTeamId` in scope from the existing simulate
  flow, so it decides how many `notify()` calls to make (one per relevant team, or a
  world-wide `teamId: null` call) without `NotificationFactory` needing per-type logic.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `notify()` called with an unregistered `type` | `DomainError('unknown notification type', 400)` — this is a programmer error at a trigger site, not a runtime condition to swallow (distinct from a DB write failure). | NOTIF-002 |
| e2 | `Notification.create` throws (DB error) | Logged via `console.error`, swallowed — `notify()` resolves normally, the triggering action (e.g. `simulate()`) is unaffected. | NOTIF-005 |
| e3 | `GET .../notifications` called with no `?since=` | Returns every `Notification` row for that `gameWorldId`, oldest first — same "empty history" default as `roster-read-api`'s no-filter read. | NOTIF-003 |
| e4 | `GET .../notifications?since=<id>` where `<id>` is not a valid number | `listSince` explicitly returns `[]` before querying — **verified at implementation time that `Op.gt: NaN` does NOT fall through harmlessly** (SQLite raises `no such column: NaN`), so this is an explicit `Number.isNaN` guard, not the implicit-validation pattern backend-standards §3 describes for `findByPk`. Corrects the original LLD assumption. | NOTIF-003 |
| e5 | `gwId` does not correspond to an existing `GameWorld` | Both endpoints return `[]` / an immediately-closed empty SSE stream rather than a 404 — a notification list for a nonexistent world is empty, not an error, consistent with `NOTIF-003`'s "no special-case" read. | NOTIF-006 |
| e6 | SSE client disconnects (network drop, tab close) | `req.on('close', …)` fires `unsubscribe`, removing that `res` from the connection map — a `pushToOpenConnections` write to a stale connection never happens after this. | NOTIF-009 |
| e7 | Two `notify()` calls for the same `GAME_RESULT` (home + away team scope) | Each is a **separate** `Notification` row (separate `teamId`) — not deduplicated. A world-wide viewer (no managed team) would see neither; only the managed team's row is delivered to their client-side filter (UI concern, see sibling LLD). | NOTIF-001 |
| e8 | `notify()` called for a `gameWorldId` with zero open SSE connections | `pushToOpenConnections` is a no-op (empty array from the map) — the row is still persisted via `Notification.create`, so it's available on the next REST catch-up. | NOTIF-004 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-client-notification--alert-stream) |
| **This LLD** | `docs/llds/notification-stream.md` |
| Sibling LLDs | `docs/llds/notification-stream-ui.md` (consumer) |
| EARS | `docs/specs/notification-stream-specs.md` — `NOTIF-001`.. |
| Gherkin | `test/bdd/features/notification-stream.feature` |
| Code | `src/db/model/notification.ts`, `src/db/model/associations.ts`, `src/db/domain/notifications/{registry,notification,game-result-notification}.ts`, `src/db/domain/game.ts` (trigger call), `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`, `src/api/models.ts` (`NotificationRow`) |
| Decision record | [#259](https://github.com/wulke/premier-league-baseball/issues/259), [#260](https://github.com/wulke/premier-league-baseball/issues/260), [#261](https://github.com/wulke/premier-league-baseball/issues/261) |
