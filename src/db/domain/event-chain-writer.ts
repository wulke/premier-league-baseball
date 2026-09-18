import { Transaction } from 'sequelize';
import db from '../client';
import { EventEnvelope } from './events/envelope';

// @spec ECP-001,ECP-002,ECP-003 — GameFactory owns when chains are written; this writer owns
// the model-shaped bulk insert and accepts its caller's completion transaction.
export const persistGameEvents = async (
  events: EventEnvelope<unknown>[],
  transaction?: Transaction,
): Promise<void> => {
  if (events.length === 0) return;
  await db.models.GameEvent.bulkCreate(events as unknown as Record<string, unknown>[], { transaction });
};
