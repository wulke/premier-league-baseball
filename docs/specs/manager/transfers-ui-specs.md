# Specs: Transfers UI

Frontend requirements for the world-scoped Transfers page and the Release/Renew roster-row actions
(`src/ui/pages/transfers.tsx`, `src/ui/pages/team-roster.tsx`, `src/ui/components/nav-rail.tsx`,
`src/ui/routes.tsx`), consuming `GET /api/gameWorld/:gwId/free-agents` and
`POST /api/team/:teamId/transfers/{sign,release,renew}`.

| ID | Requirement | Status |
|---|---|---|
| XFERUI-001 | WHEN a user with a claimed managed club clicks "Transfers" in the nav rail THE system SHALL navigate to `/:gwId/transfers` | [x] → #237 |
| XFERUI-002 | WHEN the Transfers page mounts THE system SHALL fetch `GET /api/gameWorld/:gwId/free-agents` and render the result as a flat table, showing an empty table (no error UI) when the response is empty or the request fails | [x] → #237 |
| XFERUI-003 | WHEN a Sign action succeeds THE system SHALL refetch the free-agent list so the signed player's row no longer appears, without a full page reload | [x] → #237 |
| XFERUI-004 | WHEN a Sign action is rejected with `422` (the player is no longer a free agent) THE system SHALL show an inline "no longer available" message and refetch the free-agent list | [x] → #237 |
| XFERUI-005 | WHEN the viewed team's roster IS the managed club THE system SHALL render Release and Renew actions on each roster row, and SHALL refetch the team roster after either action succeeds; WHEN the viewed team is NOT the managed club THE system SHALL render the roster table with no action column | [x] → #237 |
| XFERUI-006 | WHEN no club is managed THE system SHALL keep the nav rail's "Transfers" entry in the dimmed fog trio rather than linking it, even though a direct visit to `/:gwId/transfers` still renders the read-only free-agent market | [x] → #237 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: `docs/high-level-design.md` — no dedicated HLD section exists yet for Transfers; [#237](https://github.com/wulke/premier-league-baseball/issues/237)'s resolved grill-me decision record stands in for it.
- LLD: `docs/llds/manager/transfers-ui.md`
- Backend sibling specs: `docs/specs/player/contract-lifecycle-specs.md`
- Sibling UI specs: `docs/specs/manager/team-roster-ui-specs.md` (release/renew rows amend this), `docs/specs/manager/managed-club-ui-specs.md` (nav-rail fog trio amended)
- Decision record: [#140](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237)
- Code: `src/ui/pages/transfers.tsx` (new), `src/ui/pages/team-roster.tsx` (release/renew actions), `src/ui/components/nav-rail.tsx` (Transfers link), `src/ui/routes.tsx`, `src/api/endpoints.ts` (`GetFreeAgents`, `SignPlayer`, `ReleasePlayer`, `RenewPlayer`)
