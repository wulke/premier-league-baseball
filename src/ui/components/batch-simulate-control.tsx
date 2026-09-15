// @spec SIMUI-009..SIMUI-018,SIMUI-029,SCL-014,CALWUI-009
import React, { useEffect, useState } from 'react';
import { useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';

type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';
type BatchResult = { simulated: unknown[]; skipped: { reason?: string }[]; nextDate?: string | null; progressBlocked?: boolean };

type BatchSimulateControlProps = {
  // Peer (rapid) control is in flight → lock this control (RSSUI-006).
  disabled?: boolean;
  // Tell the shared parent (NavRail) when THIS control enters/leaves submitting.
  onBusyChange?: (busy: boolean) => void;
  // Home-page placement wraps the same state machine in a primary CTA treatment.
  prominent?: boolean;
};

// @spec SIMUI-009..SIMUI-018,SIMUI-029,SCL-014,CALWUI-009
const BatchSimulateControl = ({ disabled = false, onBusyChange, prominent = false }: BatchSimulateControlProps = {}) => {
  // @spec RLDRUI-001,RLDRUI-003
  const gw = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const canBatch = Boolean(gw && gw.config?.inProgress && gw.currentDate);

  useEffect(() => {
    if (batchStatus !== 'success-clean') return undefined;
    const timer = setTimeout(() => setBatchStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [batchStatus]);

  const transition = (status: BatchStatus) => {
    setBatchStatus(status);
    onBusyChange?.(status === 'submitting');
  };

  const runBatch = () => {
    if (!gw) return;
    transition('submitting');
    fetch(Endpoints.BatchSimulateGames.replace(':gwId', String(gw.id)), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((result: BatchResult) => {
        const simulated = result?.simulated ?? [];
        const skipped = result?.skipped ?? [];
        setBatchResult({ simulated, skipped, nextDate: result?.nextDate, progressBlocked: result?.progressBlocked });
        // @spec SIMUI-014,SIMUI-029 — the domain's authoritative progression result,
        // rather than a stale batch skip ledger, decides whether the rail warns.
        transition(result?.progressBlocked ? 'success-skipped' : 'success-clean');
        revalidate();
      })
      .catch((err) => {
        console.error(err);
        transition('error');
      });
  };

  // @spec CALWUI-009 — wrapping happens inside the stateful control so a revalidation that
  // closes the season cannot unmount success/error feedback before the player sees it.
  const present = (content: React.ReactNode) => (prominent ? (
    <div
      data-testid="simulate-today-banner"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        padding: '16px 20px', marginBottom: '14px', border: '1px solid #1f2937',
        borderRadius: '8px', background: '#f1f5f9',
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>Ready for today’s games?</div>
        <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>Simulate the games scheduled for the current day.</div>
      </div>
      {content}
    </div>
  ) : content);

  if (!canBatch && batchStatus === 'idle') return null;
  if (batchStatus === 'submitting') {
    return present(<button data-testid="batch-simulate" disabled>Simulating…</button>);
  }
  if (batchStatus === 'success-clean') {
    const nextGameDay = batchResult?.nextDate;
    return present(<span>{batchResult?.simulated.length ?? 0} simulated · {nextGameDay ? `Next game day: ${nextGameDay}` : 'No later games scheduled'}</span>);
  }
  if (batchStatus === 'success-skipped') {
    const count = batchResult?.skipped.length ?? 0;
    return present(<span role="alert">{count} game{count === 1 ? '' : 's'} could not be simulated</span>);
  }
  if (batchStatus === 'error') {
    return present(
      <div>
        <span role="alert">Batch simulation failed.</span>
        <button onClick={runBatch}>Retry</button>
      </div>
    );
  }
  // @spec RSSUI-006 — disabled while the peer (rapid) control is submitting. (This
  // branch is only reached when batchStatus === 'idle'; submitting returns earlier.)
  return present(<button data-testid="batch-simulate" onClick={runBatch} disabled={disabled}>Simulate Today</button>);
};

export { BatchSimulateControl };
