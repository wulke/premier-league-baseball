# LLD: Competition Format Config (`CompetitionFormat`)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/competition-format-specs.md` (`CFG-001`..) ·
> Decision record: [#36 Define a reusable competition/league config pattern](https://github.com/wulke/premier-league-baseball/issues/36)

## Scope

Replaces the current flat `GameFormula[]` array (`src/api/models.ts`) — which conflates leg format,
scoring/series length, structure, and seeding into one undifferentiated list — with a typed
`CompetitionFormat` value, and defines how `LeagueConfig`/`DivisionConfig` resolve it. This LLD covers
*shape and resolution only*; round-advancement mechanics (byes, tiebreak algorithms, bracket sizing)
are `docs/llds/knockout-bracket.md`'s concern (#33, #43).

## Interface / Data Model

```ts
// src/api/models.ts
type CompetitionFormat = {
  legs: 'ONE_LEG' | 'TWO_LEG';
  seriesLength: 'Bo1' | 'Bo3' | 'Bo5';
  tiebreak?: 'AGGREGATE_SCORE' | 'OVERTIME' | 'ANOTHER_GAME_W_OVERTIME'; // concrete values from #33
} & (
  | { structure: 'ROUND_ROBIN' }
  | { structure: 'KNOCKOUT'; seeding: 'FIXED' | 'REDRAW' }
);

const STANDARD_LEAGUE_FORMAT: CompetitionFormat = {
  structure: 'ROUND_ROBIN', legs: 'TWO_LEG', seriesLength: 'Bo1',
};
const STANDARD_CUP_FORMAT: CompetitionFormat = {
  structure: 'KNOCKOUT', legs: 'ONE_LEG', seriesLength: 'Bo3', seeding: 'REDRAW',
};

interface LeagueConfig {
  name: string;
  type: LeagueType;         // unchanged — identity/display, decoupled from `structure`
  format?: CompetitionFormat;
  divisions: DivisionConfig[];
  standingsConfig?: StandingsConfig;
}
interface DivisionConfig {
  name: string;
  defaultTeams: any[];
  format?: CompetitionFormat;  // overrides LeagueConfig.format
  schedulingConfig?: SchedulingConfig;
}
```

Dropped entirely: the `GameFormula` enum and its bare `AGGREGATE` flag (superseded by `tiebreak`).

### Field semantics

| Field | Values | Notes |
|---|---|---|
| `structure` | `ROUND_ROBIN` \| `KNOCKOUT` | Discriminant. Replaces `gameFormula.includes(GameFormula.KNOCKOUT)`. |
| `legs` | `ONE_LEG` \| `TWO_LEG` | Shared across both structures — a fixture (matchday or tie) can be single- or double-leg. |
| `seriesLength` | `Bo1` \| `Bo3` \| `Bo5` | Shared, required. Not yet implemented in domain logic (best-of-N series is future work) but kept as a real field so its place doesn't need bolting on later. |
| `tiebreak` | optional, 3 values | Only meaningful for `TWO_LEG` ties; mechanics resolved in `docs/llds/knockout-bracket.md`. |
| `seeding` | `FIXED` \| `REDRAW`, `KNOCKOUT`-only | Type-level restricted to the `KNOCKOUT` branch — a `ROUND_ROBIN` config cannot set it. Replaces the old bare `REDRAW` flag. |

`LeagueType` (`League` \| `LeagueCup`) is kept and **not** collapsed into `structure` — they correlate
1:1 today but represent different concerns (identity/display vs. mechanics); see HLD trade-offs.

## Logic Flow

### Resolving a division's format

```
resolveFormat(divisionConfig, leagueConfig):
  return divisionConfig.format ?? leagueConfig.format
```

Two-level fallback, unchanged from today's precedent — preserves the League Cup's existing
single-division shorthand (format set once at league level, inherited by its one division) without
forcing every division to repeat itself.

### Default config migration

`DefaultLeagues` (`src/api/models.ts`) moves from hand-authored `gameFormula: [...]` arrays per
division to referencing the two named constants:

```ts
// League (Premier League + Championship divisions) → format: STANDARD_LEAGUE_FORMAT (league-level)
// League Cup (1st Round division)                  → format: STANDARD_CUP_FORMAT (league-level)
```

Both divisions under the League inherit the league-level format (no per-division override needed
today); the League Cup's single division does the same.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Neither `divisionConfig.format` nor `leagueConfig.format` set | `resolveFormat` returns `undefined` — callers (round-advancement, batch simulate) must treat an unresolved format as a domain error, not silently default to round-robin. Not itself guarded by this LLD; flagged for the domain layer that consumes it. | CFG-001 |
| e2 | `ROUND_ROBIN` config attempting to set `seeding` | Prevented at the type level (discriminated union) — not a runtime guard. A malformed JSON `config` blob (bypassing TypeScript, e.g. hand-edited DB row) could still smuggle it in; the domain layer should ignore `seeding` when `structure !== 'KNOCKOUT'`. | CFG-002 |
| e3 | `seriesLength` set to `Bo3`/`Bo5` today | Accepted and stored, but no domain logic yet generates or scores a multi-game series from it — `legs`/round-advancement logic (`knockout-bracket.md`) currently treats each round's ties as generating exactly the leg count from `legs`, independent of `seriesLength`. Series-length-driven game generation is future work. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/competition-format.md` |
| EARS | `docs/specs/competition-format-specs.md` — `CFG-001`.. |
| Code | `src/api/models.ts` (`CompetitionFormat`, `STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`, `resolveCompetitionFormat`, `LeagueConfig`, `DivisionConfig`, `DefaultLeagues`) |
| Decision record | [#36](https://github.com/wulke/premier-league-baseball/issues/36) |
