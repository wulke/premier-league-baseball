// @spec RSSUI-001,RSSUI-002,RSSUI-003,RSSUI-004,RSSUI-005,RSSUI-006
// Dev-only "Rapid Simulate Season" control. Lives in the NavRail next to the
// player-facing BatchSimulateControl. Fail-closed unless the server reports
// gw.devToolsEnabled === true, and visually distinguished (DEV · dashed border)
// so it never reads as a normal player action. The two simulate controls lock
// each other while either is in flight (RSSUI-006) via the optional
// disabled/onBusyChange props threaded from NavRail.
import React, { useState } from 'react';
import { useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { Button, ErrorText, IconButton } from './ui';

type RapidStatus = 'idle' | 'submitting' | 'success' | 'error';
type RapidResult = { daysAdvanced: number; simulated: unknown[]; skipped: unknown[] };

type RapidSimulateControlProps = {
  // Peer (batch) control is in flight → lock this control (RSSUI-006).
  disabled?: boolean;
  // Tell the shared parent (NavRail) when THIS control enters/leaves submitting.
  onBusyChange?: (busy: boolean) => void;
};

const summaryStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#3a7d4d', fontWeight: 600 };

// @spec RSSUI-001..RSSUI-006
const RapidSimulateControl = ({ disabled = false, onBusyChange }: RapidSimulateControlProps) => {
  // @spec RLDRUI-001,RLDRUI-003
  const gw = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
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
        revalidate();
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
        <Button intent="dev" data-testid="rapid-simulate-season" disabled style={{ borderStyle: 'dashed' }}>
          DEV · Simulating season…
        </Button>
      );
    case 'success':
      return (
        <div data-testid="rapid-simulate-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={summaryStyle}>
            {rapidResult?.daysAdvanced ?? 0} days advanced · {rapidResult?.simulated.length ?? 0} simulated · {rapidResult?.skipped.length ?? 0} skipped
          </span>
          <IconButton
            onClick={() => transition('idle')}
            style={{ padding: '4px 8px', color: '#555' }}
            aria-label="Dismiss rapid simulation summary"
          >
            ×
          </IconButton>
        </div>
      );
    case 'error':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ErrorText role="alert">
            {rapidError ?? 'Rapid simulation failed'}
          </ErrorText>
          <Button intent="dev" size="sm" onClick={runRapidSimulate} disabled={controlsBusy}>
            Retry
          </Button>
        </div>
      );
    case 'idle':
    default:
      return (
        <Button
          intent="dev"
          data-testid="rapid-simulate-season"
          onClick={runRapidSimulate}
          disabled={controlsBusy}
          style={{ borderStyle: 'dashed' }}
        >
          <small style={{ marginRight: '6px', fontWeight: 700 }}>DEV</small>Rapid Simulate Season
        </Button>
      );
  }
};

export { RapidSimulateControl };
