# LLD: Unclaimed-Team Home Prompt

> Upstream: [HLD: Game World Home Page Overhaul](../../high-level-design.md#hld-game-world-home-page-overhaul) ·
> EARS: `docs/specs/game-world/unclaimed-team-home-ui-specs.md` (`UNCLMUI-001`..`UNCLMUI-003`) ·
> Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#333](https://github.com/wulke/premier-league-baseball/issues/333)

## Interface / Data Model

No API or mutation is added. The existing `GET /api/gameWorld/:gwId` payload already supplies the
nullable `managedTeamId` and ordered `Leagues` list used by the page.

```tsx
const claimed = gw.managedTeamId != null;
const firstCompetition = gw.Leagues?.[0];

// unclaimed → one prompt with a Link to `/${gwId}/${firstCompetition.id}`
// claimed   → existing CalendarStrip + ActionItemsPanel composition
```

The prompt routes to the first competition's existing team list. Selecting a team there opens
`team-hub.tsx`, whose existing **Take this job** action posts to
`POST /api/gameWorld/:gwId/managed-club`; the prompt neither duplicates nor calls that mutation.

## Logic Flow

```
1. GameWorld page receives the route-loader payload.
2. IF managedTeamId is null:
   a. Render one claim prompt where the calendar/action-items region normally appears.
   b. Link to the first configured competition so its existing team list leads to TeamHub.
   c. Do not mount CalendarStrip or ActionItemsPanel.
3. IF managedTeamId is non-null:
   retain the existing calendar/action-items layout unchanged.
4. After TeamHub claims a team and revalidates the GameWorld loader, a later home visit follows
   the claimed branch.
```

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| `managedTeamId` is `null` with one or more competitions | Show the single prompt and route to the first competition's team list. | UNCLMUI-001, UNCLMUI-002 |
| `managedTeamId` becomes non-null after an existing TeamHub claim | The regular calendar/action-items guards resume with no new claim flow or page state. | UNCLMUI-003 |
| No competition is available | Keep the explanatory prompt but omit its link; no invalid route is manufactured. | UNCLMUI-002 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — Game World Home Page Overhaul |
| **This LLD** | `docs/llds/game-world/unclaimed-team-home-ui.md` |
| EARS | `docs/specs/game-world/unclaimed-team-home-ui-specs.md` |
| Gherkin | `test/ui/features/unclaimed-team-home-ui.feature` |
| Code | `src/ui/pages/game-world.tsx` |
