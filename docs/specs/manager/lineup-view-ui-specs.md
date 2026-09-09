# Specs: Team Lineup View UI

Frontend requirements for the Lineup tab at `/:gwId/team/:teamId/lineup`, consuming the active
lineup card from `GET /api/team/:teamId/lineup` and roster display identities.

| ID | Requirement | Status |
|---|---|---|
| LINEUI-001 | WHEN the team hub renders THE system SHALL provide a read-only Lineup tab at `/:gwId/team/:teamId/lineup` alongside Calendar and Roster. | [x] → #200 |
| LINEUI-002 | WHEN an active lineup has DH disabled THE system SHALL render its nine batting starters in order 1 through 9, show each fielding position, and highlight the starting pitcher without rendering a DH row. | [x] → #200 |
| LINEUI-003 | WHEN an active lineup has DH enabled THE system SHALL render batting starters in order 1 through 9, render the null-position starter as a DH row, and highlight the non-batting starting pitcher. | [x] → #200 |
| LINEUI-004 | WHEN the active lineup renders for a team other than `GameWorld.managedTeamId` THE system SHALL display bench and bullpen pools and SHALL link every starter, reserve, and pitcher row to `/:gwId/player/:playerId` without providing a mutating control. | [x] → #200, #249 |
| LINEUI-005 | WHEN the Defensive tab renders THE system SHALL show one row per starter (nine, or ten when DH is enabled), each row displaying the player, their assigned fielding position, and their rating at that position (`RosterPlayer.positions[fieldingPosition]`, ROST-011). | [x] → #225 |
| LINEUI-006 | WHEN the Lineup tab renders THE system SHALL provide Defensive and Batting tab views, defaulting to the Defensive tab, and switching between them SHALL NOT trigger a new network fetch. | [x] → #225 |
| LINEUI-007 | WHEN either tab renders THE system SHALL append the bench players as `BENCH`-tagged rows and the bullpen players as `BULLPEN`-tagged rows after the starter rows, in API-returned order, with no fielding position or rating value shown on those rows. | [x] → #225 |
| LINEUI-008 | IF a starter's positional rating is unavailable (the roster fetch failed, or the player is absent from the roster response) THE system SHALL render the rating as an em dash rather than omitting the row or throwing. | [x] → #225 |
| LINEUI-009 | WHEN the active lineup renders for `GameWorld.managedTeamId` THE system SHALL render an Edit affordance, and SHALL render the editing controls only after it is selected. | [x] → #255 |
| LINEUI-010 | WHEN the manager enters edit mode THE system SHALL maintain a complete roster-backed draft whose assigned rows provide role and fielding-position controls, including DH exactly when the current match rules enable it. | [x] → #255 |
| LINEUI-011 | WHEN a starter is displayed in edit mode THE system SHALL derive its batting slot without allowing it to be edited; a newly assigned non-pitcher starter, including an explicitly selected DH, SHALL receive an available batting slot, and the pitcher SHALL be locked to 9 when DH is disabled and SHALL have no batting slot when DH is enabled. | [x] → #255 |
| LINEUI-013 | WHEN a roster player has no active-lineup entry THE system SHALL show that player in an uncapped Unassigned bucket in edit mode, and SHALL allow the player to be assigned through the same draft controls while blocking duplicate starter positions. | [x] → #255 |
| LINEUI-014 | WHEN the manager saves the draft THE client SHALL PUT its complete assigned entry set to the wholesale save endpoint; on a canonical returned card it SHALL exit edit mode and use that card, while a 422 or malformed successful response SHALL retain the draft, remain in edit mode, and display an error. Cancel or route navigation SHALL discard the draft without a guard. | [x] → #255 |
| LINEUI-012 | WHEN a read-mode Lineup entry has `valid: false` THE system SHALL render a visible invalid indicator on that row. | [x] → #256 |
| LINEUI-015 | WHEN a managed team is editing its active lineup THE system SHALL let a position-player starter or bench row be dragged onto another such row, and SHALL apply the same local slot-occupant swap used by its picker before the existing Save Lineup validation gate persists the single composed draft; pitcher and bullpen rows and all non-managed-team rows SHALL expose no drag affordance. | [x] → #250 |

LINEUI-005 through LINEUI-008 formalize the Defensive \| Batting tabbed redesign
([#225](https://github.com/wulke/premier-league-baseball/issues/225)), which replaces the
two-panel layout LINEUI-001 through LINEUI-004 originally described; those four rows' assertions
(tab presence, DH handling, bench/bullpen visibility, no mutating control) remain true under the
new layout and are not superseded, only realized differently — see
[`lineup-view-ui.md`](../llds/lineup-view-ui.md) for the mapping.

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Lineup View — Defensive | Batting Tabs](../high-level-design.md#hld-lineup-view--defensive--batting-tabs)
- LLD: `docs/llds/manager/lineup-view-ui.md`
- Backend sibling specs: `docs/specs/manager/lineup-read-api-specs.md`, `docs/specs/manager/roster-read-api-specs.md` (`ROST-011`)
- Decision record: #138, #200 (original) · [#225](https://github.com/wulke/premier-league-baseball/issues/225) (this redesign)
- Code: `src/ui/routes.tsx`, `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-lineup.tsx`
