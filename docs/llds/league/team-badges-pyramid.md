# LLD: Real Club Pool & Badge Asset Pipeline

> Upstream: [HLD: Real Team Badges & Full English Pyramid](../high-level-design.md#hld-real-team-badges--full-english-pyramid) ·
> EARS: `docs/specs/league/team-badges-pyramid-specs.md` (`BADGE-001`..) ·
> Sibling LLD (UI): [`team-badges-ui.md`](./team-badges-ui.md) — call-site wiring + `TeamCrest`

## Scope

Covers the config/data-layer changes in `src/api/models.ts` (`TeamConfig`, the real 92-club pool,
`LeagueTemplates['premier-league']`/`['league-cup']`) and the offline badge-download script. Does
**not** cover DTO/UI changes (badge fields on `TeamStanding`/`TeamSeasonGame`/`TeamSeasonSchedule`,
the `TeamCrest` component, or any page wiring) — that's `team-badges-ui.md`. Does not touch
`champions-league`/`europe-32`, `mlb`, or any other `GameWorldType`/pool — unaffected. Does not
change knockout/bye generation mechanics (`docs/llds/league/knockout-bracket.md`'s concern) — the
League Cup's wider 92-team field is proven to still validate/generate correctly, not re-implemented.

## Interface / Data Model

```ts
// src/api/models.ts
interface TeamConfig {
  name: string;
  key?: string;    // NEW — stable identity slug (e.g. 'arsenal'); optional so `europe-32`/future
                    // pools that don't participate in badges need no change.
  badge?: string;   // NEW — root-relative URL (e.g. '/badges/arsenal.svg'); present only when `key`
                     // is set. Always the deterministic '/badges/<key>.svg' path — existence of the
                     // file on disk is NOT guaranteed (see BADGE-001/002); the UI owns the fallback.
}

// One curated entry per real club — mirrors the curated-pool precedent from player identity
// generation (#142/#143): explicit data over fuzzy auto-discovery.
const TeamBadgeSources: Record<string, string> = {
  'man-city': 'https://upload.wikimedia.org/wikipedia/en/....svg',
  'arsenal':  'https://upload.wikimedia.org/wikipedia/en/....svg',
  // ... one entry per england-92 club key
};

// Pool-authoring helper — mirrors today's `.map((name): TeamConfig => ({ name }))` idiom.
const realTeam = (key: string, name: string): TeamConfig => ({ key, name, badge: `/badges/${key}.svg` });

const TeamPools: Record<string, TeamConfig[]> = {
  // RENAMED from 'england-44' — 92 real clubs, ordered Premier League (0-19),
  // Championship (20-43), League One (44-67), League Two (68-91).
  'england-92': [
    realTeam('man-city', 'Manchester City'),
    // ... 91 more, in tier order
  ],
  'europe-32': [ /* unchanged — name-only, no key/badge */ ],
};
```

### Field semantics

| Field | Notes |
|---|---|
| `key` | Optional on the shared type; always set for `england-92` entries. Must be unique within a pool that sets it — badge filenames collide otherwise (BADGE-004). Not consumed by any domain logic branch (persists into `Team.config` JSON like `name`, no schema/DB change — `backend-standards.md` §2). |
| `badge` | A pure function of `key` (`/badges/${key}.svg`), always populated when `key` is set — **not** conditionally omitted when the file is missing. The file's actual presence is a build/script-time concern; the browser-side `<img>` failure path (UI LLD, `u1`) is what tolerates a missing file, not this field's optionality. |

### `LeagueTemplates` changes

```ts
'premier-league': {
  key: 'premier-league',
  name: GameWorldType.PremierLeague,
  type: LeagueType.League,
  teams: TeamPools['england-92'],
  stages: [{ id: 'regular-season', name: 'Regular Season', divisions: [
    { name: GameWorldType.PremierLeague, defaultTeams: [...Array(92).keys()].slice(0, 20),  format: STANDARD_LEAGUE_FORMAT, schedulingConfig: PL_SCHEDULING, isTopTier: true },
    { name: 'Championship',              defaultTeams: [...Array(92).keys()].slice(20, 44), format: STANDARD_LEAGUE_FORMAT, schedulingConfig: PL_SCHEDULING, isTopTier: false },
    { name: 'League One',                defaultTeams: [...Array(92).keys()].slice(44, 68), format: STANDARD_LEAGUE_FORMAT, schedulingConfig: PL_SCHEDULING, isTopTier: false },
    { name: 'League Two',                defaultTeams: [...Array(92).keys()].slice(68, 92), format: STANDARD_LEAGUE_FORMAT, schedulingConfig: PL_SCHEDULING, isTopTier: false },
  ] }],
},
'league-cup': {
  // unchanged except:
  stages: [{ id: 'cup', name: 'League Cup', divisions: [
    { name: '1st Round', defaultTeams: [...Array(92).keys()], format: STANDARD_CUP_FORMAT, schedulingConfig: LC_SCHEDULING, isTopTier: true },
  ] }],
},
```

### Badge fetch script

```ts
// tools/fetch-team-badges.ts — developer-run offline tool, NOT part of build/CI/tests.
// for each [key, url] in TeamBadgeSources:
//   download url → write src/ui/assets/badges/<key>.<ext inferred from url/content-type>
//   on failure: console.warn and continue (BADGE-002)
// Run manually: `npx ts-node tools/fetch-team-badges.ts`
```

Output committed to the repo (`src/ui/assets/badges/*`). The existing `npm run build`/`build:clean`
gains a copy step (`cp -r src/ui/assets/badges dist/ui/badges`, after the Parcel build) so the
files are served by `express.static(dist/ui)` (`src/app.ts`) at their `/badges/<key>.svg` URLs
with no Parcel asset-pipeline involvement (no bundler `import`, no content hashing) — sidesteps
needing 92 static `import` statements for a dynamically-keyed image.

## Logic Flow

```
Developer (one-time, or whenever a source URL needs updating):
  npx ts-node tools/fetch-team-badges.ts
    → for each TeamBadgeSources entry: download → src/ui/assets/badges/<key>.svg   # BADGE-002
    → missing source entries for a key are simply never attempted                     # BADGE-001
  git add src/ui/assets/badges && commit

Build (npm run build):
  parcel build src/ui/index.html → dist/ui/
  cp -r src/ui/assets/badges dist/ui/badges
  tsc

Runtime (unchanged domain path):
  GameWorldFactory().create()
    → LeagueFactory().createContainer(gw, config)
    → TeamFactory × 92 (persists TeamConfig incl. key/badge verbatim into Team.config JSON)
    → LeagueFactory(id).createDivisions(config, 92 teamIdRefs)   # 4 PL divisions + widened Cup
        → validateLeagueConfig(config)   # unchanged — CFG-011..017, no new rule needed
```

### Key decisions embedded in this flow

- **`badge` is a computed, always-present path, not a conditionally-absent field.** Pushing the
  "does this file actually exist" question to the browser (`<img onError>`, UI LLD) means the
  script's partial success/failure never has to be reconciled back into `models.ts` — no codegen,
  no risk of the source-of-truth data and the downloaded-asset state drifting apart.
- **Static file copy, not a Parcel asset import.** 92 dynamically-keyed images don't fit Parcel's
  static-import model without generating 92 import statements; treating `src/ui/assets/badges/`
  as plain files copied verbatim into the already-`express.static`-served `dist/ui/` avoids that
  entirely, at the cost of the files not being content-hashed/cache-busted (acceptable — badges
  change rarely, and a personal project has no CDN-cache-invalidation concern).
- **`key`/`badge` optional on the shared `TeamConfig`, not required.** Keeps `europe-32` (and any
  future pool) compiling unchanged — per the HLD's explicit out-of-scope boundary, no other pool
  is touched by this feature.
- **Badge extension is hardcoded to `.svg`, not inferred per-file.** Found in review: an earlier
  revision computed `badge` as `/badges/<key>.png` while the fetch script inferred each file's
  extension from its source URL — every `TeamBadgeSources` entry is a Wikimedia `.svg`, so every
  written file was `<key>.svg`, silently mismatching the `.png` path every `<img>` requested (100%
  fallback-to-initials, undetected because the JSDOM UI tests mock `fetch` and never load a real
  `<img>`). Fixed by hardcoding `.svg` on both sides — `badge` computes `/badges/<key>.svg`, and
  the script now asserts every source URL ends in `.svg` before downloading (skips + warns
  otherwise) rather than trusting a per-file inferred extension. A `test/db/domain` assertion pins
  this invariant so it can't silently regress again.
- **Club crest copyright/trademark is a consciously accepted risk, not an oversight.** Club
  badges are typically registered trademarks; Wikipedia's non-free-use rationale for hosting them
  does not extend to redistributing them in a separate application. This repo is a personal,
  non-commercial hobby project — the user made this call explicitly (see the HLD's originating
  conversation) — so it's accepted as-is rather than pursued further (e.g. licensed/generic crests).
  Revisit if this project's distribution posture ever changes.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | A club `key` has no `TeamBadgeSources` entry | Script never attempts that download; `badge` still resolves to `/badges/<key>.svg` at read-time, which simply 404s in the browser (UI fallback owns recovery). | BADGE-001 |
| e2 | A `TeamBadgeSources` URL fetch fails (network error, 4xx/5xx) | Script logs a warning and continues the remaining downloads — one bad source never aborts the batch. | BADGE-002 |
| e3 | The script is re-run (e.g. a source URL was fixed) | Overwrites the existing file at the same path; no skip-if-exists/dedup logic — always idempotent to re-run. | BADGE-003 |
| e4 | Two `england-92` entries share a `key` | Badge filenames collide (last write wins) and downstream badge lookups become ambiguous; a unit test asserts `TeamPools['england-92'].map(t => t.key)` has no duplicates. | BADGE-004 |
| e5 | League Cup's `defaultTeams` widens from 44 to 92 | No change to knockout/bye generation code — it already reduces N teams to the next-lower power of 2 with front-loaded byes (`docs/llds/league/knockout-bracket.md`); a config-surface test asserts the division's `defaultTeams.length === 92`. | BADGE-005 |
| e6 | The 4 Premier League division slices must exactly partition the 92-team pool | A config-surface test asserts the four `defaultTeams` slices are contiguous, non-overlapping, and cover `[0, 92)`, and that only the first (index 0) division sets `isTopTier: true`. | BADGE-006 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-real-team-badges--full-english-pyramid) |
| **This LLD** | `docs/llds/league/team-badges-pyramid.md` |
| Sibling LLD | `docs/llds/league/team-badges-ui.md` (UI) |
| EARS | `docs/specs/league/team-badges-pyramid-specs.md` — `BADGE-001`..`BADGE-006` |
| Code | `src/api/models.ts` (`TeamConfig`, `TeamBadgeSources`, `TeamPools['england-92']`, `LeagueTemplates['premier-league']`/`['league-cup']`), `tools/fetch-team-badges.ts` (NEW), `src/ui/assets/badges/*` (NEW, committed output), `package.json` build scripts |
| Decision record | Conversation-resolved HLD (no wayfinder map) |
