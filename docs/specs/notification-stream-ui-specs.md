# Specs: Notification Stream UI

Frontend requirements for the minimal notification list component
(`src/ui/pages/notification-stream.tsx`, mounted from `src/ui/pages/game-world.tsx`),
consuming `GET /api/gameWorld/:gwId/notifications` and
`GET /api/gameWorld/:gwId/notifications/stream`.

| ID | Requirement | Status |
|---|---|---|
| NOTIFUI-001 | WHEN the `NotificationStream` component mounts THE system SHALL fetch `GET /api/gameWorld/:gwId/notifications` and populate the list from the response, defaulting to an empty list on a non-`ok` response or network failure | [ ] |
| NOTIFUI-002 | WHEN the `NotificationStream` component mounts THE system SHALL open an `EventSource` to `GET /api/gameWorld/:gwId/notifications/stream` for the live tail | [ ] |
| NOTIFUI-003 | WHEN an SSE message arrives on the open `EventSource` THE system SHALL parse it as a `NotificationRow` and append it to the displayed list | [ ] |
| NOTIFUI-004 | WHEN the `NotificationStream` component unmounts THE system SHALL close its `EventSource` connection | [ ] |
| NOTIFUI-005 | WHEN rendering the notification list THE system SHALL show a row IF its `teamId` is `null` (world-wide) OR its `teamId` equals the current `managedTeamId`, and SHALL NOT show a row scoped to any other team | [ ] |
| NOTIFUI-006 | WHEN a displayed notification's `type` has no registered client-side renderer THE system SHALL render a raw fallback line (`type` + `JSON.stringify(payload)`) rather than throwing or dropping the row | [ ] |
| NOTIFUI-007 | WHEN the GameWorld page renders THE system SHALL mount `NotificationStream` using the current route's `gwId` and `managedTeamId` | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Client Notification & Alert Stream](../high-level-design.md#hld-client-notification--alert-stream)
- LLD: `docs/llds/notification-stream-ui.md`
- Backend sibling specs: `docs/specs/notification-stream-specs.md`
- Decision record: [#261](https://github.com/wulke/premier-league-baseball/issues/261)
- Code: `src/ui/pages/notification-stream.tsx`, `src/ui/pages/game-world.tsx` (mount point)
