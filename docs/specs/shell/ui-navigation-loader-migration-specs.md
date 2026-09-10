# Specs: UI Navigation Loader Migration

UI requirements for the approved loader migration of Player Detail, Team Roster, Team Calendar,
Team Lineup, League, and Transfers. These requirements change the primary **read mechanism**, not
the data each page displays or its existing UI behavior.

| ID | Requirement | Status |
|---|---|---|
| NAVLOAD-001 | WHEN a user navigates to any in-scope Player Detail, Team Roster, Team Calendar, Team Lineup, League, or Transfers route THE system SHALL obtain that page's primary read data through the matched React Router route loader during the navigation transition, and SHALL NOT initiate the same primary GET from a page mount effect | [ ] |
| NAVLOAD-002 | WHEN an in-scope route loader starts a primary read THE system SHALL pass the navigation request's abort signal to every underlying fetch; WHEN a newer navigation supersedes that loader THE system SHALL abort the superseded primary read without allowing its result to populate the new route | [ ] |
| NAVLOAD-003 | WHEN Player Detail's primary read fails or identifies no player THE system SHALL provide `null` loader data and render its existing not-found state; WHEN Team Roster or Transfers' primary list read fails THE system SHALL provide an empty list; WHEN Team Calendar's primary read fails THE system SHALL provide its existing user-visible error state with a Retry action | [ ] |
| NAVLOAD-004 | WHEN Team Lineup or League is matched THE system SHALL start its independent primary reads concurrently and SHALL expose a stable aggregate loader-data shape in which a failed secondary read is represented by that field's documented safe null or empty value | [ ] |
| NAVLOAD-005 | WHEN a matched in-scope route revalidates after it has rendered primary data THE system SHALL retain the populated page content while the refresh is pending and SHALL replace it only with completed loader data, rather than returning to the page's initial blank or loading-only state | [ ] |
| NAVLOAD-006 | WHEN a Release, Renew, Sign, wholesale active-Lineup save, or next-game Lineup save request completes OR a Team Calendar game simulation succeeds THE system SHALL request revalidation of the currently matched route data; Team Calendar SHALL first preserve its existing immediate successful row update before the server-authoritative loader result replaces it | [ ] |
| NAVLOAD-007 | WHEN Team Calendar's primary loader is revalidated because its route parameters changed or `useRevalidator().revalidate()` is invoked THE system SHALL rerun the calendar read; WHEN its error-state Retry action is selected THE system SHALL invoke `useRevalidator().revalidate()` and SHALL NOT use a local `retryToken` to own the primary read lifecycle | [ ] |
| NAVLOAD-008 | WHEN UI acceptance tests exercise an in-scope route loader THE system SHALL render the shared route configuration with `createMemoryRouter` and `RouterProvider`, arranging both the existing `gwLoader` response and the destination route-loader responses before the router is created | [ ] |
| NAVLOAD-009 | WHEN Team Lineup revalidates while the user has unsaved edits THE system SHALL preserve the dirty draft and SHALL NOT derive or replace it from refreshed loader data; WHEN a Lineup save completes successfully and fresh loader data resolves THE system SHALL derive the replacement draft from that completed data | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired.*

## Traceability

- HLD: [`docs/high-level-design.md` — UI Navigation Performance](../../high-level-design.md#hld-ui-navigation-performance-loader-based-data-fetching)
- LLD: [`docs/llds/shell/ui-navigation-loader-migration.md`](../../llds/shell/ui-navigation-loader-migration.md)
- Existing loader foundation: [`docs/specs/shell/route-loader-foundation-ui-specs.md`](./route-loader-foundation-ui-specs.md) (`RLDRUI-001`..`RLDRUI-006`)
- Source decisions: [#231](https://github.com/wulke/premier-league-baseball/issues/231) · [#234](https://github.com/wulke/premier-league-baseball/issues/234) · [#235](https://github.com/wulke/premier-league-baseball/issues/235) · [#289](https://github.com/wulke/premier-league-baseball/issues/289)
- Existing page specs amended at Code stage (mechanism wording only; player-visible behavior remains governed by their current rows):
  - `docs/specs/manager/team-roster-ui-specs.md` (`ROSTUI-002`, `ROSTUI-003`)
  - `docs/specs/player/player-detail-ui-specs.md` (`PDETUI-001`, `PDETUI-006`)
  - `docs/specs/manager/transfers-ui-specs.md` (`XFERUI-002`..`XFERUI-005`)
  - Team Lineup and League use their existing feature specs for displayed behavior; their loader mechanism is introduced by `NAVLOAD-001`, `NAVLOAD-004`, and `NAVLOAD-005`.
- Gherkin and step definitions: to be created after EARS approval, tagged `@spec:NAVLOAD-001` through `@spec:NAVLOAD-009` as applicable.
- Code entry points: `src/ui/routes.tsx` and the six in-scope page components, to be annotated `// @spec NAVLOAD-…` during the Code stage.
