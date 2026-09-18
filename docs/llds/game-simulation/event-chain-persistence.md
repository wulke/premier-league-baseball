# LLD: Game Event-Chain Persistence

> HLD: [Durable Game Event Chain](../../high-level-design.md#hld-durable-game-event-chain) · EARS: `docs/specs/game-simulation/event-chain-persistence-specs.md` · Ticket: [#351](https://github.com/wulke/premier-league-baseball/issues/351)

## Interface / Data Model

`GameEvent` is a low-level durable representation of one `EventEnvelope<unknown>`:

```ts
GameEvent {
  id: number;                       // storage identity only
  type: string;
  gameId: number;
  sequence: number;
  causedByEventId: number | null;
  context: unknown;                 // JSON
}
```

It belongs to `Game`; `Game.hasMany(GameEvent)`. `gameId` and `sequence` are uniquely indexed,
preserving the engine's one monotonic ordering per game. Sequelize timestamps are disabled: the
settled envelope has no timestamp field. `causedByEventId` retains the causal identifier emitted
by the engine and is intentionally not a foreign key, because the envelope is constructed before
storage assigns its row identity.

```ts
persistGameEvents(events: EventEnvelope<unknown>[], transaction?: Transaction): Promise<void>
```

## Logic Flow

1. `GameFactory` resolves and runs the pure simulation engine.
2. It writes the completed score.
3. If `playerGameStats` exists, it writes the projection; if `eventChain` exists, it bulk-inserts
   its envelopes as `GameEvent` rows using the same transaction.
4. A single-game simulation performs these completion writes after the guarded score update; batch
   simulation performs all three inside its existing all-or-nothing transaction.
5. Random-engine fallback results omit `eventChain`, so they create no `GameEvent` rows.

## Edge Case Probe

| Condition | Handling |
|---|---|
| Engine returns no chain | No event rows are inserted; the random fallback remains unchanged. |
| Chain includes causal children | `causedByEventId` is persisted verbatim, preserving the engine's causal walk. |
| Batch event insert fails | The existing batch transaction rolls back scores, projected stats, and all event rows. |
| A future reader needs event time or entity lookup | Out of scope; `sequence` is the authoritative ordering and an additive index table can decode typed contexts later. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/game-simulation/event-chain-persistence-specs.md` (`ECP-001`..`ECP-003`) |
| Tests | `test/db/domain/event-chain-persistence.test.ts` |
| Code | `src/db/model/game-event.ts`, `src/db/model/associations.ts`, `src/db/domain/event-chain-writer.ts`, `src/db/domain/game.ts` |
