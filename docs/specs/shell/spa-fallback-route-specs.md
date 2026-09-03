# Specs: SPA Fallback Route

Server requirements for browser-history deep links served by Express. See
`docs/llds/shell/spa-fallback-route.md`.

| ID | Requirement | Status |
|---|---|---|
| SPAF-001 | WHEN a client sends a GET request for an unmatched non-API path, including a nested React Router path, THE server SHALL return the UI `index.html` document so the SPA can resolve the route. | [ ] → #278 |
| SPAF-002 | WHEN a client sends an unmatched request under `/api/`, or a non-GET unmatched request, THE server SHALL preserve Express's normal 404 behavior and SHALL NOT return the UI document. | [ ] → #278 |
| SPAF-003 | WHEN a client sends a request matching a declared API endpoint THE server SHALL return that endpoint's JSON response before considering the SPA fallback. | [ ] → #278 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
