# Specs: DivisionSeason year-scoped uniqueness

Backfill/remediation for #275. `DivisionSeason` is the canonical temporal join
(backend-standards §2): a team's membership in a division is re-asserted each year,
so uniqueness is the composite `(divisionId, teamId, year)` — no year-less
`(divisionId, teamId)` constraint may exist at the table level. Discovered during the
legacy-API spec backfill (flag in `docs/specs/league/league-read-api-specs.md`);
ruling: remediate.

| ID | Requirement | Status |
|---|---|---|
| DSU-001 | WHEN the database schema is synced THE system SHALL enforce `DivisionSeason` uniqueness solely via the composite unique index `(divisionId, teamId, year)` and SHALL NOT emit a table-level `UNIQUE (divisionId, teamId)` without `year` | [x] → #275 |
| DSU-002 | WHEN a team's membership in a division is re-asserted for a different year THE system SHALL persist a distinct `DivisionSeason` row for each `(divisionId, teamId, year)` | [x] → #275 |
| DSU-003 | WHEN a division season completes and `newSeason` runs again for the same teams in the same division THE system SHALL create the next-year `DivisionSeason` rows without a unique-constraint error | [x] → #275 |
| DSU-004 | WHEN a pre-existing database whose `DivisionSeasons` table carries the year-less table-level `UNIQUE (divisionId, teamId)` is migrated THE system SHALL rebuild the table preserving all rows and linked `DivisionSeasonGames` so the composite index is the sole uniqueness constraint | [x] → #275 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/league/division-season-unique.md`
- Code: `src/db/model/associations.ts` (belongsToMany `through.unique: false`),
  `src/db/migrations/division-season-year-unique.ts` (table rebuild),
  `src/index.ts` (migration wiring)
- Tests: `test/db/domain/division-season-unique.test.ts` (DSU-001..DSU-003),
  `test/db/migrations/division-season-year-unique.test.ts` (DSU-004)
