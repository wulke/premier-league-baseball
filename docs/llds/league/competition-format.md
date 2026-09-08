# LLD: Competition Format Config (`CompetitionFormat`)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/league/competition-format-specs.md` (`CFG-001`..) ·
> Decision record: [#36 Define a reusable competition/league config pattern](https://github.com/wulke/premier-league-baseball/issues/36)

## Scope

Replaces the current flat `GameFormula[]` array (`src/api/models.ts`) — which conflates leg format,
scoring/series length, structure, and seeding into one undifferentiated list — with a typed
`CompetitionFormat` value and its validated, stage-only League configuration. This LLD covers
*shape and validation only*; round-advancement mechanics (byes, tiebreak algorithms, bracket sizing)
are `docs/llds/league/knockout-bracket.md`'s concern (#33, #43).

## Interface / Data Model

```ts
// src/api/models.ts
type CompetitionFormat = {
  legs: 'ONE_LEG' | 'TWO_LEG';
  winsToAdvance: 'Bo1' | 'Bo3' | 'Bo5';
  tiebreak?: 'AGGREGATE_SCORE' | 'OVERTIME' | 'ANOTHER_GAME_W_OVERTIME'; // concrete values from #33
} & (
  | { structure: 'ROUND_ROBIN' }
  | { structure: 'KNOCKOUT'; seeding: 'FIXED' | 'REDRAW' }
);

const STANDARD_LEAGUE_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN', legs: 'TWO_LEG', winsToAdvance: 'Bo1',
};
const STANDARD_CUP_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'ONE_LEG', winsToAdvance: 'Bo3', seeding: 'REDRAW',
};

interface DivisionConfig {
  name: string;
  defaultTeams: any[];
  format: CompetitionFormat;
  isTopTier?: boolean;         // marks the League champion-producing division
  schedulingConfig?: SchedulingConfig;
}
```

Dropped entirely: the `GameFormula` enum and its bare `AGGREGATE` flag (superseded by `tiebreak`).

### Field semantics

| Field | Values | Notes |
|---|---|---|
| `structure` | `ROUND_ROBIN` \| `KNOCKOUT` | Discriminant. Replaces `gameFormula.includes(GameFormula.KNOCKOUT)`. |
| `legs` | `ONE_LEG` \| `TWO_LEG` | Shared across both structures — a fixture (matchday or tie) can be single- or double-leg. |
| `winsToAdvance` | `Bo1` \| `Bo3` \| `Bo5` | Shared, required. Not yet implemented in domain logic (best-of-N series is future work) but kept as a real field so its place doesn't need bolting on later. |
| `tiebreak` | optional, 3 values | Only meaningful for `TWO_LEG` ties; mechanics resolved in `docs/llds/league/knockout-bracket.md`. |
| `seeding` | `FIXED` \| `REDRAW`, `KNOCKOUT`-only | Type-level restricted to the `KNOCKOUT` branch — a `ROUND_ROBIN` config cannot set it. Replaces the old bare `REDRAW` flag. |
| `isTopTier` | optional boolean | Only meaningful for round-robin Leagues with multiple divisions. `true` marks the division whose decided winner is the League champion and should be written to `SeasonResult`; lower divisions omit it / leave it false. |

`LeagueType` (`League` \| `LeagueCup`) is kept and **not** collapsed into `structure` — they correlate
1:1 today but represent different concerns (identity/display vs. mechanics); see HLD trade-offs.

## Logic Flow

### Validating and materializing a League config

`LeagueConfig` has only `stages: Stage[]`; each division carries its own required `format`.
`validateLeagueConfig(config)` runs once at the beginning of `LeagueFactory.create`, before the
League or any Division is persisted. Creation then flattens `stages[].divisions`, stamps the
enclosing `stageId` and index `stageOrder`, and maps pool indices to team ids.

### Default config migration

`LeagueTemplates` (`src/api/models.ts`) uses a single stage for Premier League and League Cup;
each division references the appropriate named format constant:

```ts
// Premier League + Championship divisions → format: STANDARD_LEAGUE_FORMAT
// League Cup 1st Round division            → format: STANDARD_CUP_FORMAT
```

The top-flight League division and the League Cup division each set `isTopTier: true`, as the sole
champion-producing division in their final (and only) stage.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | A division omits `format` | `validateLeagueConfig` rejects before persistence; no format fallback exists. | CFG-001, CFG-014 |
| e2 | `ROUND_ROBIN` config attempting to set `seeding` | Prevented at the type level (discriminated union) — not a runtime guard. A malformed JSON `config` blob (bypassing TypeScript, e.g. hand-edited DB row) could still smuggle it in; the domain layer should ignore `seeding` when `structure !== 'KNOCKOUT'`. | CFG-002 |
| e3 | `winsToAdvance` set to `Bo3`/`Bo5` today | Accepted and stored, but no domain logic yet generates or scores a multi-game series from it — `legs`/round-advancement logic (`knockout-bracket.md`) currently treats each round's ties as generating exactly the leg count from `legs`, independent of `winsToAdvance`. Series-length-driven game generation is future work. | — |
| e4 | A League with divisions has zero/multiple top tiers, or one outside its final stage | Validation rejects: a non-empty config must identify exactly one final-stage champion producer. A divisionless lifecycle-only config has no champion to produce and is accepted. | CFG-013 |
| e5 | A selector owns a pool, no source, or points forward | Validation requires team-source XOR and a resolvable strictly-prior stage id. | CFG-011, CFG-012 |
| e6 | SWISS consumes a selection, TWO_LEG uses BoN, or TIERED_RANK has no matching Swiss tier | Validation rejects incompatible mechanics or an invalid selector source. | CFG-015, CFG-016, CFG-017 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/league/competition-format.md` |
| EARS | `docs/specs/league/competition-format-specs.md` — `CFG-001`.. |
| Code | `src/api/models.ts` (`CompetitionFormat`, `STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`, `validateLeagueConfig`, `LeagueConfig`, `DivisionConfig`, `LeagueTemplates`) |
| Decision record | [#36](https://github.com/wulke/premier-league-baseball/issues/36) |

---

## Generalized multi-stage extension (#79–#85)

> Upstream decisions: [#78](https://github.com/wulke/premier-league-baseball/issues/78) (map) → #79 (Stage model), #80 (cross-phase seeding), #81 (champion generalization), #82 (Swiss), #83 (best-of-N), #84 (MLB/conferences), #95 (TIERED_RANK), #85 (pressure-test configs + registries). EARS: `CFG-005`..`CFG-010`.

This extension is the sole League-config surface: a single `League` expresses an ordered, dependent sequence of phases (group → knockout; Swiss → knockout; regular season → playoffs). Only old Champions League ever *runs* (#87); new-CL (Swiss) and MLB are **config-surface only**.

### Type surface (as authored in #85)

```ts
// #79 — Stage groups divisions; League.stages[] is the phase sequence.
interface Stage { id: string; name: string; divisions: DivisionConfig[] }

interface LeagueConfig { stages: Stage[]; } // array order = phase sequence

// #82 — third structure arm; league-phase only, no legs/winsToAdvance.
interface SwissTier { id: string; rankRange: [number, number] }   // absolute ranks partitioning the field
type CompetitionFormat =
  | { structure: 'ROUND_ROBIN'; legs; winsToAdvance; tiebreak? }
  | { structure: 'KNOCKOUT'; legs; winsToAdvance; tiebreak?; seeding }
  | { structure: 'SWISS'; gamesPerTeam; qualificationTiers: SwissTier[] };

// #80,#84,#95 — on the *consuming* division; id-references only.
type SeedingSelection =
  | { kind: 'TOP_N_PER_DIVISION'; fromStage; topN }
  | { kind: 'BEST_OF_REST'; fromStage; count; excluding: 'DIVISION_WINNERS'; conference? }
  | { kind: 'TIERED_RANK'; fromStage; tierId };

interface DivisionConfig {
  // ... format (required), isTopTier?, schedulingConfig? ...
  seedingSelection?: SeedingSelection;
  conference?: string;           // #84 producer label (AL/NL) — not a node or Stage
}
```

### Where configs live (#85)

Configs and teams are decoupled from `GameWorldType` into named registries — the seam the future game-world builder needs:

- `LeagueTemplates: Record<string, LeagueConfig>` — all templates (`premier-league`, `league-cup`, `champions-league`, `champions-league-swiss`, `mlb`).
- `TeamPools: Record<string, TeamConfig[]>` — team identity, keyed by name (`england-44`, …).
- `DefaultWorlds: Record<GameWorldType, { leagues: string[] }>` — the *runnable* layer that opts templates into a pickable world. Each template owns its `teams` pool or uses a strictly-prior template's `externalTeams` reference (#283); new-CL + MLB are registry-only (no entry).

### Pressure-test finding

A cross-stage-seeded division owns **no pool allocation** (`defaultTeams: []`) — its teams arrive from another stage's output via `seedingSelection`. The config surface permits this; old-CL's knockout division is the literal proof.

### Config validation (#163)

The pure `validateLeagueConfig(config)` guard is the config-layer boundary. It validates team-source
XOR; ordered unique stage ids and prior selectors; a single final-stage `isTopTier` when divisions exist; required formats;
SWISS selector incompatibility; `TWO_LEG` + `Bo1`; and SWISS-tier-backed `TIERED_RANK` selectors.
There are no runtime config-validity checks: stage sequencing remains the run-path's responsibility.
