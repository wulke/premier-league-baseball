// @spec SIMUI-009..SIMUI-018
import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useGameWorldContext } from '../context/game-world-context';

type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';
type BatchResult = { simulated: unknown[]; skipped: unknown[] };

// @spec SIMUI-009..SIMUI-018
const BatchSimulateControl = () => {
  const { gw, invalidate } = useGameWorldContext();
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const canBatch = Boolean(gw && gw.config?.inProgress && gw.currentDate);

  useEffect(() => {
    if (batchStatus !== 'success-clean') return undefined;
    const timer = setTimeout(() => setBatchStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [batchStatus]);

  const runBatch = () => {
    if (!gw) return;
    setBatchStatus('submitting');
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
        setBatchStatus(skipped.length === 0 ? 'success-clean' : 'success-skipped');
        invalidate();
      })
      .catch((err) => {
        console.error(err);
        setBatchStatus('error');
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
  return <button data-testid="batch-simulate" onClick={runBatch}>Simulate Today</button>;
};

export { BatchSimulateControl };
