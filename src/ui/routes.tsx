// @spec RLDRUI-001,RLDRUI-002,RLDRUI-004,RLDRUI-006 (LLD: docs/llds/route-loader-foundation-ui.md)
import React from 'react';
import { createRoutesFromElements, Navigate, Route, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { GameWorld, Home, League, PlayerDetail, TeamCalendar, TeamHub, TeamLineupView, TeamRoster, Transfers } from './pages';
import { AppShell } from './components/app-shell';
import { Endpoints } from '../api/endpoints';

// @spec RLDRUI-001,RLDRUI-002,RLDRUI-004 — one shared fetch per :gwId, null on failure,
// cancelled via request.signal on a superseded navigation.
const gwLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const gwId = params.gwId!;
  const response = await fetch(Endpoints.GetGameWorld.replace(':gwId', gwId), {
    method: 'GET',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    signal: request.signal,
  }).catch(() => null);
  if (!response || !response.ok) return null;
  return response.json();
};

// @spec RLDRUI-006 — one shared RouteObject[], consumed by createBrowserRouter (app) and
// createMemoryRouter (tests).
const routes: RouteObject[] = createRoutesFromElements(
  // @spec SHELL-001,SHELL-002,SHELL-010
  <Route element={<AppShell />}>
    <Route index element={<Home />} />
    <Route path=":gwId" id="gwId" loader={gwLoader}>
      <Route index element={<GameWorld />} />
      <Route path=":leagueId" element={<League />} />
      {/* @spec XFERUI-001,XFERUI-002,XFERUI-003,XFERUI-004,XFERUI-006 */}
      <Route path="transfers" element={<Transfers />} />
      {/* @spec PDETUI-001,PDETUI-002,PDETUI-003,PDETUI-004,PDETUI-005,PDETUI-006,PDETUI-007,PDETUI-008,PDETUI-009 */}
      <Route path="player/:playerId" element={<PlayerDetail />} />
      {/* @spec ROSTUI-006,ROSTUI-007,LINEUI-001 */}
      <Route path="team/:teamId" element={<TeamHub />}>
        <Route index element={<Navigate to="calendar" replace />} />
        <Route path="calendar" element={<TeamCalendar />} />
        <Route path="roster" element={<TeamRoster />} />
        {/* @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004 */}
        <Route path="lineup" element={<TeamLineupView />} />
      </Route>
    </Route>
  </Route>,
);

export default routes;
