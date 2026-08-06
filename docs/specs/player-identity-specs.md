# Specs: Player Identity Model & Generation

Backend requirements for the six typed `Player` identity columns and the identity-generation logic
that extends `PlayerFactory.generateRoster()` (`src/db/model/player.ts`, `src/db/domain/identity.ts`,
`src/db/domain/player.ts`).

| ID | Requirement | Status |
|---|---|---|
| PID-001 | WHEN a country's curated name pool is empty or undersized THE system SHALL NOT fall back to a default country at runtime — pools are curated non-empty at authoring time | [ ] |
| PID-002 | WHEN `League.config.compositionKey` is missing or unrecognized THE system SHALL fall back to the `PREMIER_LEAGUE` composition rather than failing Team creation | [ ] |
| PID-003 | WHEN the six `allowNull:false` identity columns are added to a database with pre-existing Players THE system SHALL NOT provide a backfill path — the dev database is dropped and recreated (obviated per #144) | [D] |
| PID-004 | WHEN `birthDate` is generated THE system SHALL clamp it to an 18–38 age band relative to the GameWorld year so no out-of-band date is produced | [ ] |
| PID-005 | WHEN identity is generated THE system SHALL use a seeded mulberry32 RNG, with seed consumption scoped to a single `generateRoster` call, so a roster is reproducible from its seed with no cross-call coupling | [ ] |
| PID-006 | WHEN the `Player` model is defined THE system SHALL include six typed identity columns — `givenName`, `familyName`, `countryCode`, `bats`, `throws`, `birthDate` — all `allowNull:false` independent of `teamId` | [ ] |
| PID-007 | WHEN generating a Player's identity THE system SHALL select `countryCode` first from the league's composition, then draw `givenName` and `familyName` from that country's curated pool | [ ] |
| PID-008 | WHEN generating `bats` and `throws` THE system SHALL draw each independently (`bats` ∈ R/L/S, `throws` ∈ R/L) with an MLB-like distribution and no correlation to country or to each other | [ ] |
| PID-009 | WHEN generating `birthDate` THE system SHALL store a `Date` (the aging-immune seed) and SHALL NOT store a derived `age`; `age` is computed at read-time | [ ] |
| PID-010 | WHEN generating a roster THE system SHALL resolve the country composition from `League.config.compositionKey` so the same generator serves any league | [ ] |

`PID-003` is Deferred, not Active — no preserved data requires backfill (per [#144](https://github.com/wulke/premier-league-baseball/issues/144),
closed out of scope); it records the migration posture, not a behavior to implement.

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)
- LLD: `docs/llds/player-identity.md`
- Decision record: [#141](https://github.com/wulke/premier-league-baseball/issues/141), [#142](https://github.com/wulke/premier-league-baseball/issues/142), [#143](https://github.com/wulke/premier-league-baseball/issues/143)
- Code: `src/db/model/player.ts` (6 columns), `src/db/domain/identity.ts` (pools + `generateIdentity`), `src/db/domain/player.ts` (`generateRoster` extension)
