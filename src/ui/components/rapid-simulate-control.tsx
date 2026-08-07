// @spec RSSUI-001,RSSUI-002,RSSUI-003,RSSUI-004,RSSUI-005,RSSUI-006
// Dev-only "Rapid Simulate Season" control. Lives in the NavRail next to the
// player-facing BatchSimulateControl. Fail-closed unless the server reports
// gw.devToolsEnabled === true, and visually distinguished (DEV · dashed border)
// so it never reads as a normal player action. The two simulate controls lock
// each other while either is in flight (RSSUI-006) via the optional
// disabled/onBusyChange props threaded from NavRail.
import React, { useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useGameWorldContext } from '../context/game-world-context';

type RapidStatus = 'idle' | 'submitting' | 'success' | 'error';
type RapidResult = { daysAdvanced: number; simulated: unknown[]; skipped: unknown[] };

type RapidSimulateControlProps = {
  // Peer (batch) control is in flight → lock this control (RSSUI-006).
  disabled?: boolean;
  // Tell the shared parent (NavRail) when THIS control enters/leaves submitting.
  onBusyChange?: (busy: boolean) => void;
};

const devBtn: React.CSSProperties = {
  background: '#fff8e1',
  color: '#7a4d00',
  border: '1px dashed #b8860b',
};
const summaryStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#3a7d4d', fontWeight: 600 };

// @spec RSSUI-001..RSSUI-006
const RapidSimulateControl = ({ disabled = false, onBusyChange }: RapidSimulateControlProps) => {
  const { gw, invalidate } = useGameWorldContext();
  const [rapidStatus, setRapidStatus] = useState<RapidStatus>('idle');
  const [rapidResult, setRapidResult] = useState<RapidResult | null>(null);
  const [rapidError, setRapidError] = useState<string | undefined>();

  // @spec RSSUI-001,RSSUI-002 — fail closed unless the server explicitly enables dev tools.
  const canRapidSimulate = Boolean(gw && gw.devToolsEnabled === true && gw.config?.inProgress && gw.currentDate);
  // @spec RSSUI-006 — both mutations touch overlapping Game/GameWorld records.
  const controlsBusy = disabled || rapidStatus === 'submitting';

  const transition = (status: RapidStatus) => {
    setRapidStatus(status);
    onBusyChange?.(status === 'submitting');
  };

  // @spec RSSUI-003,RSSUI-004,RSSUI-005,RSSUI-006
  const runRapidSimulate = () => {
    if (!gw || controlsBusy) return;
    transition('submitting');
    setRapidError(undefined);
    fetch(Endpoints.RapidSimulateSeason.replace(':gwId', String(gw.id)), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Rapid simulation failed');
        return body;
      })
      .then((result: RapidResult) => {
        setRapidResult({
          daysAdvanced: result?.daysAdvanced ?? 0,
          simulated: result?.simulated ?? [],
          skipped: result?.skipped ?? [],
        });
        transition('success');
        invalidate();
      })
      .catch((err) => {
        console.error(err);
        setRapidError(err instanceof Error && err.message ? err.message : 'Rapid simulation failed');
        transition('error');
      });
  };

  // @spec RSSUI-001,RSSUI-002 — no button when the guard fails (and nothing is in flight).
  if (!canRapidSimulate && rapidStatus === 'idle') return null;

  switch (rapidStatus) {
    case 'submitting':
      return (
        <button data-testid="rapid-simulate-season" disabled style={{ ...devBtn, opacity: 0.6, cursor: 'default' }}>
          DEV · Simulating season…
        </button>
      );
    case 'success':
      return (
        <div data-testid="rapid-simulate-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={summaryStyle}>
            {rapidResult?.daysAdvanced ?? 0} days advanced · {rapidResult?.simulated.length ?? 0} simulated · {rapidResult?.skipped.length ?? 0} skipped
          </span>
          <button
            onClick={() => transition('idle')}
            style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#555' }}
            aria-label="Dismiss rapid simulation summary"
          >
            ×
          </button>
        </div>
      );
    case 'error':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span role="alert" style={{ color: '#c00', fontSize: '0.85rem' }}>
            {rapidError ?? 'Rapid simulation failed'}
          </span>
          <button
            onClick={runRapidSimulate}
            disabled={controlsBusy}
            style={{ padding: '6px 14px', border: '1px dashed #b8860b', borderRadius: '4px', cursor: controlsBusy ? 'default' : 'pointer', fontSize: '0.85rem', background: '#fff8e1' }}
          >
            Retry
          </button>
        </div>
      );
    case 'idle':
    default:
      return (
        <button
          data-testid="rapid-simulate-season"
          onClick={runRapidSimulate}
          disabled={controlsBusy}
          style={{ ...devBtn, ...(controlsBusy ? { opacity: 0.6, cursor: 'default' } : {}) }}
        >
          <small style={{ marginRight: '6px', fontWeight: 700 }}>DEV</small>Rapid Simulate Season
        </button>
      );
  }
};

export { RapidSimulateControl };
