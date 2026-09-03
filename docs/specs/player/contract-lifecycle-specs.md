# Specs: Contract Lifecycle (Sign / Release / Renew)

Backend requirements for the roster-mutating write surface — `ContractFactory` sign/release/renew,
the `League.cutover()` reconcile sweep, the transfer-write authorization seam, and the
current-membership read helper's promotion into `TeamFactory.getRoster()` /
`GameWorldFactory.getFreeAgents()` (`src/db/domain/contract.ts`, `src/db/domain/player.ts`,
`src/db/domain/team.ts`, `src/db/domain/league.ts`, `src/db/domain/game-world.ts`,
`src/db/domain/lineup.ts`, `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`).

| ID | Requirement | Status |
|---|---|---|
| XFER-001 | WHEN any transfer mutation (Sign, Release, Renew) is requested IF `GameWorld.currentDate` is `null` THE system SHALL reject with `422` before any `Contract`/`Player` write | [x] → #237 |
| XFER-002 | WHEN Sign is requested IF `playerId` does not match a Player, or the Player belongs to a different `GameWorld` than the acting team THE system SHALL reject with `404` | [x] → #237 |
| XFER-003 | WHEN Sign is requested IF the target Player already has a Contract covering `GameWorld.currentDate` (with any team) THE system SHALL reject with `422` — Sign never overwrites an active tenure | [x] → #237 |
| XFER-004 | WHEN Release is requested IF the acting team does not currently hold a Contract covering `GameWorld.currentDate` for the target Player THE system SHALL reject with `422` before any write | [x] → #237 |
| XFER-005 | WHEN Renew is requested IF the acting team does not currently hold a Contract covering `GameWorld.currentDate` for the target Player THE system SHALL reject with `422`; renewal SHALL NOT additionally require the current Contract to be near its `endDate` | [x] → #237 |
| XFER-006 | WHEN Renew is requested THE system SHALL reject with `422` if any existing Contract for the target Player already covers the computed successor start date (`oldRow.endDate + 1 day`) — no stacking | [x] → #237 |
| XFER-007 | WHEN Sign or Renew is requested with a client-supplied `endDate` THE system SHALL reject with `422` if that `endDate` is before the mutation's own start date (`startDate ≤ endDate` enforced at mint) | [x] → #237 |
| XFER-008 | WHEN `League.cutover()` completes its season-rollover work THE system SHALL run a `GameWorld`-wide reconcile pass setting each Player's `teamId` to the `teamId` of the Contract covering `GameWorld.currentDate` (or `null` if none); THE system SHALL make this pass idempotent so re-running it from a second League's cutover in the same `GameWorld` is a correctness no-op | [x] → #237 |
| XFER-009 | WHEN a client requests `GET /api/gameWorld/:gwId/free-agents` IF `:gwId` does not match a GameWorld THE system SHALL respond `404` | [x] → #237 |
| XFER-010 | WHEN a transfer-mutation endpoint (Sign, Release, or Renew) is called IF `DEV_MODE` is not set and the acting `teamId` does not equal `GameWorld.managedTeamId` THE system SHALL reject with `422` before any `ContractFactory` call; IF `DEV_MODE` is set THE system SHALL bypass this identity check only, leaving every mutation invariant (XFER-001 through XFER-007) enforced unchanged | [x] → #237 |
| XFER-011 | WHEN `LineupFactory().repairActive()` fails during a Sign or Release (e.g. an insufficient fielder pool) THE system SHALL propagate that error and roll back the entire mutation transaction, leaving `Contract`, `Player`, and `Lineup` rows unchanged; roster-size `[20, 30]` bounds SHALL remain unvalidated (PCON-005) | [x] → #237 |
| XFER-012 | WHEN Sign succeeds THE system SHALL create one Contract row with `startDate = GameWorld.currentDate` and `endDate` equal to the client-supplied `endDate` or, if omitted, the `defaultSeasonEnd` anchor (XFER-020) | [x] → #237 |
| XFER-013 | WHEN Sign succeeds THE system SHALL, within the same transaction as the Contract write, update `Player.teamId` to the signing team and repair the team's active Lineup — superseding PCON-007's deferred sync obligation | [x] → #237 |
| XFER-014 | WHEN Release succeeds THE system SHALL close the acting team's current Contract row early, setting its `endDate` to `GameWorld.currentDate − 1 day` | [x] → #237 |
| XFER-015 | WHEN Release succeeds THE system SHALL delete every not-yet-started Contract row (`startDate > GameWorld.currentDate`) belonging to the releasing team for the target Player, including any queued renewal successor | [x] → #237 |
| XFER-016 | WHEN Release is performed THE system SHALL NOT read or write any Contract row belonging to a team other than the acting team, regardless of that Player's contract history with other teams | [x] → #237 |
| XFER-017 | WHEN Release succeeds THE system SHALL, within the same transaction as the Contract writes, set `Player.teamId` to `null` and repair the team's active Lineup — superseding PCON-007's deferred sync obligation | [x] → #237 |
| XFER-018 | WHEN Renew succeeds THE system SHALL mint one successor Contract row starting at `oldRow.endDate + 1 day`, with `endDate` equal to the client-supplied `endDate` or, if omitted, the `defaultSeasonEnd` anchor (XFER-020) | [x] → #237 |
| XFER-019 | WHEN Renew succeeds THE system SHALL NOT modify `Player.teamId` or the team's active Lineup — team membership is unchanged by a renewal | [x] → #237 |
| XFER-020 | WHEN Sign or Renew needs a default `endDate` THE system SHALL derive it from one shared `SEASON_END` anchor (October 31), rolling the target season-year forward by one when the mutation's start date falls on or after November 1 | [x] → #237 |
| XFER-021 | WHEN initial roster generation (`generateRoster()`) issues its starting Contract rows THE system SHALL delegate the write to a `ContractFactory`-owned writer and derive each term's end date from the same `SEASON_END_MONTH`/`SEASON_END_DAY` constants XFER-020 uses | [x] → #238 |
| XFER-022 | WHEN composing a team roster (`TeamFactory.getRoster()`) THE system SHALL include, per player, only the Contract that covers `GameWorld.currentDate` — superseding ROST-004's unfiltered v1 behavior | [x] → #237 |
| XFER-023 | WHEN a client requests `GET /api/gameWorld/:gwId/free-agents` THE system SHALL return one row per Player in that GameWorld with no Contract covering `GameWorld.currentDate`, serialized with the same row shape and derivation `TeamFactory.getRoster()` uses | [x] → #237 |

