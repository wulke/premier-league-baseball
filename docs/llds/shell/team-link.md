# LLD: Team Name Links (`<TeamLink>`)

> Upstream: issue [#372](https://github.com/wulke/premier-league-baseball/issues/372) ·
> EARS: `docs/specs/shell/team-link-specs.md` (`TEAMLINK-001`..)

## Scope

A team name rendered as plain, non-interactive text cannot be navigated to its Team View
page (`/:gwId/team/:teamId`, `TeamHub`). This LLD covers a small shared `<TeamLink>`
component and wires it into the four surfaces where a team name is genuinely plain text
today, with a `teamId` already in scope, and no existing conflicting click target:

- `src/ui/components/calendar-strip.tsx` — home/away team name in a game day entry.
- `src/ui/pages/game-box-score.tsx` — each side's team name header.
- `src/ui/pages/pre-game-prep.tsx` — matchup header team names and the opponent panel name.
- `src/ui/pages/team-calendar.tsx` — the opponent name in each `GameRow`.

**Explicitly out of scope** (surfaces already functionally linked, or missing the data to
link at all — left untouched here):

- `src/ui/pages/league.tsx` (`StandingsTable`) and `src/ui/components/bracket-view.tsx`
  (top-level tie team rows) — both already navigate to the Team View page via an
  `onTeamClick(teamId)` handler wired to `navigate()`. Same player-visible outcome (click a
  team name, land on its Team View page); converting the handler to a real `<Link>` is a
  separate refactor with no new behavior, not this issue's gap.
- `bracket-view.tsx`'s per-game summary line inside an expanded series (`getGameSummary`) —
  team names there are interpolated into a single summary sentence, not a discrete element;
  linking a substring would require restructuring that sentence into JSX fragments for no
  clear navigation gain (the tie's own team rows immediately above are already linked).
- `src/ui/pages/player-detail.tsx` — the contracted team name already renders via
  `<Link to={`/${gwId}/team/${player.contract.team.id}`}>`. Nothing to change.
- `src/ui/pages/notification-stream.tsx` — `NotificationRow.payload` for `GAME_RESULT` carries
  only `homeTeamResult`/`awayTeamResult` scores, no team id or name (`renderGameNotification`
  returns a plain string, not JSX). Linking a team here needs a payload shape change, which is
  a backend/data change outside this UI-only issue's scope. Left as a known gap.

## Interface / Data Model

### `TeamLink` (NEW — `src/ui/components/team-link.tsx`)

```tsx
const TeamLink = ({
  gwId,
  teamId,
  children,
  testId,
  style,
}: {
  gwId: string | number | undefined;
  teamId: number | null | undefined;
  children: React.ReactNode;
  testId?: string;
  style?: React.CSSProperties;
}) => JSX.Element;
```

- `teamId == null` or `gwId == null` → renders `children` inside a plain `<span>` (no link) —
  covers `TBD`/`Bye`/unassigned-opponent cases that already render team-name-shaped text
  without a real team behind them.
- Otherwise → renders `<Link to={`/${gwId}/team/${teamId}`}>{children}</Link>` from
  `react-router`, styled to read as a subtle inline link (inherits font size/weight from its
  container; underline only, no color shift) so it drops into existing team-name text
  without changing surrounding layout.
- `children` is deliberately generic (`ReactNode`, not a `name: string` prop) so callers can
  pass a `<TeamCrest>` + name pair (as `calendar-strip.tsx` does) or a plain string, matching
  each surface's existing markup instead of forcing a single crest+name layout everywhere.

### Call sites (MODIFIED)

| File | Before | After |
|---|---|---|
| `calendar-strip.tsx` | `renderGameEntry({ game })` — plain `<TeamCrest>` + team name spans | wraps each side's crest+name in `<TeamLink gwId={gwId} teamId={game.homeTeamId}>`/`awayTeamId`; `CalendarStripProps` gains `gwId: string` | 
| `game-box-score.tsx` | `<h2>{side.teamName} <output>{side.score}</output></h2>` | `<h2><TeamLink gwId={gwId} teamId={side.teamId}>{side.teamName}</TeamLink> <output>{side.score}</output></h2>`; `GameBoxScore` reads `gwId` via `useParams()` |
| `pre-game-prep.tsx` | `<h1>{game.homeTeamName} vs {game.awayTeamName}</h1>` and `<strong>{opponentName}</strong>` | both wrapped in `<TeamLink gwId={gwId} teamId={...}>` using `game.homeTeamId`/`game.awayTeamId`/`opponentId` (all already in scope) |
| `team-calendar.tsx` | `GameRow`: `<span style={{ fontWeight: 600 }}>{isBye || isHome ? 'vs' : '@'} {opponent}</span>` | the `{opponent}` text alone (not the `vs`/`@` prefix) wraps in `<TeamLink gwId={gwId} teamId={isBye ? null : (isHome ? game.awayTeamId : game.homeTeamId)}>` — `TeamLink` itself no-ops to plain text when `isBye` (teamId `null`) |

`gwId` threading: `calendar-strip.tsx` is the only file gaining a new prop (`gwId`), passed
from its sole caller `game-world.tsx`, which already holds `gwId` from `useParams()`.
`game-box-score.tsx` gains a local `useParams()` call it doesn't have today. The other two
files already read `gwId` from `useParams()`/a prop.

## Logic Flow

```
1. A surface renders a team name it already has (teamId, gwId) for.
2. It wraps the name in <TeamLink gwId={gwId} teamId={teamId}>.
3. TeamLink:
     teamId == null || gwId == null → render children in a plain <span> (TEAMLINK-002)
     otherwise → render children inside <Link to={`/${gwId}/team/${teamId}`}> (TEAMLINK-001)
4. Clicking the link navigates via react-router to TeamHub (unchanged route, no new route
   added) — same destination StandingsTable/BracketView's onTeamClick already reaches.
```

No nesting conflict exists at any of the four call sites: none of `calendar-strip.tsx`'s day
cells, `game-box-score.tsx`'s headers, `pre-game-prep.tsx`'s header/panel, or
`team-calendar.tsx`'s `GameRow` opponent cell are themselves inside another clickable
element (`GameRow`'s own `<Link>` is a sibling cell, not an ancestor of the opponent name).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `teamId` is `null` (bracket bye slot semantics leak into `team-calendar.tsx`'s bye row, or a box score/opponent side with no assigned team) | `TeamLink` renders plain text, no link, no crash | TEAMLINK-002 |
| e2 | `gwId` is `undefined` (route param momentarily unset during a transition) | Same plain-text fallback as e1 — `TeamLink` never renders a link with an incomplete `to` path | TEAMLINK-002 |
| e3 | The opponent cell's `<TeamLink>` sits next to `GameRow`'s own `Link to=".../game/:gameId"` in the same row | The two `<Link>`s are siblings in different grid cells, not nested — no `stopPropagation`/event-conflict handling needed, unlike `bracket-view.tsx`'s existing toggle-vs-click pattern | TEAMLINK-006 |
| e4 | A team's badge (`TeamCrest`) is part of the linked content in `calendar-strip.tsx` | `TeamLink`'s `children` is generic `ReactNode`, so the crest + name render together inside the same `<Link>`, both clickable | TEAMLINK-003 |

## Traceability

| Layer | Artifact |
|---|---|
| Source issue | [#372](https://github.com/wulke/premier-league-baseball/issues/372) |
| **This LLD** | `docs/llds/shell/team-link.md` |
| EARS | `docs/specs/shell/team-link-specs.md` — `TEAMLINK-001`..`TEAMLINK-006` (NEW) |
| Gherkin | `test/ui/features/team-name-links-ui.feature` (NEW) |
| Step defs | `test/ui/steps/team-name-links-ui.steps.test.tsx` (NEW) |
| Code entry points | `src/ui/components/team-link.tsx` (NEW) · `src/ui/components/calendar-strip.tsx`, `src/ui/pages/{game-box-score,pre-game-prep,team-calendar}.tsx`, `src/ui/pages/game-world.tsx` (EDIT) |
