# Specs: Team Schedule Read API (calendar)

Code-as-evidence backfill for the pre-LID endpoint
`GET /api/team/:teamId/calendar?gwId=<id>&leagueId=<id?>`. Written from observed
behavior (`src/api/router.ts`, `src/db/domain/team.ts` `getSchedule`). The season-
scoping rows SCL-010/SCL-011 and the bye row CUP-011 already exist and are referenced,
not restated.

| ID | Requirement | Status |
|---|---|---|
| TSCH-001 | WHEN `GET /api/team/:teamId/calendar` is called with a valid `gwId` THE system SHALL return `200` with `{ teamId, teamName, games[] }`, including only Games whose Division belongs to a League of that GameWorld, each game shaped per SCL-011 (with SCL-010 year sourcing) | [x] |
| TSCH-002 | WHEN the optional `leagueId` query parameter is supplied THE system SHALL further narrow the calendar to Divisions of that League only; WHEN absent THE system SHALL merge the team's schedule across all Leagues in the GameWorld (per UI-004) | [x] |
| TSCH-003 | WHEN `gwId` is absent or non-numeric THE system SHALL respond `500` surfacing the raw persistence-layer SQLite failure (the absent query param coerces to `NaN`); WHEN `gwId` or `teamId` names an unknown id THE system SHALL respond `500` with the plain-`Error` messages `GameWorld '<id>' not found` / `Team '<id>' not found` (no `statusCode`) | [x] |
| TSCH-004 | WHEN a calendar Game is a knockout bye (`awayTeam` null) THE system SHALL render the opponent as `Bye` with no scoreline (per CUP-011), and WHEN `round` is set THE system SHALL label KNOCKOUT rounds with their series label and other structures with `Round <n>` | [x] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Flags for the EARS gate (behavior recorded as-is; ruling requested)

- **TSCH-003** — the endpoint is effectively `gwId`-mandatory but enforces it by
  accident (`Number(undefined)` → `NaN` → raw SQLite `no such column: NaN` → **500**),
  and unknown world/team also surface as 500 rather than 404, diverging from `DomainError`
  convention (backend-standards §3) used by ROST-001/PDET-001 reads. Accept as `[x]`,
  or file as an intent gap and normalize to `DomainError` 404 in `team.ts`
  `getSchedule` (cascades to this row).
- UI-side contract (route `/:gwId/team/:teamId/calendar`, loader re-fetch) is already
  specced at UI-004 and RLDRUI-005; no duplication here.

## Traceability

- Code: `src/api/endpoints.ts` (`GetTeamSchedule`), `src/api/router.ts` (query coercion), `src/db/domain/team.ts` (`getSchedule`)
- Upstream: SCL-010, SCL-011 (season scoping/shape), CUP-011 (bye rows), UI-004, RLDRUI-005 (UI contract) — referenced, not restated
- Gherkin: `test/bdd/features/team-schedule-read-api.feature` (`test/bdd/steps/team-schedule-read-api.steps.test.ts`)
