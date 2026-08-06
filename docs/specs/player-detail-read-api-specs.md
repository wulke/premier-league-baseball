# Specs: Player Detail Read API & Contract DATE Migration

Backend requirements for the player detail read endpoint, the anchored `PlayerFactory(playerId).getDetail()`
read, current-Contract resolution, and the `Contract` integer-year → DATE migration
(`src/db/model/contract.ts`, `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`,
`src/db/domain/player.ts`, `src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| PDET-001 | WHEN `:playerId` does not match a Player THE system SHALL respond `404` with `{ error }` | [ ] |
| PDET-002 | WHEN `?gwId=` is provided and the player belongs to a different GameWorld THE system SHALL respond `404` | [ ] |
| PDET-003 | WHEN resolving the current Contract THE system SHALL return the row whose `[startDate, endDate]` contains `GameWorld.currentDate`, falling back to the GameWorld `year` when `currentDate` is null | [ ] |
| PDET-004 | WHEN no Contract covers the current date THE system SHALL set `contract` to `null` (the free-agent signal) and SHALL omit `Player.teamId` and `gameWorldId` from the response | [ ] |
| PDET-005 | WHEN migrating `Contract` from integer years to DATE on a preserved database THE system SHALL require a data backfill; for the dev database the migration is obviated by drop-and-recreate (#144) | [D] |
| PDET-006 | WHEN Contract rows overlap or gap (a write-integrity violation) THE system SHALL apply no committed tie-break — well-formed data self-resolves; overlap/gap prevention is deferred to the transfers map | [D] |
| PDET-007 | WHEN a Player is a free agent (`teamId: null`) THE system SHALL serve the detail unchanged with `contract: null` — no flag, no listing, no writes | [ ] |
| PDET-008 | WHEN two or more positions tie for the highest rating THE system SHALL derive `primaryPosition` as the first-listed position in enum order (consistent with ROST-005) | [ ] |
| PDET-009 | WHEN the `Contract` model is defined THE system SHALL use `startDate` and `endDate` as `DATE` columns (superseding the `startYear`/`endYear` integers in PCON-008 — year-ints could not disambiguate a same-year trade), and SHALL NOT define a salary field | [ ] |
| PDET-010 | WHEN a client requests `GET /api/player/:playerId` THE system SHALL return identity, the full `attributes` verbatim (flat-7 + 9-key `positions` + `pitches`), and the current Contract or null | [ ] |
| PDET-011 | WHEN composing the detail response THE system SHALL NOT compute or include a stored OVR — `attributes` are served verbatim and the Player's team is reached via `contract` only | [ ] |

`PDET-005` and `PDET-006` are Deferred, not Active — they record migration posture and a write-integrity
obligation owned by [#140](https://github.com/wulke/premier-league-baseball/issues/140), not behaviors to
implement in this map. `PDET-009` amends PCON-008's column-type clause; the PCON-008 row in
`docs/specs/player-contracts-specs.md` is cascaded to the DATE form when the migration lands (stage 5).

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)
- LLD: `docs/llds/player-detail-read-api.md` (amends `docs/llds/player-contracts-roster.md`)
- Sibling specs: `docs/specs/player-identity-specs.md`, `docs/specs/roster-read-api-specs.md`, `docs/specs/player-contracts-specs.md` (PCON-008 amended by PDET-009)
- Decision record: [#146](https://github.com/wulke/premier-league-baseball/issues/146)
- Code: `src/db/model/contract.ts` (DATE), `src/api/endpoints.ts` (`GetPlayerDetail`), `src/api/router.ts`, `src/api/handlers.ts` (`getPlayerDetail`), `src/db/domain/player.ts` (anchored `PlayerFactory` + `getDetail` + `resolveCurrentContract`), `src/api/models.ts` (`PlayerDetail`)
