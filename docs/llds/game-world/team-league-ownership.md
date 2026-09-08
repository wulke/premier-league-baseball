# LLD: Per-League team ownership & unambiguous identity composition

> Implementation slice for [#283](https://github.com/wulke/premier-league-baseball/issues/283) (child of [#174](https://github.com/wulke/premier-league-baseball/issues/174) — "Decide player identity composition for multi-parent-league worlds"). The decision was reached via a `/grill-me` session on #174; this LLD records the selected model: **teams are owned by exactly one Home League**, and a Team's identity composition is resolved through that ownership — never through an arbitrary League row such as `leagues[0]`.

## Goal / scope

Replace the "first configured League" arbitrary-selection pattern in `GameWorldFactory.create` with a structural, unambiguous ownership model:

- `Team` gains a persisted **NOT NULL** `homeLeagueId` FK — the durable "primary League" association #174 called for. Every Team has exactly one Home League, even though it may later participate in many Leagues via `DivisionSeason`.
- Team pools move off `NewGameWorld` and onto the `LeagueConfig` that owns them (`LeagueConfig.teams`); `NewGameWorld.teams` is removed.
- A League may instead declare `externalTeams` — "this League's teams are all of that earlier-declared League's already-created Teams" — which is how `league-cup` shares `premier-league`'s roster instead of index-overlapping a shared flat pool.
- `compositionKey` and the roster-generation `matchRules` are derived by joining `Team.homeLeagueId → League.config` at roster-generation time. Neither is duplicated onto `Team` — the Home League's config stays the single source of truth.

**In scope:** the schema change, the config-surface change, `GameWorldFactory.create`'s creation order, the live template updates, and the test-fixture adaptation the NOT NULL column forces. **Out of scope:** partial/pool-sliced external team selection (whole-roster only), cross-world team sharing, any backfill of legacy `dev.sqlite` rows (regenerated, not migrated — see PID-003's posture), and `DivisionSeason` materialization (still happens at `League.start`, unchanged).

## Interface / data model

All in `src/db/model/team.ts`, `src/db/model/associations.ts`, and `src/api/models.ts`.

```ts
// src/db/model/team.ts — NEW persisted column
sequelize.define('Team', {
  id: { ... },
  config: { type: DataTypes.JSON },
  homeLeagueId: {                    // NEW (#283) — NOT NULL FK to Leagues(id)
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

// src/db/model/associations.ts — NEW association (League is defined before Team in client.ts)
Team.belongsTo(League, { as: 'HomeLeague', foreignKey: 'homeLeagueId' });

// src/api/models.ts — config surface
interface LeagueConfig {
  key?: string;              // NEW — stable League identity within a GameWorld payload;
                             //         the target of another League's externalTeams reference
  name: string;
  type: LeagueType;
  teams?: TeamConfig[];      // NEW — this League owns and creates exactly these Teams
  externalTeams?: string;    // NEW — ...or takes ALL of an earlier-declared League's Teams
  stages: Stage[];           // divisions' defaultTeams indices are now PER-LEAGUE pool indices
  standingsConfig?: StandingsConfig;
  compositionKey?: string;
  matchRules?: Partial<MatchRules>;
};

interface NewGameWorld {
  name: GameWorldType;
  leagues: LeagueConfig[];   // teams REMOVED from this level (#283)
  year: number;
};
```

`TeamFactory.create` options change shape — the free-floating `compositionKey`/`matchRules` threading is deleted; the Home League row is now the single resolution source:

```ts
interface TeamCreateOptions {
  homeLeagueId: number;      // required — resolves compositionKey AND matchRules
  rosterSeed?: number;
}
```

`DefaultWorlds` entries drop the `teamPool` field (pools are authored on the templates themselves); the `TeamPools` registry remains the named-pool source templates reference:

```ts
const LeagueTemplates: Record<string, LeagueConfig> = {
  'premier-league': { key: 'premier-league', teams: TeamPools['england-44'], ...stages unchanged },
  'league-cup':     { key: 'league-cup', externalTeams: 'premier-league', ...stages unchanged },
  'champions-league': { key: 'champions-league', teams: TeamPools['europe-32'], ...unchanged },
  // registry-only pressure-test configs (mlb, champions-league-swiss) unchanged —
  // they never enter a NewGameWorld payload and so never meet world-level validation
};

const DefaultWorlds: Record<GameWorldType, { leagues: string[] }> = { ... };
```

## Logic flow

### Creation order (`GameWorldFactory.create`)

```
validateNewGameWorld(config)                 // world-level ownership validation (below)
→ GameWorld row
→ (1) ALL Leagues as empty containers, in leagues[] order
      (LeagueFactory().createContainer — validateLeagueConfig + League row, no Divisions)
→ (2) per-League Teams, still in leagues[] array order:
      - teams[] League  → TeamFactory().create(gw, teamConfig, { homeLeagueId: league.id })
                          (roster generation resolves compositionKey + matchRules from the
                           Home League's config via the homeLeagueId join)
      - externalTeams League → no new Teams; pull the source League's already-created
        Team rows (the source is strictly-prior, so they always exist). The resolved
        roster is registered under this League's key too, so external references can chain.
→ (3) Divisions for every League (LeagueFactory(id).createDivisions(config, teamIdRefs)),
      where teamIdRefs = the League's own created Team ids, or the external source's ids
→ return { ...gw, leagues, teams }           // teams = all newly created Team rows
```

