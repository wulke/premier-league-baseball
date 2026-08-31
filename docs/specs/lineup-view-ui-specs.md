# Specs: Team Lineup View UI

Frontend requirements for the Lineup tab at `/:gwId/team/:teamId/lineup`, consuming the active
lineup card from `GET /api/team/:teamId/lineup` and roster display identities.

| ID | Requirement | Status |
|---|---|---|
| LINEUI-001 | WHEN the team hub renders THE system SHALL provide a read-only Lineup tab at `/:gwId/team/:teamId/lineup` alongside Calendar and Roster. | [x] → #200 |
| LINEUI-002 | WHEN an active lineup has DH disabled THE system SHALL render its nine batting starters in order 1 through 9, show each fielding position, and highlight the starting pitcher without rendering a DH row. | [x] → #200 |
| LINEUI-003 | WHEN an active lineup has DH enabled THE system SHALL render batting starters in order 1 through 9, render the null-position starter as a DH row, and highlight the non-batting starting pitcher. | [x] → #200 |
| LINEUI-004 | WHEN the active lineup renders THE system SHALL display bench and bullpen pools and SHALL link every starter, reserve, and pitcher row to `/:gwId/player/:playerId` without providing a mutating control. | [x] → #200 |
| LINEUI-005 | WHEN the Defensive tab renders THE system SHALL show one row per starter (nine, or ten when DH is enabled), each row displaying the player, their assigned fielding position, and their rating at that position (`RosterPlayer.positions[fieldingPosition]`, ROST-011). | [ ] |
| LINEUI-006 | WHEN the Lineup tab renders THE system SHALL provide Defensive and Batting tab views, defaulting to the Defensive tab, and switching between them SHALL NOT trigger a new network fetch. | [ ] |
| LINEUI-007 | WHEN either tab renders THE system SHALL append the bench players as `BENCH`-tagged rows and the bullpen players as `BULLPEN`-tagged rows after the starter rows, in API-returned order, with no fielding position or rating value shown on those rows. | [ ] |
| LINEUI-008 | IF a starter's positional rating is unavailable (the roster fetch failed, or the player is absent from the roster response) THE system SHALL render the rating as an em dash rather than omitting the row or throwing. | [ ] |

LINEUI-005 through LINEUI-008 formalize the Defensive \| Batting tabbed redesign
([#225](https://github.com/wulke/premier-league-baseball/issues/225)), which replaces the
two-panel layout LINEUI-001 through LINEUI-004 originally described; those four rows' assertions
(tab presence, DH handling, bench/bullpen visibility, no mutating control) remain true under the
new layout and are not superseded, only realized differently — see
[`lineup-view-ui.md`](../llds/lineup-view-ui.md) for the mapping.

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Lineup View — Defensive | Batting Tabs](../high-level-design.md#hld-lineup-view--defensive--batting-tabs)
- LLD: `docs/llds/lineup-view-ui.md`
- Backend sibling specs: `docs/specs/lineup-read-api-specs.md`, `docs/specs/roster-read-api-specs.md` (`ROST-011`)
- Decision record: #138, #200 (original) · [#225](https://github.com/wulke/premier-league-baseball/issues/225) (this redesign)
- Code: `src/ui/routes.tsx`, `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-lineup.tsx`
