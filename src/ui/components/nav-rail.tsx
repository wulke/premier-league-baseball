// @spec SHELL-004..SHELL-009
import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useGameWorldContext } from '../context/game-world-context';
import { BatchSimulateControl } from './batch-simulate-control';
import { RapidSimulateControl } from './rapid-simulate-control';

// @spec SIMUI-006
const formatCurrentDate = (currentDate: string) => {
  const [year, month, day] = currentDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
};

// @spec SHELL-004..SHELL-009, SIMUI-006,SIMUI-007
const NavRail = () => {
  const { gw } = useGameWorldContext();
  const { pathname } = useLocation();
  const { gwId, leagueId } = useParams();
  // @spec RSSUI-006 — shared busy flag so the batch + rapid controls can lock each other.
  const [simulateBusy, setSimulateBusy] = useState(false);
  const worldActive = Boolean(gwId && pathname === `/${gwId}`);
  const leagues = Array.isArray(gw?.Leagues) ? gw.Leagues : [];
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
          <div style={{ fontSize: '0.75rem', color: '#888' }}>WORLD</div>
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
          <div style={{ fontSize: '0.75rem', color: '#888' }}>COMPETITIONS</div>
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
      <section style={{ marginTop: 30, color: '#aaa' }} aria-disabled="true">
        <div data-testid="nav-fog-club">My Club</div>
        <div data-testid="nav-fog-roster">Roster</div>
        <div data-testid="nav-fog-transfers">Transfers</div>
      </section>
    </aside>
  );
};

export { NavRail };
