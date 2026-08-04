// @spec SHELL-001,SHELL-002
import React from 'react';
import { Outlet, useParams } from 'react-router';
import { GameWorldProvider, useGameWorldContext } from '../context/game-world-context';
import { NavRail } from './nav-rail';

const ShellInvalidateProbe = () => {
  const { invalidate } = useGameWorldContext();
  return (
    <button
      data-testid="shell-invalidate"
      onClick={invalidate}
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
};

const AppShell = () => {
  const { gwId } = useParams();
  return (
    <GameWorldProvider gwId={gwId}>
      <div data-testid="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
        <NavRail />
        <main style={{ flex: 1 }}>
          <ShellInvalidateProbe />
          <Outlet />
        </main>
      </div>
    </GameWorldProvider>
  );
};

export { AppShell };
