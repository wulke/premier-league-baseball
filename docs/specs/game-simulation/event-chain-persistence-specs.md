# Specs: Game Event-Chain Persistence

Backend requirements for retaining the `SimulationResult.eventChain` emitted by the
attribute-driven simulation engine. The envelope shape is settled by #220/#221/#224; this slice
only makes it durable at `GameFactory`'s existing completion transaction seam.

| ID | Requirement | Status |
|---|---|---|
| ECP-001 | WHEN an event chain is persisted THE system SHALL store every envelope's `type`, `gameId`, `sequence`, nullable `causedByEventId`, and JSON `context` in a `GameEvent` row with no timestamp fields, preserving sequence order per game | [x] → #351 |
| ECP-002 | WHEN `GameFactory.simulate` or `simulateBatch` receives a SimulationResult with an eventChain THE system SHALL persist that chain for the completed game alongside any attribute-derived PlayerGameStats rows | [x] → #351 |
| ECP-003 | WHEN a batch event-chain or PlayerGameStats write fails THE system SHALL roll back the batch's completed game results, PlayerGameStats rows, and GameEvent rows together | [x] → #351 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: `docs/high-level-design.md` — Durable Game Event Chain
- LLD: `docs/llds/game-simulation/event-chain-persistence.md`
- Tests: `test/db/domain/event-chain-persistence.test.ts`
- Code: `src/db/model/game-event.ts`, `src/db/domain/event-chain-writer.ts`, `src/db/domain/game.ts`
