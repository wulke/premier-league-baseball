# Specs: League Cup Knockout Bracket

Backend requirements for knockout bracket generation, round-advancement, tiebreak resolution, and
champion recording (`DivisionFactory`'s `KNOCKOUT` branch, `src/db/domain/division.ts`; round-advancement
hook shared with `src/db/domain/game.ts`).

| ID | Requirement | Status |
|---|---|---|
| CUP-001 | WHEN a Game in a KNOCKOUT division completes (single or batch simulate) IF it was the last unresolved game in its round THE system SHALL resolve the round's ties into winners and either generate the next round's games or record a champion | [ ] |
| CUP-002 | WHEN a KNOCKOUT round resolves to exactly one winner THE system SHALL write a `SeasonResult` row for that `(divisionId, year)` with that team as `championTeamId` instead of generating a further round | [ ] |
| CUP-003 | WHEN a KNOCKOUT round has a bye THE system SHALL create a `Game` row with `awayTeam: null`, status `COMPLETED`, and the bye team recorded as winner, with no simulation run | [ ] |
| CUP-004 | WHEN a `TWO_LEG` tie is level on aggregate runs AND `tiebreak` is `AGGREGATE_SCORE` THE system SHALL leave the tie unresolved with no further fallback | [ ] |
| CUP-005 | WHEN a `TWO_LEG` tie is level on aggregate runs AND `tiebreak` is `OVERTIME` THE system SHALL resolve the last leg's existing `Game` row to a decisive, non-draw score | [ ] |
| CUP-006 | WHEN a `TWO_LEG` tie is level on aggregate runs AND `tiebreak` is `ANOTHER_GAME_W_OVERTIME` THE system SHALL create a new tiebreaker `Game` row sharing the tied legs' `round` number, resolved to a decisive, non-draw score | [ ] |
| CUP-007 | WHEN `seeding` is `REDRAW` THE system SHALL re-shuffle pairings before every round (not only round 1) without changing round sizes | [ ] |
| CUP-008 | WHEN `seeding` is `FIXED` THE system SHALL pair winners in bracket order every round with no shuffle | [ ] |
| CUP-009 | WHEN generating a KNOCKOUT division's round 1 for N teams THE system SHALL reduce to the next-lower power of 2 (P), creating `N − P` play-in ties and `2P − N` byes | [ ] |
| CUP-010 | WHEN `seeding` is `FIXED` THE system SHALL allocate round-1 byes to the top `2P − N` seeds by `bracketSlot` order | [ ] |
| CUP-011 | WHEN labeling a KNOCKOUT round THE system SHALL use tournament-convention labels (1st Round / Round of 32 / Round of 16 / Quarterfinals / Semifinals / Final) derived from the round's team count | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/knockout-bracket.md`
- Decision records: [#33](https://github.com/wulke/premier-league-baseball/issues/33), [#43](https://github.com/wulke/premier-league-baseball/issues/43)
- Code: `src/db/domain/division.ts` (`DivisionFactory` — `newSeason`, `KNOCKOUT` branch), `src/db/domain/game.ts` (completion hook), new `SeasonResult` model
