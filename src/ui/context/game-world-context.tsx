// @spec:SIMUI-001..SIMUI-005 (Flow C — GameWorldProvider context).
//
// LLD: docs/llds/simulate-game-ui.md (Flow C). Owns the GameWorld (`gw`) state and a
// `refreshToken` invalidation counter for the /:gwId subtree: one GET /api/gameWorld/:gwId
// per session, shared across every consumer. The NavRail batch control reads `gw` + calls
// `invalidate()` on batch success; `TeamCalendar` (#25) reads `refreshToken` to re-fetch;
// the `GameWorld` page (#23) reads `gw` from here with no fetch of its own (SIMUI-004).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Endpoints } from '../../api/endpoints';

// `null` while loading OR after a fetch failure (SIMUI-005).
type GameWorldContextValue = {
  gw: any | null;
  refreshToken: number; // starts at 0; incremented by invalidate() (SIMUI-001/002)
  invalidate: () => void; // refreshToken++ → re-GET /api/gameWorld/:gwId (SIMUI-002/003)
};

const GameWorldContext = createContext<GameWorldContextValue | undefined>(undefined);

const GameWorldProvider = ({ gwId, children }: { gwId: string | undefined; children: React.ReactNode }) => {
  const [gw, setGw] = useState<any | null>(null);
  const [refreshToken, setRefreshToken] = useState<number>(0);

  useEffect(() => {
    // @spec SHELL-003
    if (!gwId) {
      setGw(null);
      return undefined;
    }
    // LLD u5 — a response from a superseded invalidate() re-fetch must not overwrite a fresher
    // `gw`; the cleanup flag discards any response once this run is cancelled.
    let cancelled = false;

    fetch(Endpoints.GetGameWorld.replace(':gwId', gwId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : null)) // non-200 → null (SIMUI-005)
      .then((data) => {
        if (!cancelled) setGw(data);
      })
      .catch(() => {
        if (!cancelled) setGw(null); // network failure → null (SIMUI-005)
      });

    return () => {
      cancelled = true;
    };
  }, [gwId, refreshToken]); // invalidate() bumps refreshToken → re-fetch (SIMUI-002/003)

  const invalidate = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const value = useMemo<GameWorldContextValue>(
    () => ({ gw, refreshToken, invalidate }),
    [gw, refreshToken, invalidate],
  );

  return <GameWorldContext.Provider value={value}>{children}</GameWorldContext.Provider>;
};

const useGameWorldContext = (): GameWorldContextValue => {
  const ctx = useContext(GameWorldContext);
  if (ctx === undefined) {
    // LLD u4 — explicit contract: the provider must wrap any consumer of this context.
    throw new Error('useGameWorldContext must be used within a GameWorldProvider');
  }
  return ctx;
};

export { GameWorldProvider, useGameWorldContext };