All rows are Implemented (`[x] → #237`) — this map introduces the write surface itself, so none were
ever Deferred. `XFER-013`/`XFER-017` supersede `PCON-007` (`docs/specs/player/player-contracts-specs.md`,
flipped from Deferred to Implemented by this map — see its Traceability note); `XFER-022` supersedes
`ROST-004` (`docs/specs/manager/roster-read-api-specs.md`, likewise flipped). `PCON-006` is also flipped from
Deferred to Implemented: this map is the code path that makes contract-expiry-driven free-agency
observable, via the read-side filtering `XFER-022`/`XFER-023` apply and the `XFER-008` cutover sweep
that corrects the `Player.teamId` cache — `PCON-006`'s original "SHALL NOT auto-trigger renewal" clause
is unchanged and reaffirmed by `XFER-006` (Renew always requires an explicit call; nothing renews on
its own).

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: `docs/high-level-design.md` — no dedicated HLD section exists yet for Transfers; [#237](https://github.com/wulke/premier-league-baseball/issues/237)'s resolved grill-me decision record stands in for it.
- LLD: `docs/llds/contract-lifecycle.md`
- Sibling specs: `docs/specs/manager/transfers-ui-specs.md` (UI consumer), `docs/specs/player/player-contracts-specs.md` (PCON-006/007 activated), `docs/specs/manager/roster-read-api-specs.md` (ROST-004 superseded), `docs/specs/player/player-detail-read-api-specs.md` (shares `resolveCurrentContract`)
- Decision record: [#140](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237)
- Code: `src/db/domain/contract.ts` (`ContractFactory`, `SEASON_END_MONTH`/`SEASON_END_DAY`, `defaultSeasonEnd`, `reconcileTeamMemberships`), `src/db/domain/player.ts` (`toRosterPlayer` extraction), `src/db/domain/team.ts` (`getRoster` filter), `src/db/domain/league.ts` (`cutover` sweep hook), `src/db/domain/game-world.ts` (`getFreeAgents`), `src/db/domain/lineup.ts` (`repairActive`), `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts` (`signPlayer`, `releasePlayer`, `renewPlayer`, `getFreeAgents`, `assertManaged`)
