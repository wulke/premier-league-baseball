# LLD: Contract Lifecycle (Sign / Release / Renew)

> Upstream: [#237 Design: Transfers & contract-lifecycle LLD + EARS](https://github.com/wulke/premier-league-baseball/issues/237) resolved grill-me decision record ·
> EARS: `docs/specs/contract-lifecycle-specs.md` (`XFER-001`..) ·
> Decision record: [#140 grill-me: Transfers / contract-lifecycle / free-agency](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237)
> Amends: `docs/llds/player-contracts-roster.md` (PCON-006/007 activation), `docs/llds/roster-read-api.md` (ROST-004 closure), `docs/llds/player-detail-read-api.md` (no change — already anchors on `resolveCurrentContract`)

## Scope

Introduces the **roster-mutating write surface**: sign a free agent, release a player, renew an
existing contract, plus the season-cutover reconcile sweep that keeps `Player.teamId` honest. This
is the write-side counterpart to the read-only `player-contracts-roster.md` (initial generation) and
`roster-read-api.md`/`player-detail-read-api.md` (current-membership reads).

Covers: `ContractFactory` (new, `src/db/domain/contract.ts`), the single-transaction mutation unit
for each of sign/release/renew, the mutation invariants (effective-dating, gaplessness, no overlap),
the authorization seam, the `League.cutover()` reconcile sweep, and the shared current-membership
read helper's promotion into `TeamFactory.getRoster()`.

Does **not** cover: salary/value fields, contract options/bonuses/loans/buy-backs (a later deep-dive
map), trade mechanics (two-team swaps), roster-size [20, 30] enforcement (deliberately never
validated — PCON-005 stays deferred), or an `ADMIN_MODE` concept (parked, not designed). The
Transfers UI surface is `docs/llds/transfers-ui.md` (sibling).

## Interface / Data Model

```ts
// src/db/domain/contract.ts — promotes the existing constants file to a Factory
interface IContract {
  sign: (playerId: number, options?: { endDate?: Date | string }) => Promise<ContractRecord>;
  release: () => Promise<{ playerId: number; teamId: number }>;
  renew: (options?: { endDate?: Date | string }) => Promise<ContractRecord>;
}

// Anchored like TeamFactory/PlayerFactory: ContractFactory(teamId, playerId) — both writes
// (sign/release/renew) are always scoped to one acting team and one target player.
const ContractFactory = (teamId: number, playerId: number): IContract => { ... };

interface ContractRecord {
  id: number; playerId: number; teamId: number;
  startDate: string; endDate: string;   // ISO date-only, matching PlayerDetail['contract'] shape
}
```

### Mutation invariants (govern every write below)

1. **Effective-dating.** Every mutation is effective as of `GameWorld.currentDate` — never a
   client-supplied date. The handler resolves `currentDate` (ancestor read, per backend-standards
   §1) and passes it into the Factory call; there is no `effectiveDate` request-body field. If
   `GameWorld.currentDate` is `null` (season not yet started), every mutation rejects with 422 —
   see Edge Case e1.
2. **Gaplessness / no overlap.** At most one `Contract` per player may cover any given date. A
   closed tenure gets `endDate = effectiveDate − 1 day`; a new row always starts on
   `effectiveDate` (sign) or `oldRow.endDate + 1 day` (renew's successor). `startDate ≤ endDate` is
   enforced at mint (defaults always satisfy this; an explicit `endDate` override is validated
   against it — Edge Case e7).
3. **One shared `SEASON_END` anchor.** All default end-dates derive from one function so a future
   configurable season-end date changes one place:

```ts
// src/db/domain/contract.ts
const SEASON_END_MONTH = 9;  // October, 0-indexed — matches the existing generateRoster() Oct 31 term
const SEASON_END_DAY = 31;

// A date on/after November targets *next* season's year; anything else targets the current one.
function defaultSeasonEnd(fromDate: Date, gameWorldYear: number): Date {   // XFER-020
  const seasonYear = fromDate.getUTCMonth() >= 10 ? gameWorldYear + 1 : gameWorldYear;
  return new Date(Date.UTC(seasonYear, SEASON_END_MONTH, SEASON_END_DAY));
}
```

`PlayerFactory.generateRoster()` delegates its initial bulk mint to
ContractFactory's `createInitialRosterContracts()` writer with its enclosing transaction. That
ContractFactory-owned writer derives the term from `SEASON_END_MONTH`/`SEASON_END_DAY` directly
(the term always starts at season generation, never crosses the November boundary, so it does not
need `defaultSeasonEnd`'s year-rollover branch).                            # XFER-021

### Authorization seam

```ts
// src/api/handlers.ts
const DEV_MODE = process.env.DEV_MODE === 'true';

function assertManaged(gw: { managedTeamId: number | null }, teamId: number): void {
  if (DEV_MODE) return;                                   // identity-only bypass — invariants still enforced
  if (gw.managedTeamId !== teamId) {
    throw new DomainError('team is not managed by the player', 422);   // XFER-010
  }
}
```

No session/user concept exists (`docs/llds/managed-club-pointer.md`'s pointer is the only
"identity" in the app). `assertManaged` is an orchestration-layer guard, called from each of the
three transfer handlers before invoking `ContractFactory`, gating **who may call the write**, not
any domain invariant — `DEV_MODE` flips identity-checking off but a bypassed caller still hits every
mutation invariant above unchanged. `422` (not a new `403`) keeps the error-shape convention flat
per backend-standards §3, at the cost of collapsing "not your club" and "bad input" into one status
— an acceptable simplification for a solo project with no real auth.

## Logic Flow

### Sign — `POST /api/team/:teamId/transfers/sign`

```
router → handlers.signPlayer(teamId, playerId = req.body.playerId, endDate = req.body.endDate)
  → gw = GameWorld.findByPk(via Team.gameWorldId)                                    # ancestor read
  → assertManaged(gw, teamId)                                                        # XFER-010
  → currentDate = gw.currentDate; if null → DomainError(422)                         # XFER-001
  → ContractFactory(teamId, playerId).sign(playerId, { endDate }) inside ONE transaction:
      player = Player.findByPk(playerId); if !player or player.gameWorldId !== gw.id → 404      # XFER-002
      contracts = Contract.findAll({ where: { playerId }, transaction })
      current = resolveCurrentContract(contracts, currentDate, gw.year)
      if current !== null → DomainError('player is not a free agent', 422)           # XFER-003
      start = currentDate
      end = endDate ?? defaultSeasonEnd(start, gw.year)
      if end < start → DomainError('endDate must be on or after the effective date', 422)   # XFER-007
      contract = Contract.create({ playerId, teamId, startDate: start, endDate: end }, { transaction })  # XFER-012
      Player.update({ teamId }, { where: { id: playerId }, transaction })            # XFER-013, supersedes PCON-007
      LineupFactory().repairActive(teamId, gw.id, { transaction })                   # XFER-013 — roster composition changed
      return contract
```

### Release — `POST /api/team/:teamId/transfers/release`

```
router → handlers.releasePlayer(teamId, playerId = req.body.playerId)
  → gw = GameWorld.findByPk(via Team.gameWorldId)
  → assertManaged(gw, teamId)                                                        # XFER-010
  → currentDate = gw.currentDate; if null → DomainError(422)                         # XFER-001
  → ContractFactory(teamId, playerId).release() inside ONE transaction:
      current = Contract.findOne({ where: { playerId, teamId,
        startDate: { lte: currentDate }, endDate: { gte: currentDate } }, transaction })
      if !current → DomainError('team has no current contract for this player', 422) # XFER-004
      Contract.update({ endDate: currentDate - 1 day }, { where: { id: current.id }, transaction })  # XFER-014 close early
      Contract.destroy({ where: { playerId, teamId,
        startDate: { gt: currentDate } }, transaction })                             # XFER-015 delete THIS team's future rows only
      # other teams' rows (any playerId/teamId pair not matching the acting teamId) are never touched  # XFER-016
      Player.update({ teamId: null }, { where: { id: playerId }, transaction })      # XFER-017, supersedes PCON-007 — free agent
      LineupFactory().repairActive(teamId, gw.id, { transaction })                   # XFER-017 — roster composition changed
      return { playerId, teamId }
```

### Renew — `POST /api/team/:teamId/transfers/renew`

```
router → handlers.renewPlayer(teamId, playerId = req.body.playerId, endDate = req.body.endDate)
  → gw = GameWorld.findByPk(via Team.gameWorldId)
  → assertManaged(gw, teamId)                                                        # XFER-010
  → currentDate = gw.currentDate; if null → DomainError(422)                         # XFER-001
  → ContractFactory(teamId, playerId).renew({ endDate }) inside ONE transaction:
      current = Contract.findOne({ where: { playerId, teamId,
        startDate: { lte: currentDate }, endDate: { gte: currentDate } }, transaction })
      if !current → DomainError('team has no current contract for this player', 422) # XFER-005
      successorStart = current.endDate + 1 day
      overlap = Contract.findOne({ where: { playerId,
        startDate: { lte: successorStart }, endDate: { gte: successorStart } }, transaction })
      if overlap → DomainError('a contract already covers the renewal start date', 422)  # XFER-006 (no stacking)
      end = endDate ?? defaultSeasonEnd(successorStart, gw.year)
      if end < successorStart → DomainError('endDate must be on or after the renewal start date', 422)  # XFER-007
      successor = Contract.create({ playerId, teamId, startDate: successorStart, endDate: end }, { transaction })  # XFER-018
      # no Player.teamId change, no lineup repair — team membership is unchanged by a renewal  # XFER-019
      return successor
```

### Cutover reconcile sweep — `LeagueFactory(id).cutover()` (amends `src/db/domain/league.ts`)

```
cutover():
  ...existing IN_SEASON/season-complete checks, year++, status = 'CUTOVER'...   (unchanged, SCL-002/008)
  # NEW — inside the same transaction, before commit:
  reconcileTeamMemberships(league.gameWorldId, gameWorld.currentDate, transaction)   # XFER-008
  ...commit...

// src/db/domain/contract.ts — co-located pure-ish helper (one DB read, then pure comparisons)
async function reconcileTeamMemberships(gameWorldId, currentDate, transaction):
  players = Player.findAll({ where: { gameWorldId }, include: [{ model: Contract }], transaction })
  for player in players:
    current = resolveCurrentContract(player.Contracts, currentDate, gameWorld.year)
    correctTeamId = current?.teamId ?? null
    if player.teamId !== correctTeamId:
      Player.update({ teamId: correctTeamId }, { where: { id: player.id }, transaction })   # XFER-008
```

### Shared current-membership read helper (amends `roster-read-api.md`)

`TeamFactory.getRoster()` currently returns every `Contract` row for the team unfiltered (`ROST-004`
— a deliberate gap "traceable to #140"). This LLD closes it:

```
getRoster():
  ...unchanged team/gameWorld lookup...
  contracts = team.getContracts({ include: [Player], transaction? })          # unchanged query — full history
  byPlayer = group contracts by playerId
  currentRows = [player.id in byPlayer].map(id => resolveCurrentContract(byPlayer[id], gw.currentDate, gw.year))
                  .filter(row => row !== null)                                          # XFER-022, supersedes ROST-004
  return currentRows.map(toRosterPlayer(gw.year))    // shared serializer, extracted from the old inline .map()
```

`toRosterPlayer(gameWorldYear)` is the existing inline row-mapping logic in `getRoster()`, extracted
into a co-located pure function in `player.ts` (alongside `resolveCurrentContract`/`primaryPosition`)
so `GameWorldFactory.getFreeAgents()` (below, and `docs/llds/transfers-ui.md`) can reuse it verbatim.

### Lineup repair (new — `src/db/domain/lineup.ts`)

`LineupFactory().generateActive()` (`docs/llds/lineup-generation.md`) is idempotent — it returns the
existing active `Lineup` untouched if one exists, so it cannot re-derive a lineup after a roster
mutation. Sign/Release need a *forcing* variant:

```ts
// src/db/domain/lineup.ts
interface ILineupFactory {
  generateActive: (...) => ...;   // unchanged
  repairActive: (teamId: number, gameWorldId: number, options?: { transaction?: Transaction }) => Promise<Lineup>;
}
```

```
repairActive(teamId, gameWorldId, { transaction }):
  existing = Lineup.findOne({ where: { teamId, gameId: null }, transaction })
  if existing:
    retain entries whose players still belong to the team exactly as stored
    replace only fillable departed starter positions using optimalFieldingAssignment on those positions
    retain an unfillable departed starter entry so read projection can mark it invalid
    append the signed player to BENCH or BULLPEN; remove departed reserve entries
    return existing
  players = Team(teamId).getPlayers({ transaction })          // current roster AFTER the mutation just applied
  return LineupFactory().generateActive(teamId, gameWorldId, players, { transaction })  // no card exists to preserve
```

For an existing card, repair is a preserve-and-fill operation rather than a re-generation. It uses
the same optimal fielding-assignment machinery only for departed free positions, which protects
manual roles, batting order, and assignments of retained players. The no-card fallback still
delegates to `generateActive`.

### Free-agent listing — `GET /api/gameWorld/:gwId/free-agents`

```
GameWorldFactory(gwId).getFreeAgents():
  gw = GameWorld.findByPk(gwId); if !gw → 404                                        # XFER-009
  players = gw.getPlayers({ include: [Contract] })       // read via own association — backend-standards §1 exception
  freeAgents = players.filter(p => resolveCurrentContract(p.Contracts, gw.currentDate, gw.year) === null)  # XFER-023
  return freeAgents.map(toRosterPlayer(gw.year))          // same serializer as getRoster()
```

### Key decisions embedded in this flow

- **`ContractFactory` anchored on `(teamId, playerId)`**, not on `Contract.id` — every write this
  map introduces is a team-initiated action against one target player, matching the API shape
  (`POST /api/team/:teamId/transfers/...`). There is no standalone `Contract` CRUD surface.
- **Contract write ownership is complete.** The anchored Factory owns Sign/Release/Renew;
  `createInitialRosterContracts()` owns initial-roster minting; and
  `deleteForGameWorld()` owns the GameWorld-cascade deletion. Other domain factories may
  orchestrate those writers inside their transactions but never mutate `db.models.Contract`
  directly.
- **`effectiveDate` is never client input.** Resolved server-side from `GameWorld.currentDate` and
  threaded in as an ancestor value (backend-standards §1), so the "must equal `currentDate`"
  invariant is satisfied by construction rather than validated against a caller-supplied date.
- **Renew and Sign share one `defaultSeasonEnd` anchor**, differing only in what "from date" they
  pass in (`currentDate` for sign, `successorStart` for renew) — the November-rollover rule is
  identical for both, so it lives in exactly one function.
- **The overlap guard lives on Renew, not Sign.** Sign only ever mints a contract starting *today*
  for a player with zero current or future rows (a true free agent — Release deletes the releasing
  team's not-yet-started rows, and no other path creates a future-dated row for a free player), so
  a full overlap scan on Sign would be dead code. Renew is the only mutation that can produce a
  future-dated row next to an already-existing one, so it's the one that must guard against
  stacking.
- **`Player.teamId` is corrected at cutover, not continuously.** Between mutations, natural
  contract expiry (currentDate advancing past `endDate`) triggers no write — nothing calls a
  Factory method at that instant. `Player.teamId` can go stale until the next
  `League.cutover()` sweep. This is safe only because every read (`getRoster`, `getDetail`,
  `getFreeAgents`) resolves current membership via `resolveCurrentContract` over `Contract` rows,
  never by trusting `Player.teamId` directly — the cache is for display/denormalization
  convenience, not correctness.
- **The sweep runs GameWorld-wide, not League-scoped**, even though it's triggered from
  `LeagueFactory(id).cutover()`. `Player`/`Contract`/`Team` are direct `GameWorld` children, not
  `League` children (a `Team` can span multiple `Leagues` — backend-standards §2), so there is no
  narrower correct scope. In a multi-`League` `GameWorld`, the sweep re-runs (redundantly but
  idempotently) on each `League`'s cutover — see Edge Case e9.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `GameWorld.currentDate` is `null` at the time of any transfer mutation | Reject with `DomainError(422)` before touching `Contract`/`Player` — mutations require an effective date; reads already tolerate `null` via the `year` fallback (`PDET-005`), writes do not. | XFER-001 |
| e2 | `playerId` not found, or belongs to a different `GameWorld` than `teamId` | `DomainError('Not found', 404)`. | XFER-002 |
| e3 | Sign targets a player who already has a contract covering `currentDate` (with this team or another) | `DomainError('player is not a free agent', 422)` — Sign never overwrites an active tenure. | XFER-003 |
| e4 | Release/Renew targets a player the acting team does **not** currently hold (wrong team, or player is a free agent) | `DomainError('team has no current contract for this player', 422)` — a team may only release/renew its own current tenure. | XFER-004 / XFER-005 |
| e5 | Renew is attempted while the current contract has not yet reached its `endDate` ("renew-before-expiry") | **Allowed by design** — renewal only requires a *current* contract with the acting team; it doesn't require the current one to be expiring. The successor always starts at `oldRow.endDate + 1 day`, so an early renewal just queues the next tenure in advance without touching the active row. | XFER-005 |
| e6 | Release is attempted on a team that already has future (not-yet-started) successor rows for that player (e.g. renewed earlier, then released before the renewal takes effect) | Release deletes **all** of the releasing team's not-yet-started rows for that player, not just the current one — so a queued renewal is discarded along with the release, leaving no dangling future tenure. | XFER-015 |
| e7 | Renew/Sign is called with a client-supplied `endDate` before the mutation's own start date | `DomainError('endDate must be on or after the effective/renewal start date', 422)` — `startDate ≤ endDate` enforced at mint. | XFER-007 |
| e8 | Release targets a player who has contract rows with **other** teams (past or future tenures unrelated to the acting team) | Left untouched — Release only ever reads/writes `Contract` rows scoped to `{ playerId, teamId: <acting team> }`. Another team's history is never queried or mutated by this call. | XFER-016 |
| e9 | A `GameWorld` has multiple `Leagues`, each running its own `cutover()` | The reconcile sweep is `GameWorld`-wide and idempotent (it only writes where `Player.teamId` actually differs from the resolved current team), so a second League's cutover re-running it is a correctness no-op, not a bug. | XFER-008 |
| e10 | `DEV_MODE` is set and a write targets a team with no `managedTeamId` set at all (`gw.managedTeamId === null`) | `assertManaged` returns immediately under `DEV_MODE` regardless of `managedTeamId`'s value — the bypass is unconditional identity-skipping, not a "matches null" special case. Every mutation invariant above still applies. | XFER-010 |
| e11 | A write is attempted against a team the caller does not manage, with `DEV_MODE` unset | `DomainError('team is not managed by the player', 422)` before any `ContractFactory` call — no partial writes. | XFER-010 |
| e12 | The active lineup, after Sign/Release, no longer has a valid 20–30-sized roster to draw from (e.g. Release drops a team below the fielding minimum) | **Not guarded by this LLD** — roster-size `[20, 30]` bounds are deliberately unvalidated everywhere (`PCON-005`, unchanged). If an active card exists, `repairActive()` preserves it and leaves any unfillable departed entry invalid so the transfer commits. If no active card exists, `generateActive()` still propagates its "Roster cannot fill the eight non-pitcher positions" error and rolls back the mutation transaction (XFER-011). | XFER-011, LEDIT-006 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — no dedicated HLD section exists yet for Transfers; #237's resolved grill-me decision record (linked above) stands in for it per explicit scoping decision on #237. |
| **This LLD** | `docs/llds/contract-lifecycle.md` |
| Sibling LLD | `docs/llds/transfers-ui.md` (consumer) |
| Amends | `docs/llds/player-contracts-roster.md` (PCON-006/007 activation), `docs/llds/roster-read-api.md` (ROST-004 closure) |
| EARS | `docs/specs/contract-lifecycle-specs.md` — `XFER-001`.. |
| Gherkin | `test/bdd/features/contract-lifecycle.feature` |
| Code | `src/db/domain/contract.ts` (`ContractFactory`, `listForTeam`, `SEASON_END_MONTH/DAY`, `defaultSeasonEnd`, `reconcileTeamMemberships`), `src/db/domain/player.ts` (`toRosterPlayer` extraction), `src/db/domain/team.ts` (`getRoster` now reads via `ContractFactory`'s `listForTeam` instead of the `Team↔Contract` association, and filters to each player's current row), `src/db/domain/league.ts` (`cutover` sweep hook), `src/db/domain/game-world.ts` (`getFreeAgents`), `src/db/domain/lineup.ts` (`repairActive`, new), `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts` (`signPlayer`, `releasePlayer`, `renewPlayer`, `getFreeAgents`, `assertManaged`) |
| Decision record | [#140](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237) |
