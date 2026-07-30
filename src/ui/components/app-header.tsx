// @spec:SIMUI-008..SIMUI-018 (Flow B — AppHeader: shared header + batch "Simulate Today").
//
// LLD: docs/llds/simulate-game-ui.md (Flow B). Rendered on every /:gwId page inside the
// GameWorldProvider subtree. Owns the batch-simulate state machine
// (idle/submitting/success-clean/success-skipped/error) and calls invalidate() on any 200
// response (SIMUI-015) so every context consumer re-fetches — not on error (SIMUI-018).
//
// Per #21 there is NO currentDate chip on this branch (display is deferred to a future
// left-pane nav); only the gw.currentDate *enablement guard* (SIMUI-009/011) remains, and the
// "Simulate Today" CTA is right-aligned (the seed of a future action-queue slot).
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { useGameWorldContext } from '../context/game-world-context';

type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';
type BatchResult = { simulated: unknown[]; skipped: unknown[] };

type AppHeaderProps = {
  // Breadcrumb target/label. Optional so AppHeader renders standalone inside the provider
  // (the SIMUI-009..018 specs mount <AppHeader /> with no props); pages pass their own crumb.
  backLink?: string;
  backLabel?: string;
  hideBatchControl?: boolean;
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  background: '#000',
  color: '#fff',
  border: '1px solid #000',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
};

const summaryStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#3a7d4d', fontWeight: 600 };
const warningStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#b8860b', fontWeight: 600 };

// @spec UI-003
const AppHeader = ({ backLink, backLabel, hideBatchControl = false }: AppHeaderProps) => {
  const { gw, invalidate } = useGameWorldContext();
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  // LLD u7 — short-circuit BEFORE dereferencing gw.config / gw.currentDate so a null gw
  // (fetch failure, SIMUI-005) never throws here. Express as gw && gw.config?.inProgress && …
  const canBatch = Boolean(gw && gw.config && gw.config.inProgress && gw.currentDate);

  // LLD u9 — the ~3s auto-dismiss timer is owned by this effect: it clears on unmount and on
  // any intervening status change, so a later error or navigation can't fire a stale setState.
  useEffect(() => {
    if (batchStatus !== 'success-clean') return undefined;
    const timer = setTimeout(() => setBatchStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [batchStatus]);

  const runBatch = () => {
    if (!gw) return;
    // SIMUI-012 — disable + relabel synchronously so the submitting state is visible before
    // the fetch resolves.
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
        // SIMUI-013 (skipped == 0 → clean summary + auto-dismiss) / SIMUI-014 (skipped > 0 →
        // persistent warning, button hidden).
        setBatchStatus(skipped.length === 0 ? 'success-clean' : 'success-skipped');
        invalidate(); // SIMUI-015 — invalidate on any 200 success (NOT on error: SIMUI-018).
      })
      .catch((err) => {
        console.error(err);
        setBatchStatus('error'); // SIMUI-016 — error region + Retry; no invalidate (SIMUI-018).
      });
  };

  const renderBatchRegion = () => {
    if (hideBatchControl) return null;
    // SIMUI-010/011 — no button when the guard fails. Other states (e.g. a persistent error or
    // warning) still render so the player isn't left without feedback.
    if (!canBatch && batchStatus === 'idle') return null;

    switch (batchStatus) {
      case 'submitting':
        return (
          <button data-testid="batch-simulate" disabled style={{ ...primaryBtn, opacity: 0.6, cursor: 'default' }}>
            Simulating…
          </button>
        );
      case 'success-clean':
        return (
          <span style={summaryStyle}>
            {batchResult?.simulated.length ?? 0} simulated · {batchResult?.skipped.length ?? 0} skipped
          </span>
        );
      case 'success-skipped': {
        const count = batchResult?.skipped.length ?? 0;
        return (
          <span role="alert" style={warningStyle}>
            {count} game{count === 1 ? '' : 's'} could not be simulated
          </span>
        );
      }
      case 'error':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span role="alert" style={{ color: '#c00', fontSize: '0.85rem' }}>
              Batch simulation failed.
            </span>
            <button
              onClick={runBatch}
              style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}
            >
              Retry
            </button>
          </div>
        );
      case 'idle':
      default:
        return (
          <button data-testid="batch-simulate" onClick={runBatch} style={primaryBtn}>
            Simulate Today
          </button>
        );
    }
  };

  return (
    <header
      data-testid="app-header"
      style={{
        borderBottom: '2px solid #000',
        padding: '14px 0',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {backLink && (
          <Link
            to={backLink}
            style={{ textDecoration: 'none', color: '#555', fontSize: '0.85rem', fontWeight: 500 }}
          >
            ← {backLabel}
          </Link>
        )}
        <span style={{ fontSize: '0.8rem', color: '#999' }}>Premier League Baseball</span>
      </div>
      <div>{renderBatchRegion()}</div>
    </header>
  );
};

export { AppHeader };
