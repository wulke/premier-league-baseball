# Specs: Team Crest Rendering

Frontend requirements for the shared `TeamCrest` component and its wiring at the four existing
team-identity surfaces (`src/ui/components/team-crest.tsx`, `src/ui/pages/league.tsx`,
`src/ui/pages/team-calendar.tsx`, `src/ui/components/calendar-strip.tsx`).

| ID | Requirement | Status |
|---|---|---|
| BADGEUI-001 | WHEN `TeamCrest` renders an `<img>` for a given `badge` IF that image fails to load (`onError`) THE UI SHALL swap to the initials fallback, SHALL NOT show a broken-image icon | [ ] |
| BADGEUI-002 | WHEN `TeamCrest` is given a `badge` of `undefined`/`null` THE UI SHALL render the initials fallback directly, SHALL NOT attempt an `<img>` element | [ ] |
| BADGEUI-003 | WHEN `TeamCrest` computes initials for the `'Bye'` sentinel team name THE UI SHALL render `'B'`, with no bye-specific special-casing | [ ] |
| BADGEUI-004 | WHEN `teamBadgeText`'s initials algorithm is relocated into `TeamCrest` THE system SHALL preserve its exact computation, so existing calendar-strip Gherkin scenarios asserting initials text SHALL continue passing unmodified | [ ] |
| BADGEUI-005 | WHEN `TeamStanding`, `TeamSeasonGame`, or `TeamSeasonSchedule` are constructed THE system SHALL include a badge field (`teamBadge`, `homeTeamBadge`/`awayTeamBadge`, `teamBadge` respectively) sourced from the same team lookup already used for the existing name field(s), with no additional database query | [ ] |
| BADGEUI-006 | WHEN a team identity renders as a League standings table row THE UI SHALL render `TeamCrest` alongside the team name, using `TeamStanding.teamBadge` | [ ] |
| BADGEUI-007 | WHEN a team identity renders in a division's team-list grid THE UI SHALL render `TeamCrest` using the raw `Team.config.name`/`Team.config.badge` already available on that row, with no new API field | [ ] |
| BADGEUI-008 | WHEN a team identity renders as the team-calendar page's identity header THE UI SHALL render `TeamCrest` using `TeamSeasonSchedule.teamBadge` | [ ] |
| BADGEUI-009 | WHEN a team identity renders in the GameWorld home calendar strip's day entries THE UI SHALL render `TeamCrest` using `TeamSeasonGame.homeTeamBadge`/`awayTeamBadge`, replacing the prior direct `teamBadgeText(...)` call | [ ] |
| BADGEUI-010 | WHEN a team name renders in a bracket, team-calendar game row, pre-game prep view, game box score, or next-game action item THE UI SHALL render `TeamCrest` alongside that name, using badge data already present in the projection or included alongside it | [ ] → #382 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

**Note (superseded surface, [#326](https://github.com/wulke/premier-league-baseball/issues/326)):** `BADGEUI-003`/`BADGEUI-009` originally targeted the GameWorld home "Today" scoreboard
(`docs/specs/league/league-today-ui-specs.md`, `TODAYUI-*`), which #326 replaced with the
cross-competition calendar strip (`docs/specs/game-world/home-calendar-strip-ui-specs.md`,
`CALWUI-*`). The crest-rendering requirement itself is unchanged — only the surface it renders
on — so these rows are reworded in place rather than superseded, matching how `TeamCrest`'s
wiring was carried over verbatim into `CalendarStrip`'s day-entry renderer.

## Traceability

- HLD: [`docs/high-level-design.md` — Real Team Badges & Full English Pyramid](../../high-level-design.md#hld-real-team-badges--full-english-pyramid)
- LLD: `docs/llds/league/team-badges-ui.md`
- Sibling specs: `docs/specs/league/team-badges-pyramid-specs.md`
- Decision record: conversation-resolved HLD (no wayfinder map)
- Code: `src/ui/components/team-crest.tsx` (NEW), `src/api/models.ts` (`TeamStanding`/`TeamSeasonGame`/`TeamSeasonSchedule` badge fields), `src/db/domain/division.ts`, `src/db/domain/league.ts`, `src/db/domain/team.ts`, `src/ui/pages/league.tsx`, `src/ui/pages/team-calendar.tsx`, `src/ui/pages/game-world.tsx`
