// @spec SHELL-001,SHELL-002,RLDRUI-003
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

const AppShell = () => (
  <div data-testid="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
    <NavRail />
    <main style={{ flex: 1 }}>
      <ShellInvalidateProbe />
      <Outlet />
    </main>
  </div>
);

export { AppShell };
