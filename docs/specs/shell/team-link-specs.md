# Specs: Team Name Links

UI requirements for a shared `<TeamLink>` component (`docs/llds/shell/team-link.md`) and its
use in the four surfaces where a team name renders as plain, non-interactive text today.
Closes issue [#372](https://github.com/wulke/premier-league-baseball/issues/372).

Upstream: [LLD](../../llds/shell/team-link.md).

| ID | Requirement | Status |
|---|---|---|
| TEAMLINK-001 | WHEN a surface renders a team name via `<TeamLink gwId teamId>` IF both `gwId` and a non-null `teamId` are known THE UI SHALL render the team name as a link to `/:gwId/team/:teamId` (the existing `TeamHub` route) | [x] |
| TEAMLINK-002 | WHEN a surface renders a team name via `<TeamLink gwId teamId>` IF `teamId` is `null`/`undefined` or `gwId` is `undefined` THE UI SHALL render the team name as plain text with no link | [x] |
| TEAMLINK-003 | WHEN the GameWorld home calendar strip (`calendar-strip.tsx`) renders a game day entry THE home and away team names SHALL each link to their Team View page | [x] |
| TEAMLINK-004 | WHEN the game box score page (`game-box-score.tsx`) renders a team's header THE team name SHALL link to that team's Team View page | [x] |
| TEAMLINK-005 | WHEN pre-game prep (`pre-game-prep.tsx`) renders its matchup header or opponent panel THE team names SHALL each link to their Team View page | [x] |
| TEAMLINK-006 | WHEN a team calendar schedule row (`team-calendar.tsx`'s `GameRow`) renders its opponent name IF the row is a real opponent (not a bye) THE opponent name SHALL link to its Team View page without altering the row's own game-status link | [x] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired.*
