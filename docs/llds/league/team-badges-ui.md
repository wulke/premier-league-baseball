# LLD: Team Crest Rendering (`TeamCrest`)

> Backend LLD (sibling): [`team-badges-pyramid.md`](./team-badges-pyramid.md) ·
> EARS: `docs/specs/league/team-badges-ui-specs.md` (`BADGEUI-001`..) ·
> Decision record: Conversation-resolved HLD (no wayfinder map)

## Scope

A new shared `TeamCrest` component and the DTO/call-site wiring needed to render it at the four
places a team's identity already renders as a standalone label: the League standings table row,
the division team-list grid, the team-calendar identity header, and the GameWorld home "Today"
scoreboard. Threads a `badge` field through the read DTOs whose factories build team names from a
`Map<teamId, name>` lookup (`TeamStanding`, `TeamSeasonGame`, `TeamSeasonSchedule`); the division
team-list grid needs no DTO change since it already receives the raw `Team.config` object.

**Out of scope**: `BracketView`/`BracketGame` team names (`division.ts`'s `toBracketGame`/
`buildBracketTies`, `docs/llds/league/knockout-bracket.md`'s + `bracket-tree-ui.md`'s surface) —
not one of the four surfaces named in the HLD; a future extension, not this slice. Player-detail's
`team: { id, name }` reference (`player.ts:198`) — not a standalone team-identity label. The badge
asset pipeline itself — `team-badges-pyramid.md`.

## Interface / Data Model

```ts
// src/api/models.ts — sibling `*Badge` field alongside each existing `*Name` field
interface TeamStanding {
  // ...existing fields...
  teamBadge?: string;              // NEW
}
interface TeamSeasonGame {
  // ...existing fields...
  homeTeamBadge?: string;          // NEW
  awayTeamBadge?: string | null;   // NEW — null to mirror awayTeamName's bye-sentinel nullability
}
interface TeamSeasonSchedule {
  // ...existing fields...
  teamBadge?: string;              // NEW
}
```

```tsx
// src/ui/components/team-crest.tsx (NEW)
const teamBadgeText = (name: string): string => /* unchanged algorithm, relocated from game-world.tsx */;

const TeamCrest = ({ name, badge, size = 28 }: { name: string; badge?: string | null; size?: number }) => JSX.Element;
// badge present  → <img src={badge} width={size} height={size} alt="" onError={swap to initials}/>
// badge absent   → initials fallback rendered directly, no <img> attempted
```

## Logic Flow

```
Backend (factories that build a Map<teamId, name> already — extend the map's value to {name, badge}):
  division.ts getStandings   → teamBadge: dsData.Team.config.badge                       # BADGEUI-001
  league.ts getToday         → teamMap: Map<id, {name, badge}>; homeTeamBadge/awayTeamBadge lookups
  team.ts getSchedule        → teamMap: Map<id, {name, badge}>; homeTeamBadge/awayTeamBadge lookups
                              → teamBadge: team.config?.badge (own team, top-level TeamSeasonSchedule)

Frontend call sites (all import TeamCrest):
  league.tsx StandingsTable row       → <TeamCrest name={row.teamName} badge={row.teamBadge} /> + row.teamName  # BADGEUI-002
  league.tsx TeamRoster (division grid) → <TeamCrest name={team.config?.name} badge={team.config?.badge} />     # BADGEUI-003 (no DTO change — raw config already in hand)
  team-calendar.tsx identity header   → <TeamCrest name={calendar.teamName} badge={calendar.teamBadge} />       # BADGEUI-004
  game-world.tsx Today scoreboard     → <TeamCrest name={teamName} badge={game.homeTeamBadge|awayTeamBadge} />  # BADGEUI-005 (replaces direct teamBadgeText(...) call)
```

### Key decisions embedded in this flow

- **Extend the existing `Map<teamId, name>` lookups to `Map<teamId, {name, badge}>`** rather than a
  second parallel map — one bulk `Team` fetch already resolves both fields off the same row
  (`config.name`/`config.badge`); no extra query.
- **`teamBadgeText` relocates, its algorithm doesn't change.** It becomes `TeamCrest`'s internal
  fallback rather than a page-local helper, so existing Gherkin coverage of the initials text
  (`TODAYUI-...`) keeps passing against the same computation, just invoked through a shared
  component instead of inline in `game-world.tsx`.
- **Failure recovery lives entirely client-side (`onError`)**, not as a second "does this badge
  exist" field from the backend — consistent with `team-badges-pyramid.md`'s decision that `badge`
  is always a computed path, never conditionally omitted.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | `badge` is set but the image 404s (source never fetched, or fetch failed — `BADGE-001`/`002`) | `<img onError>` swaps the element to the initials fallback; never shows a broken-image icon. | BADGEUI-001 |
| u2 | `badge` is `undefined`/`null` (e.g. `europe-32` Champions League teams, which never set `key`/`badge`) | `TeamCrest` renders the initials fallback directly — no `<img>` element attempted at all. | BADGEUI-002 |
| u3 | `name` is the `'Bye'` sentinel (`TeamSeasonGame.awayTeamName` for a bye slot) | `teamBadgeText('Bye')` computes `'B'` — same fallback path as any other name-only team, no special-casing needed. | BADGEUI-003 |
| u4 | Existing Today-scoreboard Gherkin scenarios asserting the initials text (`TODAYUI-...`) | Unaffected — `teamBadgeText`'s algorithm is relocated verbatim into `TeamCrest`, not changed; those scenarios keep passing against the same computed text. | BADGEUI-004 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-real-team-badges--full-english-pyramid) |
| **This LLD** | `docs/llds/league/team-badges-ui.md` |
| Sibling LLD | `docs/llds/league/team-badges-pyramid.md` (backend/config) |
| EARS | `docs/specs/league/team-badges-ui-specs.md` — `BADGEUI-001`..`BADGEUI-004` |
| Gherkin | `test/ui/features/team-badges-ui.feature` |
| Code | `src/ui/components/team-crest.tsx` (NEW), `src/api/models.ts` (`TeamStanding`/`TeamSeasonGame`/`TeamSeasonSchedule` badge fields), `src/db/domain/division.ts`, `src/db/domain/league.ts`, `src/db/domain/team.ts` (teamMap value extension), `src/ui/pages/league.tsx`, `src/ui/pages/team-calendar.tsx`, `src/ui/pages/game-world.tsx` |
| Decision record | Conversation-resolved HLD (no wayfinder map) |
