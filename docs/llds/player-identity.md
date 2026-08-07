# LLD: Player Identity Model & Generation

> Upstream: [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility) ·
> EARS: `docs/specs/player-identity-specs.md` (`PID-001`..) ·
> Decision record: [#141 Player identity model & field set](https://github.com/wulke/premier-league-baseball/issues/141), [#142 Name/country generation approaches](https://github.com/wulke/premier-league-baseball/issues/142), [#143 Identity generation](https://github.com/wulke/premier-league-baseball/issues/143)

## Scope

Adds six typed identity columns to the `Player` model (`givenName`, `familyName`, `countryCode`, `bats`, `throws`, `birthDate`) and extends `PlayerFactory.generateRoster()` to populate them with generated human identity. `attributes` stays ratings-only (the #59 split). Depends on the `Player`/`Contract` schema from [HLD: Players…](../high-level-design.md#hld-players-attributes-stats--contracts) and the `Contract` DATE migration in [`player-detail-read-api.md`](./player-detail-read-api.md) (generation writes the new `startDate`/`endDate`). Does **not** cover roster read APIs (`roster-read-api.md`), player detail (`player-detail-read-api.md`), or any UI.

## Interface / Data Model

```ts
// src/db/model/player.ts — six new typed columns, all allowNull:false (independent of teamId)
interface Player {
  id: number;
  teamId: number | null;      // unchanged — denormalized cache (Contract is source-of-truth)
  gameWorldId: number;        // unchanged
  attributes: PlayerAttributes; // unchanged — ratings-only JSON (PATTR split preserved)
  // NEW identity columns:
  givenName: string;          // allowNull:false
  familyName: string;         // allowNull:false
  countryCode: string;        // allowNull:false — ISO 3166-1 alpha-2
  bats: 'R' | 'L' | 'S';      // allowNull:false
  throws: 'R' | 'L';           // allowNull:false
  birthDate: Date;             // allowNull:false — the aging-immune seed (NOT a stored age)
}
```

### Identity generation (co-located module, not a Factory)

Per `backend-standards.md` §1 ("when a Factory is too fat"), the curated pools + picking logic live in a **co-located plain module** `src/db/domain/identity.ts` (owns no model — pure data + pure functions), consumed by `PlayerFactory.generateRoster()`:

```ts
// src/db/domain/identity.ts
// Curated static name arrays per ~8–10 baseball countries (no @faker-js/faker dep).
// A weight-less country registry + named per-league compositions, so the same
// generator serves any league — weights are a league property, not a global constant.
type CountryCode = 'US' | 'DO' | 'VE' | 'PR' | 'CU' | 'JP' | 'KR' | 'MX' | 'BR' | 'TW';
type LeagueComposition = Record<CountryCode, number>; // weight-less registry; composition is named per league

export const POOLS: Record<CountryCode, { givenNames: string[]; familyNames: string[] }>;
export const LEAGUE_COMPOSITIONS: Record<string, LeagueComposition>; // e.g. PREMIER_LEAGUE / KBO / NPB
export function generateIdentity(composition: LeagueComposition, rng: () => number, gameWorldYear?: number): PlayerIdentity;
// PlayerIdentity = { givenName, familyName, countryCode, bats, throws, birthDate }
```

## Logic Flow

### Identity generation, step by step (extends `generateRoster`)

```
generateRoster(teamId, gwId, { seed?, ...options }):
  ...existing headcount/slot/attribute logic (PATTR) unchanged...

  composition = LEAGUE_COMPOSITIONS[league.config.compositionKey] ?? LEAGUE_COMPOSITIONS.PREMIER_LEAGUE
  rng = mulberry32(seed ?? <per-call seed>)       // seeded → reproducible rosters (#143)

  for each player slot:
    attributes = generatePlayerAttributes()       // unchanged (ratings only)
    identity   = generateIdentity(composition, rng):
                   country = pick weighted entry from composition's country registry
                   givenName  = draw from POOLS[country].givenNames
                   familyName = draw from POOLS[country].familyNames
                   bats  = weightedRandom({ R: .70, L: .25, S: .05 })   // independent of country
                   throws = weightedRandom({ R: .75, L: .25 })           // independent of country/bats
                   birthDate = randomDate(ageBand: 18..38, relativeTo gameWorldYear) # PID-004
    Player.create({ teamId, gameWorldId, attributes, ...identity })

  for each player:                                 // Contract write — now uses DATE columns
    Contract.create({ playerId, teamId,
                      startDate: <year-03-01>, endDate: <year-10-31> })  # see player-detail-read-api.md
```

### Key decisions embedded in this flow

- **Country first, then name** — pick `countryCode` from the league composition, then draw the name from that country's curated pool. `bats`/`throws` are independent of country and of each other (MLB-like distribution; faker has no handedness module, hence no faker).
- **`birthDate`, not `age`** — the stored seed is a date; `age` is derived at read-time (`player-detail-read-api.md`), so it never drifts as seasons advance. Age band 18–38 is a generation-time tunable.
- **Seeded mulberry32 RNG** — a single seed per `generateRoster` call makes a roster reproducible. Tunables (weights/pool sizes/age band) deferred to implementation.
- **Per-league composition via `League.config`** — the composition key (`PREMIER_LEAGUE`/`KBO`/`NPB`) is a league property, so one generator serves any league.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | A country's curated pool is empty or undersized | Treated as a data-authoring bug, not a runtime case — pools are curated to be non-empty at write time. No runtime fallback to a default country; a short pool just increases repeat-name probability. | PID-001 |
| e2 | `League.config.compositionKey` missing or unrecognized | Falls back to `PREMIER_LEAGUE` composition (documented default), rather than failing Team creation. | PID-002 |
| e3 | All identity columns `allowNull:false` on a `dev.sqlite` with pre-existing identity-less Players | Obviated — #141 closed #144 out of scope: the dev DB holds no data worth preserving and is dropped & recreated, so `generateRoster()` produces fully-populated Players from the start. No backfill path. | PID-003 |
| e4 | `birthDate` outside the 18–38 band | Cannot occur — generation clamps to the band. A future manual-edit path (out of scope, → #140 writes) is the only way to produce an out-of-band date. | PID-004 |
| e5 | Two players on one roster draw the same name | Allowed — name collisions are realistic and not guarded against; `id` is the identity, not the name. | — |
| e6 | Seeded RNG determinism vs concurrent `generateRoster` calls | One seed per call, consumed sequentially within it; no cross-call coupling. Reproducibility is per-call given the same seed, not global. | PID-005 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-team-roster--player-visibility) |
| **This LLD** | `docs/llds/player-identity.md` |
| Sibling LLD | `docs/llds/player-detail-read-api.md` (Contract DATE migration consumed here) |
| EARS | `docs/specs/player-identity-specs.md` — `PID-001`.. |
| Code | `src/db/model/player.ts` (6 columns), `src/db/domain/identity.ts` (pools + `generateIdentity`), `src/db/domain/player.ts` (`generateRoster` extension) |
| Decision record | [#141](https://github.com/wulke/premier-league-baseball/issues/141), [#142](https://github.com/wulke/premier-league-baseball/issues/142), [#143](https://github.com/wulke/premier-league-baseball/issues/143) |
