# Specs: Real Club Pool & Badge Asset Pipeline

Backend/config requirements for the real 92-club English pyramid pool, the widened Premier League
and League Cup templates, and the offline badge-fetch/build pipeline (`src/api/models.ts`,
`tools/fetch-team-badges.ts`).

| ID | Requirement | Status |
|---|---|---|
| BADGE-001 | WHEN the badge-fetch script runs IF a club `key` has no `TeamBadgeSources` entry THE system SHALL skip that download without writing a file, leaving `/badges/<key>.png` unresolvable until a source is added | [ ] |
| BADGE-002 | WHEN the badge-fetch script downloads a `TeamBadgeSources` URL IF the request fails (network error or non-2xx response) THE system SHALL log a warning and continue downloading the remaining entries, SHALL NOT abort the run | [ ] |
| BADGE-003 | WHEN the badge-fetch script is re-run for a `key` whose file already exists THE system SHALL overwrite it, with no skip-if-exists/dedup check | [ ] |
| BADGE-004 | WHEN `TeamPools['england-92']` is authored THE system SHALL contain no two entries sharing the same `key` | [ ] |
| BADGE-005 | WHEN `LeagueTemplates['league-cup']`'s single division is authored THE system SHALL set `defaultTeams` to all 92 pool indices, and THE existing knockout bye/power-of-2 generation SHALL require no code change to accept a 92-team field | [ ] |
| BADGE-006 | WHEN `LeagueTemplates['premier-league']`'s four divisions are authored THE system SHALL slice `defaultTeams` into four contiguous, non-overlapping ranges covering exactly indices `[0, 92)`, with `isTopTier: true` set on only the first (Premier League) division | [ ] |
| BADGE-007 | WHEN `TeamConfig` is authored THE system SHALL support optional `key: string` and `badge: string` fields, with every other existing `TeamPools` entry (e.g. `europe-32`) compiling unchanged by omitting both | [ ] |
| BADGE-008 | WHEN a `TeamConfig` entry sets `key` THE system SHALL compute its `badge` as the fixed path `/badges/<key>.png`, independent of whether that file has actually been downloaded | [ ] |
| BADGE-009 | WHEN `TeamPools['england-92']` is authored THE system SHALL contain exactly 92 real English club entries ordered Premier League (20) → Championship (24) → League One (24) → League Two (24) | [ ] |
| BADGE-010 | WHEN the badge-fetch script completes a successful download for a `key` THE system SHALL write the image to `src/ui/assets/badges/<key>.<ext>`, committed to the repository | [ ] |
| BADGE-011 | WHEN the app is built (`npm run build`/`build:clean`) THE system SHALL copy `src/ui/assets/badges/` into `dist/ui/badges/` so `express.static(dist/ui)` (`src/app.ts`) serves each badge at its `/badges/<key>.png` URL, with no Parcel asset-import pipeline involved | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

**No Gherkin for this file.** Every `BADGE-*` requirement is a config/data-shape or offline-script
concern with no player-facing flow through `src/api/handlers.ts` — creating a GameWorld already
exercises the same `POST /api/gameWorld/new` path regardless of pool size (proven by the existing
full-season BDD coverage). Per `backend-standards.md` §4 and the `game-world-templates` precedent
(`GWT-*`'s config-surface assertions live in `test/db/domain/game-world-templates.test.ts`, not a
`.feature`), these specs bind to plain unit/config-surface tests at stage 5:
`test/db/domain/team-badges-pyramid.test.ts`.

## Traceability

- HLD: [`docs/high-level-design.md` — Real Team Badges & Full English Pyramid](../../high-level-design.md#hld-real-team-badges--full-english-pyramid)
- LLD: `docs/llds/league/team-badges-pyramid.md`
- Sibling specs: `docs/specs/league/team-badges-ui-specs.md`
- Decision record: conversation-resolved HLD (no wayfinder map)
- Code: `src/api/models.ts` (`TeamConfig`, `TeamBadgeSources`, `TeamPools['england-92']`, `LeagueTemplates['premier-league']`/`['league-cup']`), `tools/fetch-team-badges.ts`, `src/ui/assets/badges/*`, `package.json` build scripts
