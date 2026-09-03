# LLD: SPA Fallback Route

> EARS: `docs/specs/shell/spa-fallback-route-specs.md` (`SPAF-001`..`SPAF-003`) · Issue: [#278](https://github.com/wulke/premier-league-baseball/issues/278)

## Interface / Data Model

`createApplication(uiDirectory?: string): Express` configures the HTTP middleware order used by
the production entry point. `uiDirectory` defaults to `dist/ui` and is injectable only so the
acceptance suite can provide an isolated `index.html` fixture.

## Logic Flow

1. Serve files from `uiDirectory` with `express.static`.
2. Mount `ApiRouter` so declared API routes continue to produce their JSON response.
3. Terminate otherwise-unmatched `/api/...` requests with Express's normal `404` response.
4. For every remaining `GET`, send `uiDirectory/index.html`; React Router then resolves the
   browser URL client-side.
5. Leave non-GET, non-API requests to Express's normal `404` behavior.

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| A bookmarked nested UI URL has no file on disk | It reaches the final GET fallback and receives `index.html`. | SPAF-001 |
| An unknown GET begins with `/api/` | The API 404 boundary runs before the SPA fallback so it cannot receive HTML. | SPAF-002 |
| A declared API endpoint is requested | `ApiRouter` handles it before either 404/fallback middleware and returns JSON. | SPAF-003 |
| A POST targets an unknown client-side URL | The GET-only fallback does not handle it; Express returns 404. | SPAF-002 |

## Traceability

`SPAF-001`..`SPAF-003` are verified by `test/bdd/features/spa-fallback-route.feature` and its
middleware-level step bindings.
