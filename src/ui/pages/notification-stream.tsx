import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { NotificationRow } from '../../api/models';

interface NotificationStreamProps {
  gwId: number;
  managedTeamId: number | null;
}

const renderGameResult = (row: NotificationRow): string => {
  const { homeTeamResult, awayTeamResult } = row.payload ?? {};
  return `Game result: ${homeTeamResult} – ${awayTeamResult}`;
};

// @spec NOTIFUI-006 — a raw fallback line for any type with no registered renderer.
const renderNotification = (row: NotificationRow): string => {
  if (row.type === 'GAME_RESULT') return renderGameResult(row);
  return `${row.type}: ${JSON.stringify(row.payload)}`;
};

// @spec NOTIFUI-001,NOTIFUI-002,NOTIFUI-003,NOTIFUI-004,NOTIFUI-005
const NotificationStream = ({ gwId, managedTeamId }: NotificationStreamProps) => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    // @spec NOTIFUI-001
    fetch(Endpoints.GetGameWorldNotifications.replace(':gwId', String(gwId)), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (!cancelled) setNotifications(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    // @spec NOTIFUI-002,NOTIFUI-003
    const source = new EventSource(Endpoints.StreamGameWorldNotifications.replace(':gwId', String(gwId)));
    source.onmessage = (event) => {
      const row: NotificationRow = JSON.parse(event.data);
      if (!cancelled) setNotifications((prev) => [...prev, row]);
    };

    return () => {
      cancelled = true;
      // @spec NOTIFUI-004
      source.close();
    };
  }, [gwId]);

  // @spec NOTIFUI-005
  const visible = notifications.filter((row) => row.teamId == null || row.teamId === managedTeamId);

  return (
    <div data-testid="notification-stream">
      {visible.map((row) => (
        <div key={row.id} data-testid={`notification-${row.id}`} style={{ padding: '6px 0', fontSize: '0.85rem' }}>
          {renderNotification(row)}
        </div>
      ))}
    </div>
  );
};

export { NotificationStream };
