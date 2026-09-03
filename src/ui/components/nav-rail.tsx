// @spec SHELL-004..SHELL-009
import React, { useState } from 'react';
import { Link, useLocation, useParams, useRouteLoaderData } from 'react-router';
import { BatchSimulateControl } from './batch-simulate-control';
import { RapidSimulateControl } from './rapid-simulate-control';
import { SectionLabel } from './ui';

// @spec SIMUI-006
const formatCurrentDate = (currentDate: string) => {
  const [year, month, day] = currentDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
};

// @spec MCLUI-004 — the claimed trio's link style: legible (not dimmed) but distinct from the
// WORLD/COMPETITIONS links, signalling these are manager-scoped redirects.
const managedLinkStyle: React.CSSProperties = {
  color: '#222',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'block',
  padding: '6px 0',
};

// @spec SHELL-004..SHELL-009, SIMUI-006,SIMUI-007
const NavRail = () => {
  // @spec RLDRUI-001 — gw comes from the :gwId route's loader; undefined on Home (no match).
  const gw = useRouteLoaderData('gwId') as any;
  const { pathname } = useLocation();
  const { gwId, leagueId } = useParams();
  // @spec RSSUI-006 — shared busy flag so the batch + rapid controls can lock each other.
  const [simulateBusy, setSimulateBusy] = useState(false);
  const worldActive = Boolean(gwId && pathname === `/${gwId}`);
  const leagues = Array.isArray(gw?.Leagues) ? gw.Leagues : [];
  // @spec MCLUI-004,MCLUI-005 — the managed-club trio lights up only when a club is claimed.
  const managedTeamId = gw?.managedTeamId;
  const claimed = managedTeamId != null;
  const linkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? '#000' : '#666',
    fontWeight: active ? 700 : 500,
    textDecoration: 'none',
    display: 'block',
    padding: '6px 0',
  });

  return (
    <aside data-testid="nav-rail" style={{ width: 220, padding: 20, borderRight: '1px solid #ddd' }}>
      <div data-testid="nav-mark" style={{ fontWeight: 800, marginBottom: 20 }}>
        Premier League Baseball
      </div>
      <Link data-testid="nav-home" data-active={pathname === '/' ? 'true' : 'false'} to="/" style={linkStyle(pathname === '/')}>
        HOME
      </Link>
      {gw && (
        <section data-testid="nav-world" style={{ marginTop: 22 }}>
          <SectionLabel as="div">WORLD</SectionLabel>
          <Link data-testid="nav-world-link" data-active={worldActive ? 'true' : 'false'} to={`/${gwId}`} style={linkStyle(worldActive)}>
            {gw.config?.name ?? `Game World ${gwId}`}
          </Link>
          {/* @spec SIMUI-006,SIMUI-007 */}
          <span data-testid="nav-current-date" style={{ display: 'block', color: '#888', fontSize: '0.85rem', margin: '4px 0 10px' }}>
            {gw.currentDate ? formatCurrentDate(gw.currentDate) : 'No date set'}
          </span>
          <BatchSimulateControl disabled={simulateBusy} onBusyChange={setSimulateBusy} />
          <RapidSimulateControl disabled={simulateBusy} onBusyChange={setSimulateBusy} />
        </section>
      )}
      {gw && leagues.length > 0 && (
        <section data-testid="nav-competitions" style={{ marginTop: 22 }}>
          <SectionLabel as="div">COMPETITIONS</SectionLabel>
          {leagues.map((league: any) => {
            const active = String(league.id) === leagueId;
            return (
              <Link key={league.id} data-testid={`nav-league-${league.id}`} data-active={active ? 'true' : 'false'} to={`/${gwId}/${league.id}`} style={linkStyle(active)}>
                {league.config?.name ?? `League ${league.id}`}
              </Link>
            );
          })}
        </section>
      )}
      <section style={{ marginTop: 30, color: '#aaa' }} aria-disabled={claimed ? undefined : 'true'}>
        {claimed ? (
          <>
            {/* @spec MCLUI-004 — redirects to the symmetric team hub/roster from map #135. */}
            <Link data-testid="nav-managed-club" to={`/${gwId}/team/${managedTeamId}`} style={managedLinkStyle}>My Club</Link>
            <Link data-testid="nav-managed-roster" to={`/${gwId}/team/${managedTeamId}/roster`} style={managedLinkStyle}>Roster</Link>
            {/* @spec XFERUI-001 — the Transfers surface now exists (#237); lit only once a club is claimed. */}
            <Link data-testid="nav-managed-transfers" to={`/${gwId}/transfers`} style={managedLinkStyle}>Transfers</Link>
          </>
        ) : (
          <>
            {/* @spec MCLUI-005 — null state: trio unchanged, no affordance. */}
            <div data-testid="nav-fog-club">My Club</div>
            <div data-testid="nav-fog-roster">Roster</div>
            <div data-testid="nav-fog-transfers">Transfers</div>
          </>
        )}
      </section>
    </aside>
  );
};

export { NavRail };
