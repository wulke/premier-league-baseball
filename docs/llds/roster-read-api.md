# LLD: Roster Read API

> Upstream: [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility) ·
> EARS: `docs/specs/roster-read-api-specs.md` (`ROST-001`..) ·
> Decision record: [#145 Roster read API](https://github.com/wulke/premier-league-baseball/issues/145)

## Scope

Adds `GET /api/team/:teamId/roster` (+ optional `?gwId=`), backed by `TeamFactory(teamId).getRoster()` anchoring on **Contracts** (`Team → Contract → Player` join). v1 intentionally returns every Contract row (the active-date filter belongs to #140). Returns a **flat row, no envelope** — identity + derived `primaryPosition` + flat-7 ratings + a derived `positionCoverage` field (the corrigendum #147 graduated onto #145). Depends on the identity columns ([`player-identity.md`](./player-identity.md)) and the Contract DATE migration ([`player-detail-read-api.md`](./player-detail-read-api.md)). Does **not** cover player detail, any write, or UI.

## Interface / Data Model

```ts
// src/api/endpoints.ts
GetTeamRoster = '/api/team/:teamId/roster'

// src/db/domain/team.ts — new read on TeamFactory, anchored (mirrors getSchedule)
interface ITeam {
  create: ...;
  getSchedule: ...;
  getRoster: (gwId?: number) => Promise<RosterPlayer[]>;   // anchored on the closure teamId
}

// src/api/models.ts — flat row, no envelope (per backend-standards §5: raw, unwrapped)
interface RosterPlayer {
  id: number;
  givenName: string; familyName: string; countryCode: string;
  bats: 'R'|'L'|'S'; throws: 'R'|'L';
  age: number;                 // derived read-time from birthDate (not stored)
  primaryPosition: PlayerPosition;   // derived: argmax over attributes.positions (PATTR-001 ratified here)
  positionCoverage: PlayerPosition[]; // derived: fixed-threshold (≥70) set over the 9-key map (#147 corrigendum)
  contact: number; power: number; armStrength: number; accuracy: number;
  reaction: number; vision: number; discipline: number;   // flat-7 verbatim — NO derived OVR
}
```

## Logic Flow

```
GET /api/team/:teamId/roster?gwId=…
  → router: handlers.getTeamRoster(teamId = Number(req.params.teamId), gwId = Number(req.query.gwId))
  → handler:
      IF gwId provided: assert Team(teamId).gameWorldId === gwId else DomainError(404)   # ROST-002
      return TeamFactory(teamId).getRoster(gwId)
  → TeamFactory(teamId).getRoster():
      team = Team.findByPk(teamId); if !team → DomainError('Not found', 404)             # ROST-001
      players = team.getPlayers({ include: [{ model: Contract,                              // anchored on active
        where: { startDate: { [Op.lte]: <now-or-year> }, endDate: { [Op.gte]: <now-or-year> } } }] })
        // ⚠ NO year-filter in v1 — deliberate gap traceable to #140 (see Edge Case e4).
        //   v1 reads ALL Contracts for the team; multi-row history doesn't exist yet.
        //   When #140 lands, add the startDate≤cur≤endDate filter; anchored-on-Contract
        //   makes the seam trivial. For now <now-or-year> is effectively unbounded.
      return players.map(toRosterPlayer):
        age       = derivedFrom(birthDate, gameWorldYear)
        primaryPosition = argmax(attributes.positions)   // first-listed enum on tie (PATTR-001)
        positionCoverage = positions filter (rating >= COVERAGE_THRESHOLD)        # ROST-006
      → flat array (unsorted: Player.id order; sort is the UI's job — #147)
```

### Key decisions embedded in this flow

- **Anchor on Contracts, not `Player.teamId`** — `Contract` is the membership source-of-truth (forward-proofs #140); `Player.teamId` is a denormalized cache. The read joins `Team → Contract → Player`.
- **Flat row, no OVR** — the additive-attribute constraint (#145/#146): ratings are served verbatim, never rolled into a stored/computed OVR. `positionCoverage` is additive (a derived view over existing ratings), not a synthetic rating.
- **Sort/filter deferred to the UI** (#147) — the API returns unsorted `Player.id` order; client-side sort/filter from the flat-7 + coverage needs no query params.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `teamId` not found | `DomainError('Not found', 404)` → `{ error }`, status 404 (per backend-standards §3). | ROST-001 |
| e2 | `?gwId=` provided and the team belongs to a different GameWorld | `DomainError(404)` — cross-world mismatch is a not-found from the caller's perspective. Team IDs are globally unique, so no gw-nested path is needed; `gwId` is a validation guard only. | ROST-002 |
| e3 | Team exists but has zero active Contracts (empty roster) | Returns `[]` — not an error. (Cannot occur via `generateRoster` today, but the read is robust to it.) | ROST-003 |
| e4 | Multi-year / multi-row Contracts produce duplicate roster rows for one player | **Not filtered in v1.** Deliberate gap traceable to #140: no Contract year-filter exists because only one Contract per player is ever written. When #140 introduces multi-row history, add the `startDate≤cur≤endDate` active-contract filter here — the anchored-on-Contract design makes that a one-line seam, not a rework. | ROST-004 |
| e5 | `primaryPosition` tie (two positions share the max rating) | First-listed enum order (the existing `primaryPosition()` reduce — PATTR-001 edge e1), **ratified here as the spec for all read consumers**. | ROST-005 |
| e6 | `positionCoverage` threshold calibration | Fixed-threshold **rule** (`≥ COVERAGE_THRESHOLD`, placeholder `70`); primary always included. Analytical calibration of the threshold is generation/engine work → #136, out of scope here. | ROST-006 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-team-roster--player-visibility) |
| **This LLD** | `docs/llds/roster-read-api.md` |
| Sibling LLDs | `docs/llds/player-identity.md` (identity columns), `docs/llds/player-detail-read-api.md` (Contract DATE), `docs/llds/team-roster-ui.md` (consumer) |
| EARS | `docs/specs/roster-read-api-specs.md` — `ROST-001`.. |
| Code | `src/api/endpoints.ts` (`GetTeamRoster`), `src/api/router.ts`, `src/api/handlers.ts` (`getTeamRoster`), `src/db/domain/team.ts` (`getRoster`), `src/api/models.ts` (`RosterPlayer`) |
| Decision record | [#145](https://github.com/wulke/premier-league-baseball/issues/145) |
