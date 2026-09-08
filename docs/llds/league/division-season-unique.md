# LLD: DivisionSeason year-scoped uniqueness (constraint remediation)

Addresses #275. `DivisionSeason` is the canonical temporal join (backend-standards §2):
a team's membership in a division is re-asserted every year, so the sole uniqueness
rule is the composite `(divisionId, teamId, year)` declared on the model. The
`belongsToMany` through-table declarations additionally made Sequelize stamp a
table-level `UNIQUE (divisionId, teamId)` **without** `year` into the synced DDL —
an artifact of Sequelize's default through-FK unique key, not an intended constraint.
This LLD covers removing the artifact and migrating pre-existing file-backed databases.

## Interface / Data Model

- `DivisionSeasons` DDL after this change (`db.sync()`):

  ```sql
  CREATE TABLE `DivisionSeasons` (`id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `divisionId` INTEGER NOT NULL REFERENCES `Divisions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    `teamId` INTEGER NOT NULL REFERENCES `Teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    `year` INTEGER NOT NULL, `bracketSlot` INTEGER,
    `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL)
  -- sole uniqueness constraint (declared on the model, unchanged):
  CREATE UNIQUE INDEX `division_seasons_division_id_team_id_year`
    ON `DivisionSeasons` (`divisionId`, `teamId`, `year`)
  ```

- Association change (`src/db/model/associations.ts`): both
  `Team.belongsToMany(Division, …)` / `Division.belongsToMany(Team, …)` pass
  `through: { model: 'DivisionSeason', unique: false }`. Sequelize skips its default
  composite through-FK unique key when `through.unique === false`
  (`BelongsToMany._injectAttributes`), so no table-level constraint is emitted.
  `Division.belongsToMany(Team)`/`Team.belongsToMany(Division)` behavior (getters,
  join queries) is otherwise unchanged — the paired FK columns stay as declared.

- Migration `src/db/migrations/division-season-year-unique.ts`
  (`migrateDivisionSeasonYearUnique(sequelize)`), wired into `src/index.ts` after
  `db.sync()` alongside the existing migrations.

## Logic Flow

Detection (idempotent gate):

1. Read `PRAGMA index_list('DivisionSeasons')`. A table-level `UNIQUE` constraint
   surfaces as a `sqlite_autoindex_*` row with `origin = 'u'` (a `CREATE UNIQUE
   INDEX` shows `origin = 'c'`).
2. For each `origin = 'u'` index, read `PRAGMA index_info(<name>)`. If any has
   exactly the column set `(divisionId, teamId)` — i.e. year-less — the database
   predates this fix and needs the rebuild; otherwise return (no-op).

Rebuild (SQLite cannot `DROP CONSTRAINT`, so the table is rebuilt):

3. `PRAGMA foreign_keys = OFF` — **outside** any transaction (SQLite ignores the
   pragma mid-transaction). With enforcement on, the rebuild's `DROP TABLE`
   implicit-delete would cascade-destroy `DivisionSeasonGames` rows.
4. On the **default connection**, with an explicit `BEGIN IMMEDIATE` … `COMMIT`
   (DDL is transactional in SQLite) — *not* `sequelize.transaction()`: Sequelize's
   sqlite connection manager opens a separate per-transaction connection and
   re-runs `PRAGMA FOREIGN_KEYS=ON` on it, which would silently re-arm the very
   cascade the rebuild must avoid. Plain `sequelize.query` calls (no `transaction`
   option) all land on the shared default connection, where the `OFF` pragma holds.
   a. `DROP TABLE IF EXISTS DivisionSeasons_migrated` (cleans any crashed prior run)
   b. Create the replacement via `queryInterface.createTable('DivisionSeasons_migrated',
      model.tableAttributes)` — sourced from the model itself so the new DDL is
      whatever a fresh `db.sync()` produces, not a hand-copied string that can drift.
   c. Copy rows by explicit column list (`id, divisionId, teamId, year, bracketSlot,
      createdAt, updatedAt`) from `DivisionSeasons`.
   d. `DROP TABLE DivisionSeasons`; `ALTER TABLE DivisionSeasons_migrated RENAME TO
      DivisionSeasons`; `COMMIT` (a failure `ROLLBACK`s and the original table is
      untouched).
5. `CREATE UNIQUE INDEX IF NOT EXISTS division_seasons_division_id_team_id_year ON
   DivisionSeasons (divisionId, teamId, year)` — `DROP TABLE` also dropped the
   table's indexes, so this restores the composite index; a no-op where it survived.
6. `PRAGMA foreign_keys = ON`; `PRAGMA foreign_key_check('DivisionSeasons')` as a
   post-condition (no orphaned rows are expected since only the parent's *schema*
   was rebuilt, never its rows).

## Edge Case Probe

- Migration re-runs / already-migrated DB → detection finds no `origin = 'u'`
  year-less index; migration returns without touching the table.
- Process crash mid-rebuild → the open transaction either committed (done) or rolls
  back when the connection closes, leaving the original table untouched;
  `DROP TABLE IF EXISTS DivisionSeasons_migrated` also cleans any stray backup from
  an interrupted run.
- Per-transaction connection re-enabling FKs (Sequelize sqlite) → avoided by never
  using `sequelize.transaction()` for the rebuild (see Logic Flow step 4).
- `DivisionSeasonGames` rows referencing rebuilt `DivisionSeasons` rows → preserved
  (FK enforcement off during the rebuild; `id`s copied unchanged, so references stay
  valid; verified by post-migration `foreign_key_check`).
- Concurrent second-season rollover for returning teams → same `(divisionId, teamId)`
  with a new `year` inserts cleanly; duplicate `(divisionId, teamId, year)` still
  rejects via the composite index (the constraint contract is unchanged for a single
  year).
- `db.sync()` on an already-migrated DB → `CREATE TABLE IF NOT EXISTS` no-op; the
  index already matches.
- Out of scope: `DivisionSeasonGames`' own belongsToMany artifact
  `UNIQUE (gameId, divisionSeasonId)` — condemned legacy join-table debt,
  remediation chartered separately.
