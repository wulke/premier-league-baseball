# LLD: Contract Schema & Roster Generation

> Upstream: [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md#hld-players-attributes-stats--contracts) ·
> EARS: `docs/specs/player/player-contracts-specs.md` (`PCON-001`..) ·
> Decision record: [#63 Design Contract schema + roster size + expiry/free-agency rules](https://github.com/wulke/premier-league-baseball/issues/63), [#64 Design roster-generation algorithm at Team creation](https://github.com/wulke/premier-league-baseball/issues/64)

## Scope

Defines the `Contract` model, roster size constraints, and the initial roster-generation algorithm
hooked into Team creation. Depends on `Player.attributes` shape (`docs/llds/player-attributes.md`, #60).
Does not cover Contract-expiry enforcement/free-agency, or transfer/trade mechanics — both explicitly
deferred past this schema map (see HLD "Out of scope").

## Current implementation slice (`#74`)

`#73` landed the schema surface required for roster generation:

- `Contract` Sequelize model registration
- `Player`/`Team` associations to `Contract`
- exported roster-size constants

`#74` completes the runtime slice described below:

- `PlayerFactory.generateRoster(teamId, gwId)` creates the initial roster
- `TeamFactory.create()` calls `generateRoster()` immediately after the `Team` row exists
- generated `Player.teamId` is written by `PlayerFactory`; the accompanying initial Contract rows
  are minted by ContractFactory's `createInitialRosterContracts()` writer within the same transaction

Roster-size enforcement beyond generation-by-construction and any runtime behavior tied to
`Contract.endYear` remain out of scope.

## Interface / Data Model

```ts
// src/db/model/ — new Contract model
interface Contract {
  id: number;
  playerId: number; // FK to Player.id
  teamId: number;   // FK to Team.id
  startYear: number; // relative to GameWorld.year
  endYear: number;   // relative to GameWorld.year — descriptive only, see Edge Case Probe e3
  // no `value`/salary field in v1
}
```

### Roster size constraint

Flat headcount range per Team: **min 20 / max 30** active Players. No per-position minimums (e.g. no
enforced pitcher count) at the schema/validation level — position balance is a property the
generation algorithm below must produce **by construction**, not something validated at write-time.

For code reuse, the roster-generation slice will consume named exports:

```ts
const MIN_ROSTER_SIZE = 20;
const MAX_ROSTER_SIZE = 30;
```

### Roster-generation algorithm (hooked into `TeamFactory.create()`)

```ts
// src/db/domain/player.ts — new PlayerFactory (separate from TeamFactory)
interface IPlayerFactory {
  generateRoster: (teamId: number, gwId: number) => Promise<Player[]>;
}
```

Called by `TeamFactory.create()` (`src/db/domain/team.ts`) after the `Team` row exists.

## Logic Flow

### Roster generation, step by step

```
generateRoster(teamId, gwId):
  headcount = randomInt(20, 30)                       // uniform, inclusive range

  pitcherCount = round(headcount * 0.40)               // ~40% Pitchers
  fielderCount = headcount - pitcherCount
  # remainder split proportionally across the 8 fielding positions
  # (Catcher, 1B, 2B, 3B, SS, LF, CF, RF) — exact per-position ratio is an implementation
  # detail left open by this LLD; "proportional, not hardcoded template" is the constraint

  players = []
  for i in 1..headcount:
    position = assign next slot per the pitcher/fielder split above
    attributes = {
      contact, power, armStrength, accuracy, reaction, vision, discipline:
        each uniformRandom(1, 100),   // no position-appropriate skew — see Key Decision below
      positions: { <all 9 positions>: uniformRandom(1, 100) },  // dense map, independent of `position` slot
      pitches: [Fastball, Curveball, Slider, Changeup].map(type => ({
        type, velocity: uniformRandom(...), control: uniformRandom(...), spin: uniformRandom(...)
      })),  // every player gets entries, including non-pitchers
    }
    player = Player.create({ teamId, gameWorldId: gwId, attributes })
    players.push(player)

  createInitialRosterContracts(teamId, players.map(p => p.id), year, { transaction })
    // ContractFactory owns the bulk Contract write and mints
    // startDate = <year-03-01>, endDate = <year-10-31>

  return players
```

### Key decisions embedded in this flow

- **Uniform random, no position skew**: every attribute, every `positions` map entry, and every
  `pitches` entry is rolled independently and uniformly — the `position` a player was allocated during
  the pitcher/fielder split does **not** bias their rolled ratings toward that position. This is a
  deliberate v1 simplification, not an oversight: low-level player-type/skew tuning (e.g. making a
  Pitcher-slotted player's `pitches`/`armStrength` roll higher) is planned as a later refinement pass
  once player-type details are worked out.
- **1-season Contract term** (`startDate = March 1`, `endDate = October 31` of the generated year): deliberately short so every generated roster's
  Contracts expire after the first season, forcing early exercise of Contract lifecycle/free-agency
  mechanics (deferred fog, not this map's concern) rather than letting rosters sit static for years
  before that gap is ever exercised.
- **`Player.teamId` and `Contract` both encode team membership, deliberately.** `Contract` is the
  authoritative, historical record (one row per team-tenure, with a term); `Player.teamId` is a
  denormalized "current team" pointer kept for query ergonomics — see
  `docs/llds/player-attributes.md`'s field semantics. This generation flow writes both in the same
  call, so they can't drift *here*. The two fields staying in sync going forward is **not yet
  someone's job** — no code path exists yet that changes a `Player`'s team after initial generation
  (transfers/trades are deferred fog per the HLD). Whichever future map introduces team changes must
  update `Player.teamId` and `Contract` together as one unit of work; this LLD does not solve that,
  it only flags that the obligation exists.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Generated roster naturally falls at the [20, 30] boundary | Allowed — the range is inclusive; no separate boundary handling needed since `randomInt(20, 30)` already respects it. | PCON-001 |
| e2 | Roster ends up outside [20, 30] due to a future generation-algorithm bug | **Not enforced or validated in v1** — no runtime guard blocks `Team` creation or `newSeason()` if a roster falls outside range. Roster-generation is expected to produce valid rosters by construction; revisit enforcement later if it becomes a real problem. | PCON-002 |
| e3 | A `Contract`'s `endYear` is reached (`GameWorld.year` advances past it) | **Not handled.** `endYear` is descriptive data only — no free-agency flip, no auto-renewal, and `newSeason()` does not check or react to expiring Contracts. Deferred to a future map. | PCON-003 |
| e4 | Position allocation proportional split doesn't divide evenly across headcount/ratio | Implementation detail (rounding strategy) left open by this LLD — any reasonable rounding that keeps `pitcherCount + fielderCount = headcount` satisfies the "proportional, not hardcoded" constraint. | — |
| e5 | `Player.teamId` at generation time | Always set (never a free agent) — every `Player` produced by `generateRoster` is immediately assigned to the `teamId` it was generated for. Free-agent (`teamId: null`) `Player` rows are a valid state per `docs/llds/player-attributes.md` but not produced by this flow. | — |
| e6 | `Player.teamId` diverges from the `teamId` on a Player's current `Contract` (e.g. a future map changes one without the other) | **Not guarded by this LLD.** No runtime check cross-validates the two. This map's generation flow can't produce the divergence (both written together), but nothing prevents a future writer from doing so — flagged as an obligation for whichever map next mutates team assignment, not solved here. | PCON-007 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-players-attributes-stats--contracts) |
| **This LLD** | `docs/llds/player-contracts-roster.md` |
| EARS | `docs/specs/player/player-contracts-specs.md` — `PCON-001`.. |
| Code | `src/db/model/contract.ts` (`Contract`), `src/db/model/associations.ts`, `src/db/domain/contract.ts` (`MIN_ROSTER_SIZE`, `MAX_ROSTER_SIZE`), `src/db/domain/player.ts` (`generateRoster`), `src/db/domain/team.ts` (`TeamFactory.create()` hook) |
| Decision record | [#63](https://github.com/wulke/premier-league-baseball/issues/63), [#64](https://github.com/wulke/premier-league-baseball/issues/64) |
