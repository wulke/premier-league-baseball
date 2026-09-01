# LLD: Player Detail Read API & Contract DATE Migration

> Upstream: [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility) ·
> EARS: `docs/specs/player-detail-read-api-specs.md` (`PDET-001`..) ·
> Decision record: [#146 Player detail read API](https://github.com/wulke/premier-league-baseball/issues/146)

## Scope

Adds `GET /api/player/:playerId` (+ optional `?gwId=`), backed by `PlayerFactory(playerId).getDetail(...)` — **refactors `PlayerFactory` to the anchored pattern** (`Factory(id)`) to match `TeamFactory`. Serves **full `attributes` verbatim** (flat-7 + 9-key `positions` + `pitches` array + raw `birthDate` + derived `age`/`primaryPosition`) + the **current Contract**. The Contract DATE migration (`startDate`/`endDate`) is supplied by the player-identity foundation slice (#168); this map consumes it. Does **not** cover roster, writes, or UI.

## Interface / Data Model

### Contract schema migration (amends `docs/llds/player-contracts-roster.md` / `PCON` territory)

```ts
// src/db/model/contract.ts — startYear/endYear INT → startDate/endDate DATE
interface Contract {
  id: number;
  playerId: number; teamId: number;
  startDate: Date;   // was startYear: number
  endDate: Date;     // was endYear: number
  // still no `value`/salary field (→ #140)
}
```

### PlayerDetail response (flat, no envelope; raw success per backend-standards §5)

```ts
// src/api/endpoints.ts
GetPlayerDetail = '/api/player/:playerId'

// src/db/domain/player.ts — REFACTOR to anchored pattern (was PlayerFactory(): IPlayer)
interface IPlayerFactory {
  create: ...;
  generateRoster: ...;
  getDetail: (opts: { currentDate?: Date; year?: number; gwId?: number }) => Promise<PlayerDetail>;
}
// PlayerFactory is now called as PlayerFactory(playerId) — anchored, matching TeamFactory(id)

// src/api/models.ts
interface PlayerDetail {
  id: number;
  givenName: string; familyName: string; countryCode: string;
  bats: 'R'|'L'|'S'; throws: 'R'|'L'; birthDate: string;   // raw date — age derived client-side too
  age: number; primaryPosition: PlayerPosition;
  contact: number; power: number; armStrength: number; accuracy: number;
  reaction: number; vision: number; discipline: number;    // flat-7 verbatim
  positions: Record<PlayerPosition, number>;               // full 9-key map verbatim
  pitches: PlayerPitch[];                                  // full repertoire verbatim
  contract: { team: { id: number; name: string }; startDate: string; endDate: string } | null;
  // NOTE: Player.teamId / Player.gameWorldId OMITTED — team is reached via `contract` only.
}
```

### Current-Contract resolution

```ts
// src/db/domain/player.ts — new pure helper (co-located; pure logic over Contract rows)
function resolveCurrentContract(contracts: Contract[], currentDate: Date | undefined, year: number): Contract | null
// returns the row whose [startDate, endDate] contains currentDate (→ year fallback if currentDate null)
// no committed tie-break (well-formed data self-resolves); overlap/gap write-integrity owned by #140
```

## Logic Flow

```
GET /api/player/:playerId?gwId=…
  → router: handlers.getPlayerDetail(playerId = Number(req.params.playerId), gwId = Number(req.query.gwId))
  → handler (ancestor resolution lives HERE per backend-standards §1, not in the Factory):
      player = Player.findByPk(playerId); if !player → DomainError('Not found', 404)         # PDET-001
      IF gwId provided: assert player.gameWorldId === gwId else DomainError(404)              # PDET-002
      gw    = GameWorld.findByPk(player.gameWorldId)                                          # PDET-005
      currentDate = gw.currentDate ?? null          // ancestor value, passed IN
      year        = gw.year
      return PlayerFactory(playerId).getDetail({ currentDate, year, gwId })
  → PlayerFactory(playerId).getDetail({ currentDate, year }):
      contracts = Contract.findAll({ where: { playerId } })     // all rows; resolveCurrentContract picks
      current   = resolveCurrentContract(contracts, currentDate, year)   // → null if none covers 'now'
      return {
        ...identity, birthDate, age: derivedFrom(birthDate, year), primaryPosition: argmax(positions),
        ...flat-7, positions, pitches,                          // ALL verbatim
        contract: current ? { team: {id, name}, startDate, endDate } : null   # PDET-003 / PDET-007
      }
```

### Key decisions embedded in this flow

- **`PlayerFactory` anchored** — promoted from `PlayerFactory()` to `PlayerFactory(playerId)` to match the `TeamFactory(id)` sibling pattern. The closure binds the player; `getDetail` takes only the ancestor-resolved values (`currentDate`/`year`) it can't own.
- **Ancestor resolution in `handlers.ts`** — `GameWorld.currentDate`/`year` are resolved in the handler and passed into the Factory, per backend-standards §1 (Factory takes the value as a parameter; the cross-entity walk is explicit orchestration). The Factory's own validation stays against its own fields.
- **`contract: null` is the free-agent signal** — `Player.teamId`/`gameWorldId` are omitted from the response; team is reached via `contract` only. A free agent (`teamId:null` / no current contract) is served unchanged, with `contract:null`. No flag, no listing, no writes (→ #140).
- **Full `attributes` verbatim, no OVR** — flat-7 + 9-key positions + pitches array are all carried raw; nothing derived is persisted, and no OVR is computed server-side.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `playerId` not found | `DomainError('Not found', 404)`. | PDET-001 |
| e2 | `?gwId=` provided and the player belongs to a different GameWorld | `DomainError(404)` — cross-world mismatch → not-found. | PDET-002 |
| e3 | No Contract covers `currentDate` (free agent, or between contracts) | `contract: null` — not an error. The signal that carries free-agency in this view. | PDET-003 |
| e4 | The Contract DATE migration on a DB with existing INT `startYear`/`endYear` rows | Obviated for `dev.sqlite` (dropped & recreated, per #144); for any preserved DB the migration is a column rename+type change requiring a data backfill (out of scope here — this map drops the dev DB). The DATE type is chosen because year-ints couldn't disambiguate a same-year trade (a 2025 trade mid-2025-contract is invisible with INT years). | PDET-004 |
| e5 | `GameWorld.currentDate` is `null` (season not started) | `resolveCurrentContract` falls back to `year` for the containment check — so a 1-year generated Contract (covering `year`) still resolves as current. | PDET-005 |
| e6 | Overlapping or gappy Contract rows (malformed legacy/test data) | **No committed tie-break** — `resolveCurrentContract` defensively returns the first matching row. Production writes are all owned by `ContractFactory` and prevent an overlapping current tenure by construction, so this read-side behavior is not a normal domain path. | PDET-006 |
| e7 | Free agent (`Player.teamId: null`) | Served unchanged: identity + ratings + positions + pitches verbatim, `contract: null`. No special-case path; `teamId`/`gameWorldId` are omitted from the response regardless. | PDET-007 |
| e8 | `primaryPosition` tie | First-listed enum order (`primaryPosition()` reduce — PATTR-001), same as roster (`ROST-005`). | PDET-008 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-team-roster--player-visibility) |
| **This LLD** | `docs/llds/player-detail-read-api.md` |
| Amends | `docs/llds/player-contracts-roster.md` (Contract INT→DATE) |
| Sibling LLDs | `docs/llds/player-identity.md` (writes the new DATE columns), `docs/llds/roster-read-api.md` (joins on them), `docs/llds/player-detail-ui.md` (consumer) |
| EARS | `docs/specs/player-detail-read-api-specs.md` — `PDET-001`.. |
| Code | `src/db/model/contract.ts` (DATE), `src/api/endpoints.ts` (`GetPlayerDetail`), `src/api/router.ts`, `src/api/handlers.ts` (`getPlayerDetail`), `src/db/domain/player.ts` (anchored `PlayerFactory` + `getDetail` + `resolveCurrentContract`), `src/api/models.ts` (`PlayerDetail`) |
| Decision record | [#146](https://github.com/wulke/premier-league-baseball/issues/146) |
