# Specs: Player Detail UI

Frontend requirements for the player detail page and its FM-style page tabs
(`src/ui/routes.tsx`, `src/ui/pages/player-detail.tsx`), consuming `GET /api/player/:playerId`.

| ID | Requirement | Status |
|---|---|---|
| PDETUI-001 | WHEN the player fetch fails or `:playerId` is not found THE system SHALL render a not-found state rather than a partial render | [ ] |
| PDETUI-002 | WHEN the player is a free agent (`contract: null`) THE system SHALL show a "Free Agent" chip in place of a team link, and SHALL render the Positions and Pitch tabs normally | [ ] |
| PDETUI-003 | WHEN the player's primary position is not Pitcher THE system SHALL omit the Pitch repertoire tab entirely (not disable it) | [ ] |
| PDETUI-004 | WHEN the Positions view-switcher state persists THE system SHALL default to the field diagram on each mount and SHALL NOT encode the sub-view in the URL in v1 | [ ] |
| PDETUI-005 | WHEN the Career & accomplishments block has no data THE system SHALL render a deferred-state hook explaining what graduates in, not an empty data section | [ ] |
| PDETUI-006 | WHEN a user navigates to `/:gwId/player/:playerId` THE system SHALL render a persistent identity masthead and a page-level tab bar (Overview / Positions / Pitch repertoire) | [ ] |
| PDETUI-007 | WHEN the Positions tab is selected THE system SHALL offer a view-switcher across field diagram, bar grid, and coverage pills, all derived from the 9-key `positions` map | [ ] |
| PDETUI-008 | WHEN the Overview tab is selected THE system SHALL show the flat-7 tinted ratings (with a display-only OVR toggle), a contract block (team + term), and a deferred Career & accomplishments hook | [ ] |
| PDETUI-009 | WHEN the player's primary position is Pitcher THE system SHALL render a Pitch repertoire tab showing the 4-pitch cards (VEL/CTL/SPN) | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)
- LLD: `docs/llds/player-detail-ui.md`
- Backend sibling specs: `docs/specs/player-detail-read-api-specs.md`
- Sibling UI specs: `docs/specs/team-roster-ui-specs.md`
- Decision record: [#148](https://github.com/wulke/premier-league-baseball/issues/148)
- Code: `src/ui/routes.tsx` (`player/:playerId`), `src/ui/pages/player-detail.tsx`
