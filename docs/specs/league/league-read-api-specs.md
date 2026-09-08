# Specs: League Read API (get + standings)

Code-as-evidence backfill for the two pre-LID League read endpoints:
`GET /api/league/:leagueId` and `GET /api/league/:leagueId/standings`. Written from
observed behavior (`src/api/handlers.ts`, `src/db/domain/league.ts`). The bracket read
is specced via API-001..004 and Today via TODAY-001..007; neither is restated here.

| ID | Requirement | Status |
|---|---|---|
| LRD-001 | WHEN `GET /api/league/:leagueId` is called IF the League exists THE system SHALL return `200` with the League row (raw, unwrapped) including its `Divisions`, each division including its `Teams` | [x] |
| LRD-002 | WHEN `GET /api/league/:leagueId` is called IF no League with that id exists THE system SHALL respond `500` with `{ error: "Invalid League '<id>'" }` (plain `Error`, no `statusCode`) | [x] |
| LRD-003 | WHEN `GET /api/league/:leagueId/standings` is called IF the League exists THE system SHALL return `200` with one entry per Division of shape `{ divisionId, divisionName, standings }`, where `standings` is computed by the owning `DivisionFactory` | [x] |
| LRD-004 | WHEN standings are computed THE system SHALL source the season `year` from the League's parent GameWorld's `year` column and SHALL fall back to `DefaultStandingsConfig` IF the League's `config.standingsConfig` is absent | [x] |
| LRD-005 | WHEN `GET /api/league/:leagueId/standings` is called IF no League with that id exists THE system SHALL respond `500` with `{ error: "Invalid League '<id>'" }` (plain `Error`, no `statusCode`) | [x] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Flags for the EARS gate (behavior recorded as-is; ruling requested)

- **Schema gap discovered by this backfill** — the `DivisionSeasons` *table* carries a
  table-level `UNIQUE (divisionId, teamId)` **without** `year` (an artifact of the
  `Team.belongsToMany(Division, { through: 'DivisionSeason' })` through-FK uniqueness in
  `src/db/model/associations.ts`), alongside the intended composite unique index
  `(divisionId, teamId, year)` declared on the model. At the DB layer this makes a
  second season for the same team in the same division impossible — contradicting
  backend-standards §2, which cites `DivisionSeason` as the canonical year-scoped
  temporal join. It surfaced because the original LRD-004 scenario attached a
  2024-season game to the same division and hit the constraint; the scenario now
  proves year-sourcing by flipping the GameWorld year instead. Ruling: remediate —
  drop the through-table FK uniqueness so the composite year-scoped index is the sole
  constraint → #275 (HITL). **Remediated in #275** — see
  `docs/specs/league/division-season-unique-specs.md` (DSU-001..DSU-004).
- **LRD-002 / LRD-005** — unknown ids surface as **500**, not 404, because
  `LeagueFactory.get()`/`getStandings()` throw plain `Error` rather than
  `DomainError('...', 404)`. This diverges from the sibling League reads
  (API-001 bracket and TODAY-001 today reject with 404) and from backend-standards §3
  (`DomainError` with `statusCode`). Accept as `[x]`, or file as an intent gap and
  normalize to `DomainError` 404 (one-line fix in `league.ts`, cascades to these rows).
- Handler-level `console.debug(league)` leftover — cosmetic; propose removing when
  annotating (step 4), no spec row.

## Traceability

- Code: `src/api/endpoints.ts` (`GetLeague`, `GetLeagueStandings`), `src/api/handlers.ts` (`getLeague`, `getLeagueStandings`), `src/db/domain/league.ts` (`get`, `getStandings`)
- Sibling specs: API-001..004 (bracket), TODAY-001..007 (today) — referenced, not restated
- Gherkin: `test/bdd/features/league-read-api.feature` (`test/bdd/steps/league-read-api.steps.test.ts`)
