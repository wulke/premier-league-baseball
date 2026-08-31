# Specs: Game-world templates (pickable old Champions League)

Requirements for making the existing `champions-league` multi-stage template a **pickable, runnable
game world** — the proving slice for [#87](https://github.com/wulke/premier-league-baseball/issues/87)
on [Map #78](https://github.com/wulke/premier-league-baseball/issues/78). The multi-stage run-path
(MSS-001..009), the generalized config surface (CFG-001..017), and the multi-stage render-UI
(MSUI-001..003) are all landed and green; this spec closes the pickability gap so old-CL runs
end-to-end from the UI rather than only from an inline test config.

Config: `src/api/models.ts` (`GameWorldType`, `TeamPools`, `DefaultWorlds`, `useDefaultGameWorld`).
UI: `src/ui/pages/home.tsx`.

| ID | Requirement | Status |
|---|---|---|
| GWT-001 | WHEN a League template is promoted to a runnable game world THE system SHALL declare exactly one `GameWorldType` arm, one `TeamPools` entry sized to the template's largest pool-index set, and one `DefaultWorlds` entry — and SHALL keep `DefaultWorlds` exhaustive over `GameWorldType` so a missing entry fails to compile | [x] → #87 |
| GWT-002 | WHEN the old Champions League bundle is created THE system SHALL accept the existing `champions-league` `LeagueTemplate` (8 group divisions over pool indices `0..31` + one `TOP_N_PER_DIVISION` knockout division) and pass `validateLeagueConfig` (CFG-011..017) before persistence, with no change to the template or the validation | [x] → #87 |
| GWT-003 | WHEN a world is created from the Champions League template and rapid-simulated THE system SHALL exercise the multi-stage run-path (MSS-005 → MSS-006 → MSS-002 → MSS-009) and record exactly one `SeasonResult` on the `isTopTier` knockout division, after which `isSeasonComplete` is true | [x] → #87 |
| GWT-004 | WHEN the home create-world form renders THE system SHALL offer a template selector over the keys of `DefaultWorlds`, and on selection SHALL recompute the bundle (`teams` + `leagues`) via `useDefaultGameWorld(selectedType)` and render a summary derived from that bundle (team count; per-league name and division count) — with no new route or page | [x] → #87 |
| GWT-005 | WHEN the live `premier-league` and `league-cup` templates are authored THE system SHALL declare a `schedulingConfig` on every first-stage Division — `premier-league` (both divisions): `{ startDate: '2025-04-01', intervalDays: 3 }`; `league-cup`: `{ startDate: '2025-05-01', intervalDays: 14 }` — so that `LeagueFactory.start()` seeds the GameWorld `currentDate` per SCL-006, generated Games carry `scheduledDate`s, and the Today/rapid-simulate features are reachable; the cup's later `startDate` SHALL respect SCL-004 under `DefaultWorlds`'s `['premier-league', 'league-cup']` sequential start order, and the 3-day league interval SHALL keep the Today ±3-day window continuously populated | [x] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> This slice adds **no** domain/scheduler behaviour: every step after `create` is an already-green
> MSS/CFG requirement. GWT-003 is the real proving slice (build from the *bundle*, not an inline test
> config) that complements MSS-009's inline-config proof. `europe-32` is a name-only pool symmetric
> with `england-44`; roster realism stays the existing factory's concern. Out of scope (unchanged):
> Swiss scheduler, best-of-N engine, MLB fixture matrix, cross-League qualification, the game-world
> builder (separate map chartered from #85).

## Traceability

- HLD: [`docs/high-level-design.md` — "HLD: Game-world templates (pickable old Champions League)"](../high-level-design.md)
- LLD: [`docs/llds/game-world-templates.md`](../llds/game-world-templates.md)
- Upstream decisions: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87); config seam [#85](https://github.com/wulke/premier-league-baseball/issues/85); run-path `MSS-001..009` ([`multi-stage-season-specs.md`](./multi-stage-season-specs.md)); config shape `CFG-001..017` ([`competition-format-specs.md`](./competition-format-specs.md)); multi-stage render `MSUI-001..003` ([`multi-stage-season-ui-specs.md`](./multi-stage-season-ui-specs.md))
- Gherkin: `test/ui/features/game-world-templates-ui.feature` (GWT-004); backend proving slice is a jest test (no new backend Gherkin — exercises existing endpoints)
- Code: `src/api/models.ts` (GWT-001, GWT-002), `src/ui/pages/home.tsx` (GWT-004), run-path reuse `src/db/domain/*` (GWT-003)
