# Specs: Rapid Simulate Season UI

Frontend requirements for the dev-only "Rapid Simulate Season" control in `AppHeader`
(`src/ui/components/app-header.tsx`).

| ID | Requirement | Status |
|---|---|---|
| RSSUI-001 | WHEN `AppHeader` renders IF `gw.devToolsEnabled === true` AND `gw.config.inProgress` AND `gw.currentDate` is set THE system SHALL show a "Rapid Simulate Season" control, visually distinguished from the player-facing "Simulate Today" control | [ ] → #102 |
| RSSUI-002 | WHEN `gw` is `null` OR `gw.devToolsEnabled` is not exactly `true` OR the season is not active THE system SHALL NOT render the "Rapid Simulate Season" control | [ ] → #102 |
| RSSUI-003 | WHEN the player clicks "Rapid Simulate Season" THE system SHALL disable the control and show a submitting state until the request resolves | [ ] → #102 |
| RSSUI-004 | WHEN `POST /api/gameWorld/:gwId/rapid-simulate` returns 200 THE system SHALL show a summary of days advanced, simulated, and skipped games, and SHALL call `invalidate()` to refresh the shared GameWorld context | [ ] → #102 |
| RSSUI-005 | WHEN `POST /api/gameWorld/:gwId/rapid-simulate` returns a non-200 response THE system SHALL show a persistent error region with a "Retry" control and SHALL NOT call `invalidate()` | [ ] → #102 |
| RSSUI-006 | WHEN either the "Simulate Today" batch request or the "Rapid Simulate Season" request is in flight THE system SHALL disable both controls | [ ] → #102 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- Backend LLD (sibling): `docs/llds/rapid-simulate-season.md`
- LLD: `docs/llds/rapid-simulate-season-ui.md`
- Gherkin: `test/ui/features/rapid-simulate-season-ui.feature`
- Code: `src/ui/components/app-header.tsx` (MODIFIED)
