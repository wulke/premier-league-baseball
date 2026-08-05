# Specs: Round-Robin League Champion Recording

Backend requirements for identifying the champion-producing round-robin division in a League and
recording that champion in `SeasonResult` through the shared game-completion path.

| ID | Requirement | Status |
|---|---|---|
| LCH-001 | WHEN configuring a round-robin League THE system SHALL allow a division to be marked as the League's top-tier division so champion recording can target that division | [x] → #54 |
| LCH-002 | WHEN a top-tier `ROUND_ROBIN` division becomes season-complete after a game completion THE system SHALL write one `SeasonResult` row for that `(divisionId, year)` with the standings winner as `championTeamId` | [x] → #54 |
| LCH-003 | WHEN a non-top-tier `ROUND_ROBIN` division becomes season-complete THE system SHALL NOT write a `SeasonResult` row for that division | [x] → #54 |
| LCH-004 | WHEN re-checking a top-tier `ROUND_ROBIN` division that already has a `SeasonResult` row THE system SHALL leave the existing row unchanged and SHALL NOT create another row | [x] → #54 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> **Generalization (map [#78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87)):** `MSS-008` in [`multi-stage-season-specs.md`](multi-stage-season-specs.md) moves the `isTopTier` gate into `recordSeasonChampionIfMissing` so the knockout completion path consults the same gate. `LCH-001`..`LCH-004` remain authoritative for the round-robin path; RR-path behavior is unchanged.

## Traceability

- LLD: `docs/llds/competition-format.md`, `docs/llds/knockout-bracket.md`
- Decision record: [#40](https://github.com/wulke/premier-league-baseball/issues/40)
- Code: `src/api/models.ts`, `src/db/domain/game.ts`, `src/db/domain/season-result.ts`
