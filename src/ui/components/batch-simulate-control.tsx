// @spec SIMUI-009..SIMUI-018,SCL-014
import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useGameWorldContext } from '../context/game-world-context';

type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';
type BatchResult = { simulated: unknown[]; skipped: unknown[] };

type BatchSimulateControlProps = {
  // Peer (rapid) control is in flight → lock this control (RSSUI-006).
  disabled?: boolean;
  // Tell the shared parent (NavRail) when THIS control enters/leaves submitting.
  onBusyChange?: (busy: boolean) => void;
};

// @spec SIMUI-009..SIMUI-018,SCL-014
const BatchSimulateControl = ({ disabled = false, onBusyChange }: BatchSimulateControlProps = {}) => {
  const { gw, invalidate } = useGameWorldContext();
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
        setBatchResult({ simulated, skipped });
        transition(skipped.length === 0 ? 'success-clean' : 'success-skipped');
        invalidate();
      })
      .catch((err) => {
        console.error(err);
        transition('error');
      });
  };

  if (!canBatch && batchStatus === 'idle') return null;
  if (batchStatus === 'submitting') {
    return <button data-testid="batch-simulate" disabled>Simulating…</button>;
  }
  if (batchStatus === 'success-clean') {
    return <span>{batchResult?.simulated.length ?? 0} simulated · {batchResult?.skipped.length ?? 0} skipped</span>;
  }
  if (batchStatus === 'success-skipped') {
    const count = batchResult?.skipped.length ?? 0;
    return <span role="alert">{count} game{count === 1 ? '' : 's'} could not be simulated</span>;
  }
  if (batchStatus === 'error') {
    return (
      <div>
        <span role="alert">Batch simulation failed.</span>
        <button onClick={runBatch}>Retry</button>
      </div>
    );
  }
  // @spec RSSUI-006 — disabled while the peer (rapid) control is submitting. (This
  // branch is only reached when batchStatus === 'idle'; submitting returns earlier.)
  return <button data-testid="batch-simulate" onClick={runBatch} disabled={disabled}>Simulate Today</button>;
};

export { BatchSimulateControl };
