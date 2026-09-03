# LLD: Game-world templates (pickable old Champions League)

> Residual proving-slice work for [#87](https://github.com/wulke/premier-league-baseball/issues/87) on [Map #78](https://github.com/wulke/premier-league-baseball/issues/78). The multi-stage run-path, the generalized config surface, and the multi-stage *render* UI are all landed (#164 / #163 / #162). The one gap: old-CL is proven only by an **inline** config in a unit test — it is not a world a user can create and watch crown a champion. This LLD closes that by making the existing `champions-league` template a **pickable DefaultWorld** end-to-end. The map carries execution; this slice reuses only decided seams (#85 registry, #80 seeding, MSS run-path).

## Goal / scope

Make the old Champions League **runnable end-to-end from the UI**: a user picks the "Champions League" template on the home create-world form → a world with 32 teams + one multi-stage league is created → rapid-simulate progresses the 8 round-robin groups → cross-phase `TOP_N_PER_DIVISION` seeds a two-leg knockout → exactly one champion is recorded. No new routes, pages, scheduler, or series engine.

**In scope:** one `europe-32` team pool (32 stub teams); one new `GameWorldType` arm + one `DefaultWorlds` entry; a template `<select>` on the existing create-world form with a dynamic summary. **Out of scope (unchanged):** Swiss scheduler; best-of-N engine; MLB fixture matrix; cross-League qualification; the general game-world builder (separate map, chartered from #85).

## Interface / data model

All in `src/api/models.ts` — purely additive.

```ts
// 1. one new runnable identity (the *runnable* worlds — registry-only archetypes have none)
enum GameWorldType {
  PremierLeague = 'Premier League',
  ChampionsLeague = 'Champions League',     // NEW (#87 pickability)
};

// 2. one new 32-team pool — symmetric with 'england-44'
const TeamPools: Record<string, TeamConfig[]> = {
  'england-44': [ /* unchanged: 44 teams */ ],
  'europe-32': [ /* NEW: 32 stub European club names, { name } only */ ],
};

// 3. one new runnable bundle. Record<GameWorldType,…> is exhaustive, so the
//    enum arm above FORCES this entry at compile time — a missing entry is a
//    type error, not a runtime hole.
const DefaultWorlds: Record<GameWorldType, { teamPool: string; leagues: string[] }> = {
  [GameWorldType.PremierLeague]:   { teamPool: 'england-44', leagues: ['premier-league', 'league-cup'] },
  [GameWorldType.ChampionsLeague]: { teamPool: 'europe-32',  leagues: ['champions-league'] },   // NEW
};
```

`useDefaultGameWorld(GameWorldType.ChampionsLeague)` then yields the pickable bundle unchanged in shape: `{ name, leagues: [champions-league template], teams: 32 europe-32 teams, year }`. The `champions-league` `LeagueTemplate` (8 group divisions referencing pool indices `0..31` + one `TOP_N_PER_DIVISION` knockout division) is already authored (#85) and already passes `validateLeagueConfig` (CFG-011: each division declares exactly one team source; CFG-013: exactly one final-stage `isTopTier`).

### UI — `src/ui/pages/home.tsx` (minimal, no new route/page)

The create-world form gains a **template selector** that drives the bundle:

- A `<select>` listing the keys of `DefaultWorlds` (the pickable templates). Default selection = `PremierLeague` (unchanged behaviour).
- On change → recompute the bundle via `useDefaultGameWorld(selectedType)` and set it as the form payload (`teams` + `leagues`); pre-fill the free-text **Name** field with the template's display name (as today).
- The static "Template: Premier League / 44 teams / Premier League — 2 divisions" summary block becomes **dynamic** — derived from the selected bundle (`teams.length`; `leagues[].name` + per-league division count).
- Submit is unchanged: `POST /api/gameWorld/new` with the selected bundle.

## Logic flow

```
home form: user selects "Champions League" template
  → useDefaultGameWorld(ChampionsLeague) → { 32 teams, [champions-league] }
  → POST /api/gameWorld/new (payload = bundle + typed name)
  → GameWorldFactory().create(config)
      → TeamFactory × 32 (europe-32)
      → LeagueFactory().create(gw, champions-league config, 32 teamIdRefs)
          → validateLeagueConfig(config)            // CFG-011..017, already wired
          → stamp stageId/stageOrder on divisions   // MSS-004, already wired
  → navigate /:gwId
user runs rapid-simulate (existing path)
  → MSS-005 first-stage groups only → MSS-006 group completion fires dependent KO
  → MSS-002 TOP_N_PER_DIVISION seeds 16 → MSS-009 two-leg KO → MSS-008 one champion
```

No domain/scheduler code changes — every step after `create` is an already-implemented MSS/CFG requirement. This slice *exercises* them via the real pickable bundle rather than an inline test config.

## Edge case probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | New `GameWorldType.ChampionsLeague` arm added without a `DefaultWorlds` entry | `Record<GameWorldType,…>` exhaustiveness → **compile-time error**. The enum arm forces its bundle entry. | GWT-001 |
| e2 | `europe-32` pool authored with ≠32 teams (group divisions reference indices `0..31`) | Config-surface test asserts `TeamPools['europe-32'].length === 32`; a short pool would surface as `undefined` teams at creation (caught downstream by TeamFactory). | GWT-001 |
| e3 | The `champions-league` template regresses to an invalid multi-stage config | `validateLeagueConfig` runs at `LeagueFactory.create` (CFG-011..017) and rejects before persistence; the bundle-validation test fails fast. | GWT-002 |
| e4 | Rapid-sim of the real old-CL bundle fails to reach one champion | End-to-end test (build world from `useDefaultGameWorld(ChampionsLeague)` → rapid-sim) asserts exactly one `SeasonResult` on the knockout division + `isSeasonComplete`. Run-path mechanics are MSS-005..009 (already green); this proves the *bundle* exercises them. | GWT-003 |
| e5 | A registry-only archetype (new-CL/MLB) is mistakenly added to `DefaultWorlds` | Out of scope to enforce statically here (their `LeagueType`/templates exist by design); the pickability test enumerates `DefaultWorlds` keys and asserts only the two runnable worlds (`PremierLeague`, `ChampionsLeague`) are present. | GWT-001 |
| e6 | UI: switching template leaves a stale bundle / summary | Template `<select>` is the single source of the selected type; the summary + payload derive from `useDefaultGameWorld(type)` in one place. | GWT-004 |
| e7 | UI: a future template lacks a sensible display name | `GameWorldType` string value **is** the display name (e.g. `'Champions League'`); summary renders `teams.length` and league names from the bundle — no extra metadata table needed. | GWT-004 |

## Traceability

- HLD: [`docs/high-level-design.md`](../high-level-design.md) — competition-config + full-season simulation
- Upstream decisions: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87); config seam from [#85](https://github.com/wulke/premier-league-baseball/issues/85); run-path from MSS-001..009 ([`multi-stage-season-specs.md`](./multi-stage-season-specs.md)); config shape from CFG-001..017 ([`competition-format-specs.md`](./competition-format-specs.md))
- EARS: `docs/specs/game-world/game-world-templates-specs.md` (GWT-001..004, this slice)
- Gherkin: `test/ui/features/game-world-templates-ui.feature` (UI pickability); backend assertion is a jest unit test (no new backend Gherkin — exercises existing endpoints)
- Code: `src/api/models.ts` (enum + pool + `DefaultWorlds`), `src/ui/pages/home.tsx` (template selector + dynamic summary), `test/db/domain/game-world-templates.test.ts`, `test/ui/steps/game-world-templates-ui.steps.test.tsx`
