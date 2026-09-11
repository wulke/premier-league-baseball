# Specs: Team Hub & Roster View UI

Frontend requirements for the team hub page and its Roster tab
(`src/ui/routes.tsx`, `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-roster.tsx`), consuming
`GET /api/team/:teamId/roster`.

| ID | Requirement | Status |
|---|---|---|
| ROSTUI-001 | WHEN a user clicks a team in the League standings THE system SHALL navigate to `/:gwId/team/:teamId` (the roster entry point) | [x] → #171 |
| ROSTUI-002 | WHEN the roster fetch fails, returns `404`, or yields an empty roster THE system SHALL render an empty table (degrade to empty — no error UI, no "no players" message) | [x] → #171 |
| ROSTUI-003 | WHEN the user sorts or filters the roster THE system SHALL perform it client-side from data already in the response, with no refetch or new query params | [x] → #171 |
| ROSTUI-004 | WHEN a roster row's player name is clicked THE system SHALL navigate to `/:gwId/player/:playerId` (the single player-detail link origin) | [x] → #171 |
| ROSTUI-005 | WHEN the team hub and roster view ship THE system SHALL NOT add any roster or team item to the nav rail — entry is standings-team-click only, preserving the symmetric/no-My-Club boundary | [x] → #171 |
| ROSTUI-006 | WHEN the user navigates to `/:gwId/team/:teamId` with no tab THE system SHALL redirect to the `calendar` tab (the existing calendar URL is preserved) | [x] → #171 |
| ROSTUI-007 | WHEN the team hub renders THE system SHALL provide a Calendar tab and a Roster tab at `/:gwId/team/:teamId` | [x] → #171 |
| ROSTUI-008 | WHEN the Roster tab renders THE system SHALL show a flat roster table with the positions-coverage cell as the organizer — multi-position players show all positions, primary bolded, secondaries dimmed | [x] → #171 |
| ROSTUI-009 | WHEN rating columns render THE system SHALL show seven tinted rating columns and SHALL NOT show a stored or computed OVR | [x] → #171 |
| ROSTUI-010 | WHEN the user navigates among Team Hub Calendar, Roster, and Lineup tabs THE system SHALL retain one shared 960px content maximum for the tab bar and every tab, so the content column does not reflow between routes | [x] → #294 |
| ROSTUI-011 | WHEN a roster Coverage cell renders a `PlayerPosition` THE system SHALL display the shared abbreviated position code in a compact badge, with the primary bolded and secondaries dimmed, and SHALL NOT display the raw enum name | [ ] → #296 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)
- LLD: `docs/llds/manager/team-roster-ui.md`
- Backend sibling specs: `docs/specs/manager/roster-read-api-specs.md`
- Sibling UI specs: `docs/specs/player/player-detail-ui-specs.md`
- Decision record: [#149](https://github.com/wulke/premier-league-baseball/issues/149), [#147](https://github.com/wulke/premier-league-baseball/issues/147)
- Code: `src/ui/routes.tsx` (nested team route), `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-roster.tsx`
