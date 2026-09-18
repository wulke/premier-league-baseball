import { Transaction } from 'sequelize';
import db from '../client';
import { EventEnvelope } from './events/envelope';

type GameEventCreation = Pick<EventEnvelope<unknown>, 'type' | 'gameId' | 'sequence' | 'causedByEventId' | 'context'>;

// @spec ECP-001,ECP-002,ECP-003 — GameFactory owns when chains are written; this writer owns
// the model-shaped bulk insert and accepts its caller's completion transaction.
export const persistGameEvents = async (
  events: EventEnvelope<unknown>[],
  transaction?: Transaction,
): Promise<void> => {
  if (events.length === 0) return;
  const rows: GameEventCreation[] = events.map(({ type, gameId, sequence, causedByEventId, context }) => ({
    type, gameId, sequence, causedByEventId, context,
  }));
  await db.models.GameEvent.bulkCreate(rows, { transaction });
};
