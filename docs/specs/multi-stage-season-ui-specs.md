# Specs: Multi-stage season UI surfacing

Frontend requirements for surfacing the old Champions League proving slice on the existing
League and GameWorld screens. No new routes or pages are introduced.

| ID | Requirement | Status |
|---|---|---|
| MSUI-001 | WHEN a multi-stage League has round-robin group divisions with standings THE League page SHALL render each group with the existing standings table on the existing League route | [ ] → #162 |
| MSUI-002 | WHEN a `TOP_N_PER_DIVISION` knockout division is present THE League page SHALL render its existing bracket and identify it as seeded from the completed source group stage, including when the bracket is pending | [ ] → #162 |
| MSUI-003 | WHEN the multi-stage knockout division marked `isTopTier` has a champion THE existing League champion banner and GameWorld season-complete summary SHALL use that knockout champion | [ ] → #162 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/multi-stage-season-ui.md`
- Gherkin: `test/ui/features/multi-stage-season-ui.feature`
- Steps: `test/ui/steps/multi-stage-season-ui.steps.test.tsx`
- Code: `src/ui/pages/league.tsx`, `src/ui/champion.ts`
