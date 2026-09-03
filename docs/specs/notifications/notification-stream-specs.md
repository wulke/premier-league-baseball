# Specs: Notification Stream (Backend)

Backend requirements for the generic notification registry, envelope, and transport, and
the `GameResultNotification` validation trigger (`src/db/model/notification.ts`,
`src/db/model/associations.ts`, `src/db/domain/notifications/*.ts`,
`src/db/domain/game.ts`, `src/api/endpoints.ts`, `src/api/router.ts`,
`src/api/handlers.ts`, `src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| NOTIF-001 | WHEN a game completes via `GameFactory.simulate()` THE system SHALL fire a `GAME_RESULT` notification via `NotificationFactory().notify()` once per relevant team, producing a separate team-scoped `Notification` row per team | [x] → #271 |
| NOTIF-002 | WHEN `notify()` is called with an unregistered notification type THE system SHALL throw a `DomainError` with `statusCode` `400` | [x] → #271 |
| NOTIF-003 | WHEN `GET /api/gameWorld/:gwId/notifications` is called THE system SHALL filter by `id` greater than the numeric `?since=` value — returning all rows for that `gameWorldId` when `since` is absent, and zero rows when `since` is non-numeric (an explicit `Number.isNaN` guard — `Op.gt: NaN` itself raises a SQLite error rather than matching nothing) — ordered ascending by `id` | [x] → #271 |
| NOTIF-004 | WHEN a `Notification` row is persisted THE system SHALL push it to every open SSE connection registered for that `gameWorldId`, and SHALL no-op when none are open | [x] → #271 |
| NOTIF-005 | WHEN `Notification.create` fails during `notify()` THE system SHALL log the error and swallow it, resolving normally without propagating the failure to the trigger site | [x] → #271 |
| NOTIF-006 | WHEN a notifications read (REST list or SSE stream) is scoped to a `gameWorldId` THE system SHALL treat any `gameWorldId`, including one with no matching `GameWorld`, as returning zero rows or an empty stream rather than raising a not-found error | [x] → #271 |
| NOTIF-007 | WHEN `GET /api/gameWorld/:gwId/notifications` succeeds THE system SHALL return a raw, unwrapped array of `NotificationRow` objects, per the API's no-envelope convention (backend-standards §5) | [x] → #271 |
| NOTIF-008 | WHEN `GET /api/gameWorld/:gwId/notifications/stream` is called THE system SHALL open an SSE connection (`Content-Type: text/event-stream`, no caching, headers flushed immediately) and register the response object under that `gameWorldId` in the connection map for future pushes | [x] → #271 |
| NOTIF-009 | WHEN an SSE client disconnects THE system SHALL unsubscribe its response object from the per-`gameWorldId` connection map, so no further push write is attempted against it | [x] → #271 |
| NOTIF-010 | WHEN persisting a `Notification` THE system SHALL store `gameWorldId` (required), `teamId` (nullable), `type`, `payload` (JSON), and `createdAt`, and SHALL NOT include any read-state field (`readAt`/`isRead`) | [x] → #271 |
| NOTIF-011 | WHEN the application starts THE system SHALL register `'GAME_RESULT'` as a valid notification type via `registerNotificationType()`, enabling `GameFactory.simulate()` to fire it | [x] → #271 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Client Notification & Alert Stream](../high-level-design.md#hld-client-notification--alert-stream)
- LLD: `docs/llds/notification-stream.md`
- Sibling specs: `docs/specs/notifications/notification-stream-ui-specs.md`
- Decision record: [#259](https://github.com/wulke/premier-league-baseball/issues/259), [#260](https://github.com/wulke/premier-league-baseball/issues/260), [#261](https://github.com/wulke/premier-league-baseball/issues/261)
- Code: `src/db/model/notification.ts`, `src/db/model/associations.ts`, `src/db/domain/notifications/{registry,notification,game-result-notification}.ts`, `src/db/domain/game.ts` (trigger call), `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`, `src/api/models.ts` (`NotificationRow`)
