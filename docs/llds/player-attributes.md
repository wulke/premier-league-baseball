# LLD: Player Model & Attribute Schema

> Upstream: [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md#hld-players-attributes-stats--contracts) ·
> EARS: `docs/specs/player-attributes-specs.md` (`PATTR-001`..) ·
> Decision record: [#60 Design Player attribute schema (position, ratings shape)](https://github.com/wulke/premier-league-baseball/issues/60)

## Scope

Defines the new `Player` Sequelize model and its `attributes` JSON shape — a flat, non-role-conditioned
set of scalar ratings, a dense per-position affinity map, and a per-pitch repertoire. Does **not** cover
roster generation (`docs/llds/player-contracts-roster.md`, #64) or stats (`docs/llds/player-stats.md`,
#61/#62) — this LLD is the `Player` row shape only.

## Interface / Data Model

```ts
// src/db/model/ — new Player model
interface Player {
  id: number;
  teamId: number | null;   // FK to Team.id — null = free agent
  gameWorldId: number;     // FK to GameWorld.id — Player is scoped per-GameWorld, mirrors Team.gameWorldId
  attributes: PlayerAttributes; // JSON column
}

// attributes JSON shape
type PlayerAttributes = {
  // shared scalar ratings — single pool, not namespaced by category (one `vision`, not `batting.vision`)
  contact: number;
  power: number;
  armStrength: number;
  accuracy: number;
  reaction: number;
  vision: number;
  discipline: number;
  // scale: 1-100 tentative, not locked — a range detail, doesn't block downstream consumers

  positions: {              // dense — every position present on every player, not just their "main" one
    Pitcher: number; Catcher: number; FirstBase: number; SecondBase: number;
    ThirdBase: number; Shortstop: number; LeftField: number; CenterField: number; RightField: number;
  };

  pitches: Array<{           // every player has entries, including non-pitchers (weak Fastball + Changeup)
    type: 'Fastball' | 'Curveball' | 'Slider' | 'Changeup';
    velocity: number;
    control: number;
    spin: number;
  }>;
};
```

### Field semantics

| Field | Notes |
|---|---|
| `teamId` | Nullable FK — `null` represents a free agent. Not enforced non-null at the schema level. **Denormalized "current team" pointer**, not the authoritative record of the Player/Team relationship — `Contract` (`docs/llds/player-contracts-roster.md`) is. Kept alongside `Contract` for query ergonomics: "who is currently on Team X's roster" is the most common Player query and reading a plain FK is simpler than filtering `Contract` rows to the one covering the current `GameWorld.year`. See `docs/llds/player-contracts-roster.md`'s Edge Case Probe for the sync-responsibility trade-off this introduces. |
| `gameWorldId` | Required FK — a `Player` belongs to exactly one `GameWorld`, never shared/global across worlds. |
| scalar ratings | One shared pool (`contact`/`power`/`armStrength`/`accuracy`/`reaction`/`vision`/`discipline`) usable in multiple contexts (e.g. `armStrength` grades both a fielder's throw and a pitcher's fastball). Expected to grow. |
| `positions` | Dense affinity map — every player has a rating at every one of the 9 positions, not just a "primary" one. No stored `position` column; primary position for display is **derived at read-time** as the highest-rated `positions` entry. |
| `pitches` | Repertoire array, not a flat per-player field. Populated uniformly regardless of position — non-pitchers still get entries (a weak `Fastball` + `Changeup`), so the shape never branches on "is this player a pitcher." `type` is a fixed enum for now, open to growing. |

## Logic Flow

### Deriving a player's primary position (read-time, not stored)

```
primaryPosition(player):
  return argmax(player.attributes.positions)   // highest-rated entry in the dense map
```

No write path persists a "primary position" — every consumer that needs one derives it from
`attributes.positions` at read time, so it can never drift from the ratings that determine it.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Two or more `positions` entries tie for highest rating | Not resolved by this LLD — `argmax` tie-breaking (first-listed enum order, random, etc.) is left to whichever read-time consumer needs a single "primary position" display value. | PATTR-001 |
| e2 | A non-pitcher's `pitches` array | Still populated (weak `Fastball` + `Changeup` entries per the shape decision) — no branch skips population by position, keeping generation and read logic uniform. | PATTR-002 |
| e3 | Rating scale bounds (1-100) | Tentative, not locked at the schema level — this LLD does not add a runtime range validator; treated as a range detail that doesn't block consumers built against the shape. | — |
| e4 | `teamId: null` (free agent) | Valid state — a `Player` can exist unassigned to any `Team`. Not exercised by the roster-generation flow in this map (every generated `Player` is immediately assigned a `teamId`), but the column allows it for future free-agency work. | PATTR-003 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-players-attributes-stats--contracts) |
| **This LLD** | `docs/llds/player-attributes.md` |
| EARS | `docs/specs/player-attributes-specs.md` — `PATTR-001`.. |
| Tests | `test/db/domain/player.test.ts` |
| Code | `src/db/model/player.ts`, `src/db/model/associations.ts`, `src/api/models.ts`, `src/db/domain/player.ts` |
| Decision record | [#60](https://github.com/wulke/premier-league-baseball/issues/60) |
