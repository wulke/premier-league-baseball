import { Op } from 'sequelize';
import db from '../../client';
import { DomainError } from '../errors';
import { NotificationRow } from '../../../api/models';
import { isRegisteredNotificationType } from './registry';

// Connection bookkeeping lives here (not router.ts) so it sits alongside the domain
// logic that owns the Notification model — the one deliberate exception to keeping
// Express req/res objects out of the domain layer (LLD "Key decisions").
const connectionsByGameWorld = new Map<number, any[]>();

// @spec NOTIF-004
const pushToOpenConnections = (gameWorldId: number, row: NotificationRow): void => {
  const connections = connectionsByGameWorld.get(gameWorldId);
  if (!connections || connections.length === 0) return;
  const chunk = `data: ${JSON.stringify(row)}\n\n`;
  connections.forEach((res) => res.write(chunk));
};

const toRow = (dataValues: any): NotificationRow => ({
  id: dataValues.id,
  gameWorldId: dataValues.gameWorldId,
  teamId: dataValues.teamId,
  type: dataValues.type,
  payload: dataValues.payload,
  createdAt: dataValues.createdAt,
});

const NotificationFactory = () => {
  return {
    // @spec NOTIF-001,NOTIF-002,NOTIF-005
    notify: async (
      type: string,
      payload: Record<string, any>,
      scope: { gameWorldId: number; teamId?: number | null },
    ): Promise<void> => {
      if (!isRegisteredNotificationType(type)) {
        throw new DomainError(`unknown notification type '${type}'`, 400);
      }
      try {
        const created = await db.models.Notification.create({
          gameWorldId: scope.gameWorldId,
          teamId: scope.teamId ?? null,
          type,
          payload,
        });
        pushToOpenConnections(scope.gameWorldId, toRow(created.dataValues));
      } catch (error) {
        // @spec NOTIF-005 — never propagate a notification write failure into the
        // triggering domain action.
        console.error(error);
      }
    },

    // @spec NOTIF-003,NOTIF-006,NOTIF-007
    listSince: async (gameWorldId: number, sinceId?: number): Promise<NotificationRow[]> => {
      // @spec NOTIF-003 — a non-numeric since (Number('...') => NaN) is explicitly
      // guarded here rather than passed to Op.gt: SQLite raises "no such column: NaN"
      // for that comparison rather than matching zero rows, so this can't be left to
      // fall through like a malformed findByPk id can.
      if (sinceId !== undefined && Number.isNaN(sinceId)) return [];
      const rows = await db.models.Notification.findAll({
        where: { gameWorldId, id: { [Op.gt]: sinceId ?? 0 } },
        order: [['id', 'ASC']],
      });
      return rows.map((row: any) => toRow(row.dataValues));
    },

    // @spec NOTIF-008
    subscribe: (gameWorldId: number, res: any): void => {
      const connections = connectionsByGameWorld.get(gameWorldId) ?? [];
      connections.push(res);
      connectionsByGameWorld.set(gameWorldId, connections);
    },

    // @spec NOTIF-009
    unsubscribe: (gameWorldId: number, res: any): void => {
      const connections = connectionsByGameWorld.get(gameWorldId);
      if (!connections) return;
      connectionsByGameWorld.set(gameWorldId, connections.filter((c) => c !== res));
    },
  };
};

export { NotificationFactory };
