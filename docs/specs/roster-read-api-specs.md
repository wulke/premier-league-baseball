# Specs: Roster Read API

Backend requirements for the team roster read endpoint and its domain read
(`src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`, `src/db/domain/team.ts`,
`src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| ROST-001 | WHEN `:teamId` does not match a Team THE system SHALL respond `404` with `{ error }` | [x] → #169 |
| ROST-002 | WHEN `?gwId=` is provided and the team belongs to a different GameWorld THE system SHALL respond `404` (team IDs are globally unique, so no gw-nested path is needed) | [x] → #169 |
| ROST-003 | WHEN a Team exists but has zero active Contracts THE system SHALL return an empty array, not an error | [x] → #169 |
| ROST-004 | WHEN multiple Contract rows exist for one player (multi-year history) THE system SHALL apply a `startDate`/`endDate` active-filter, returning only the Contract that covers `GameWorld.currentDate` | [ ] |
| ROST-005 | WHEN two or more positions tie for the highest rating THE system SHALL derive `primaryPosition` as the first-listed position in enum order | [x] → #169 |
| ROST-006 | WHEN deriving `positionCoverage` THE system SHALL use a placeholder threshold of `70`; analytical calibration of the threshold is deferred to engine/generation work | [D] |
| ROST-007 | WHEN a client requests `GET /api/team/:teamId/roster` THE system SHALL return a flat array of roster rows anchored on the team's active Contracts via a `Team → Contract → Player` join | [x] → #169 |
| ROST-008 | WHEN composing a roster row THE system SHALL include the identity fields, a derived `primaryPosition`, and the flat-7 ratings verbatim, and SHALL NOT include a stored or computed OVR | [x] → #169 |
| ROST-009 | WHEN deriving `positionCoverage` THE system SHALL return the set of positions whose rating meets the threshold, always including the primary position | [x] → #169 |
| ROST-010 | WHEN returning a roster THE system SHALL return rows in `Player.id` order with no server-side sort or filter — sort and filter are the UI's responsibility | [x] → #169 |
| ROST-011 | WHEN composing a roster row THE system SHALL include a `positions` field carrying the full 9-key fielding-rating map verbatim, alongside (not in place of) the derived `primaryPosition`/`positionCoverage` fields | [x] → #225 |

`ROST-004` was Deferred, recording a deliberate v1 gap traceable to the transfers map
([#140](https://github.com/wulke/premier-league-baseball/issues/140)); the anchored-on-Contract
design made it a one-line seam. [#237](https://github.com/wulke/premier-league-baseball/issues/237)
is that map — `docs/specs/contract-lifecycle-specs.md`'s `XFER-022` supersedes this row with the
concrete filter (via the existing `resolveCurrentContract` helper), so `ROST-004` is flipped to
Active (`[ ]`) here, to be marked Implemented once that map's code lands (stage 5).

`ROST-006` remains Deferred — it records a v1 gap traceable to the engine/generation map
([#136](https://github.com/wulke/premier-league-baseball/issues/136)), unrelated to transfers.

`ROST-011` was added by the Lineup View redesign
([#225](https://github.com/wulke/premier-league-baseball/issues/225),
[`lineup-view-ui.md`](../llds/lineup-view-ui.md)) — its Defensive tab needs a starter's rating
*at their assigned position*, which need not be their `primaryPosition`.

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)
- LLD: `docs/llds/roster-read-api.md`
- Sibling specs: `docs/specs/player-identity-specs.md`, `docs/specs/player-detail-read-api-specs.md`
- Decision record: [#145](https://github.com/wulke/premier-league-baseball/issues/145)
- Code: `src/api/endpoints.ts` (`GetTeamRoster`), `src/api/router.ts`, `src/api/handlers.ts` (`getTeamRoster`), `src/db/domain/team.ts` (`getRoster`), `src/api/models.ts` (`RosterPlayer`)
- `ROST-011` consumer: `docs/specs/lineup-view-ui-specs.md` (`LINEUI-005`)
