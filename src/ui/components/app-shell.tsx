// @spec SHELL-001,SHELL-002,SHELL-011,RLDRUI-003
import { Outlet } from 'react-router';
import { useRevalidator } from 'react-router';
import { NavRail } from './nav-rail';

// @spec RLDRUI-003 — test-only hook: simulate an externally-triggered refresh of the gw loader.
const ShellInvalidateProbe = () => {
  const { revalidate } = useRevalidator();
  return (
    <button
      data-testid="shell-invalidate"
      onClick={revalidate}
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
};

// @spec SHELL-001,SHELL-002,SHELL-011
const AppShell = () => (
  <div data-testid="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
    <NavRail />
    <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto' }}>
      <ShellInvalidateProbe />
      <Outlet />
    </main>
  </div>
);

export { AppShell };