`LeagueFactory.create(gwId, config, teamIdRefs)` remains as a composite (container + divisions) for direct single-League callers whose Teams already exist; the split primitives above are what `GameWorldFactory` composes to enforce the ownership order.

`DivisionSeason` rows still materialize at `League.start` (`DivisionFactory.newSeason`) — world creation stamps only Division configs, exactly as before; step (3) names the membership layer, not a new write.

### `TeamFactory.create` composition resolution

```
team = Team.create({ config, gameWorldId, homeLeagueId })     // FK set once, at creation
homeLeague = League.findByPk(homeLeagueId)                    // must exist, same gameWorldId
compositionKey = homeLeague.config.compositionKey             // single source of truth —
generateRoster(team, gw, {                                    // never duplicated onto Team
  compositionKey, matchRules: resolveMatchRules(homeLeague.config), ...
})
```

### World-level validation (`validateNewGameWorld`, called before any row is written)

Per League in `leagues[]`:

1. **Exactly one team source** — a truthy `teams` (non-empty array) XOR a non-empty `externalTeams`. Anything else throws.
2. **Strictly-prior source** — `externalTeams` must equal the `key` of a League declared at a strictly smaller index (mirroring `SeedingSelection.fromStage`'s rule, CFG-013). Self-reference, forward reference, and unknown keys all fail the same check.
3. **Unique keys** — duplicate `key` values throw (a reference must be unambiguous).

Plain `Error` (→ HTTP 500 via the existing router fallback), matching GWA-005's established surface for malformed create payloads — no status-code change is in scope. Per-League `validateLeagueConfig` keeps its existing responsibilities (stages/divisions/formats) and deliberately does NOT learn about team sources, because dozens of direct `LeagueFactory.create` callers author team-less configs on purpose.

## Edge case probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Team created without `homeLeagueId` | SQLite NOT NULL constraint rejects the insert; every creation path (factory + fixtures) must name a Home League. | TLO-001 |
| e2 | `homeLeagueId` names a League of a different GameWorld | `TeamFactory.create` rejects with 422 before insert — ownership can never cross worlds. | TLO-001 |
| e3 | A League declares both `teams` and `externalTeams`, or neither | `validateNewGameWorld` throws before any row is written. | TLO-003 |
| e4 | `externalTeams` points at itself, a later League, an unknown key, or a duplicate key | Strictly-prior index check / uniqueness check throws — plain-array-order creation needs no dependency resolution. | TLO-003 |
| e5 | Two independent parent Leagues with disjoint pools and different `compositionKey`s | Each Team resolves composition from its own Home League; identical seeds produce each league's own deterministic identity sequence. | TLO-006 |
| e6 | League Cup participation must not alter identity | Cup teams are the *same rows* as the source League's (no second Team row exists); `homeLeagueId` still points at the source League. | TLO-007 |
| e7 | A League's `compositionKey` is missing/unrecognized | Existing PID-002 fallback (`PREMIER_LEAGUE` composition) applies — unchanged, now reached via the Home League join. | TLO-005 |
| e8 | `dev.sqlite` carries Teams created under the old schema (no `homeLeagueId`) | Regenerated, not backfilled — there is no reliable way to reconstruct home ownership for old rows (same posture as PID-003). No migration is written. | TLO-009 |
| e9 | External reference chains (C sources from B, B sources from A) | B's resolved roster is registered under B's key when created, so C's strictly-prior lookup finds it; whole-roster semantics make the chain idempotent (C's teams = A's teams). | TLO-003 |
| e10 | Pressure-test templates (`mlb`, `champions-league-swiss`) declare no team source | Fine — they are registry-only, never enter a `NewGameWorld` payload, and so never meet `validateNewGameWorld`. | TLO-002 |
| e11 | Two independent parent Leagues declare different `matchRules` | At roster creation, each Team generates its active Lineup using `resolveMatchRules` for its own Home League; the array position of either League is irrelevant. Division-level overrides are a later, separate League/Division resolution path (LIN-002), whose existing precedence is unchanged by this ownership join. | TLO-010 |

## Traceability

- HLD: [`docs/high-level-design.md`](../../high-level-design.md) — unchanged; this slice refines ownership inside the existing world-creation flow (the architectural decision is recorded in [#174](https://github.com/wulke/premier-league-baseball/issues/174)'s grill-me thread)
- LLD: this file; sibling updates — [`player-identity.md`](../player/player-identity.md) edge e7 (composition now resolved via `homeLeagueId`), [`game-world-templates.md`](./game-world-templates.md) (bundle shape note)
- EARS: [`docs/specs/game-world/team-league-ownership-specs.md`](../../specs/game-world/team-league-ownership-specs.md) — TLO-001..TLO-010; GWT-001/GWT-004 amended for the new bundle shape
- Tests: `test/db/domain/team-league-ownership.test.ts` (TLO-001..TLO-008, TLO-010); fixture adaptations across the suite carry the NOT NULL column
- Code: `src/db/model/team.ts`, `src/db/model/associations.ts` (TLO-001); `src/api/models.ts` (TLO-002, TLO-003); `src/db/domain/game-world.ts` (TLO-004), `src/db/domain/team.ts` (TLO-005, TLO-010), `src/db/domain/league.ts` (TLO-004); `src/ui/pages/home.tsx` (summary derivation)
