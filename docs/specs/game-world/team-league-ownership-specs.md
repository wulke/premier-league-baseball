# Specs: Per-League team ownership & unambiguous identity composition

Requirements for making a Team's identity composition structurally owned — [#283](https://github.com/wulke/premier-league-baseball/issues/283),
the implementation slice of [#174](https://github.com/wulke/premier-league-baseball/issues/174) ("Decide player identity composition for
multi-parent-league worlds"; design reached via that issue's `/grill-me` thread). Replaces the interim "first configured League"
policy (`PID-010` as landed in #168) with a durable Home-League association.

Config: `src/api/models.ts` (`LeagueConfig`, `NewGameWorld`, `LeagueTemplates`, `DefaultWorlds`, `validateNewGameWorld`).
Schema: `src/db/model/team.ts`, `src/db/model/associations.ts`. Creation flow: `src/db/domain/game-world.ts`, `src/db/domain/team.ts`, `src/db/domain/league.ts`.

| ID | Requirement | Status |
|---|---|---|
| TLO-001 | WHEN a Team is created THE system SHALL persist a `homeLeagueId` FK — `allowNull:false`, referencing `League` — naming the League whose config produced that Team, and SHALL reject a `homeLeagueId` that names a League of another GameWorld | [x] → #283 |
| TLO-002 | WHEN a GameWorld is created THE system SHALL source every League's Teams from that League's own `LeagueConfig.teams` pool — `NewGameWorld.teams` SHALL NOT exist, and division `defaultTeams` indices SHALL resolve against the owning (or external source) League's pool | [x] → #283 |
| TLO-003 | WHEN a League declares its team source THE system SHALL require exactly one of `teams` (non-empty) or `externalTeams`, and IF `externalTeams` is declared THE system SHALL require it to name, via `key`, a League declared at a strictly smaller index in `leagues[]` (unique keys) — evaluated before any row is written, so Leagues create in plain array order with no dependency resolution | [x] → #283 |
| TLO-004 | WHEN `GameWorldFactory.create` runs THE system SHALL create all Leagues as empty containers first, then each League's Teams in `leagues[]` order (populating `homeLeagueId`; an `externalTeams` League pulls the source's already-created Teams instead of creating rows), then Divisions for all Leagues | [x] → #283 |
| TLO-005 | WHEN a Team's roster is generated THE system SHALL resolve the country composition and match rules by joining `Team.homeLeagueId → League.config` (`compositionKey`/`matchRules`) and SHALL NOT read `leagues[0]` or any other arbitrary League row, nor duplicate `compositionKey` onto `Team` | [x] → #283 |
| TLO-006 | WHEN a GameWorld declares two independent parent Leagues with disjoint team pools and different `compositionKey`s THE system SHALL assign each Team's roster composition deterministically from that Team's own Home League | [x] → #283 |
| TLO-007 | WHEN a secondary competition (e.g. `league-cup`) declares `externalTeams` THE system SHALL bind it to the source League's exact Team rows (no duplicate Teams), and those Teams' `homeLeagueId` SHALL still name the source League — identity composition is unaffected by secondary-competition participation | [x] → #283 |
| TLO-008 | WHEN the default `PremierLeague` GameWorld (`premier-league` + `league-cup`) is created through the existing create API THE system SHALL persist 2 Leagues, 44 Teams (44 from `premier-league`'s pool, 0 new from the cup), all with `homeLeagueId` naming the `premier-league` League | [x] → #283 |
| TLO-009 | WHEN the NOT NULL `homeLeagueId` column is added THE system SHALL NOT provide a backfill path for legacy `dev.sqlite` Teams — the dev database is regenerated (deleted, recreated on next `npm run start`), matching PID-003's posture | [D] → #283 |
| TLO-010 | WHEN a GameWorld declares independent parent Leagues with distinct `matchRules` THE system SHALL generate each Team's active Lineup from its own Home League's resolved rules, regardless of `leagues[]` order, while Division-level overrides retain their existing precedence | [x] → #284 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> `TLO-009` is Deferred-by-posture (like `PID-003`): it records the migration decision — regenerate, never backfill — not a behavior
> to implement. Home ownership cannot be reconstructed for Teams created under the old first-League policy, so no migration exists.
> Registry-only pressure-test templates (`mlb`, `champions-league-swiss`) declare no team source and never enter a `NewGameWorld`
> payload, so they are untouched by TLO-003 (LLD edge e10).

## Traceability

- HLD: [`docs/high-level-design.md`](../../high-level-design.md) — unchanged (ownership decision recorded in [#174](https://github.com/wulke/premier-league-baseball/issues/174))
- LLD: [`docs/llds/game-world/team-league-ownership.md`](../../llds/game-world/team-league-ownership.md); sibling updates: [`player-identity.md`](../../llds/player/player-identity.md) (e7), [`game-world-templates.md`](../../llds/game-world/game-world-templates.md) (bundle shape)
- Supersedes: the interim `leagues[0]` policy of `PID-010` (#168) — PID-010's "resolve from `League.config.compositionKey`" still holds; *which* League is now structural (the Home League)
- Tests: `test/db/domain/team-league-ownership.test.ts` (TLO-001..TLO-008, TLO-010); API-flow proof via `test/bdd/features/game-world-api.feature` (GWA-003); UI summary via `test/ui/features/game-world-templates-ui.feature` (GWT-004)
- Code: `src/db/model/team.ts`, `src/db/model/associations.ts` (TLO-001); `src/api/models.ts` (TLO-002, TLO-003); `src/db/domain/game-world.ts` (TLO-004); `src/db/domain/team.ts` (TLO-001, TLO-005, TLO-010); `src/db/domain/league.ts` (TLO-004); `src/ui/pages/home.tsx` (GWT-004 summary)
