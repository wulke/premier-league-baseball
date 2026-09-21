// @spec RLDRUI-001,RLDRUI-002,RLDRUI-004,RLDRUI-006 (LLD: docs/llds/shell/route-loader-foundation-ui.md)
import React from 'react';
import { createRoutesFromElements, Navigate, Route, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { GameWorld, Home, League, PlayerDetail, PreGamePrep, TeamCalendar, TeamHub, TeamLineupView, TeamRoster, Transfers } from './pages';
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

// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003,NAVLOAD-004,NAVLOAD-007
const readJson = async (url: string, request: Request, fallback: any) => {
  const response = await fetch(url, { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' }, signal: request.signal }).catch(() => null);
  return response?.ok ? response.json() : fallback;
};

// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003
const playerDetailLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const player = await readJson(Endpoints.GetPlayerDetail.replace(':playerId', params.playerId!), request, null);
  return player && !Array.isArray(player) ? player : null;
};
// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003
const teamRosterLoader = ({ params, request }: LoaderFunctionArgs) => readJson(Endpoints.GetTeamRoster.replace(':teamId', params.teamId!), request, []);
// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003,NAVLOAD-007
const teamCalendarLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const query = new URLSearchParams({ gwId: params.gwId! });
  const calendar = await readJson(`${Endpoints.GetTeamSchedule.replace(':teamId', params.teamId!)}?${query}`, request, null);
  return calendar ? { calendar, error: null } : { calendar: null, error: 'Unable to load team calendar right now.' };
};
// @spec NAVLOAD-007
const calendarShouldRevalidate = ({ currentParams, nextParams, defaultShouldRevalidate }: any) => currentParams.gwId !== nextParams.gwId || currentParams.teamId !== nextParams.teamId || defaultShouldRevalidate;
// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-004
const teamLineupLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const teamId = params.teamId!; const gwId = encodeURIComponent(params.gwId!);
  const [lineup, roster, nextGame] = await Promise.all([
    readJson(`${Endpoints.GetTeamLineup.replace(':teamId', teamId)}?gwId=${gwId}`, request, null),
    readJson(Endpoints.GetTeamRoster.replace(':teamId', teamId), request, []),
    readJson(`${Endpoints.GetNextTeamGameLineup.replace(':teamId', teamId)}?gwId=${gwId}`, request, null),
  ]);
  return { lineup, roster: Array.isArray(roster) ? roster : [], nextGame };
};
// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-004
const leagueLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const leagueId = params.leagueId!;
  const [league, standings, brackets] = await Promise.all([
    readJson(Endpoints.GetLeague.replace(':leagueId', leagueId), request, null),
    readJson(Endpoints.GetLeagueStandings.replace(':leagueId', leagueId), request, []),
    readJson(Endpoints.GetLeagueBracket.replace(':leagueId', leagueId), request, []),
  ]);
  return { league, standings: Array.isArray(standings) ? standings : [], brackets: Array.isArray(brackets) ? brackets : [] };
};
// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003
const transfersLoader = ({ params, request }: LoaderFunctionArgs) => readJson(Endpoints.GetFreeAgents.replace(':gwId', params.gwId!), request, []);
// @spec PREGAME-001,PREGAME-002,PREGAME-004 — calendar remains the game identity source; the
// route consequently cannot expose another club's game under the managed-club surface.
const preGamePrepLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const gwId = params.gwId!; const managedTeamId = (await gwLoader({ params, request } as LoaderFunctionArgs) as any)?.managedTeamId;
  if (managedTeamId == null) return { game: null, lineup: null, roster: [], opponentRoster: [], standings: [] };
  const schedule = await readJson(`${Endpoints.GetTeamSchedule.replace(':teamId', managedTeamId)}?${new URLSearchParams({ gwId, leagueId: params.leagueId! })}`, request, { games: [] });
  const game = Array.isArray(schedule?.games) ? schedule.games.find((candidate: any) => String(candidate.gameId) === params.gameId) ?? null : null;
  if (!game || game.status !== 'SCHEDULED') return { game: null, lineup: null, roster: [], opponentRoster: [], standings: [] };
  const opponentId = game.homeTeamId === managedTeamId ? game.awayTeamId : game.homeTeamId;
  const [lineup, roster, opponentRoster, standings] = await Promise.all([
    readJson(`${Endpoints.GetTeamLineup.replace(':teamId', managedTeamId)}?${new URLSearchParams({ gwId, gameId: params.gameId! })}`, request, null),
    readJson(`${Endpoints.GetTeamRoster.replace(':teamId', managedTeamId)}?gwId=${gwId}`, request, []),
    readJson(`${Endpoints.GetTeamRoster.replace(':teamId', opponentId)}?gwId=${gwId}`, request, []),
    readJson(Endpoints.GetLeagueStandings.replace(':leagueId', params.leagueId!), request, []),
  ]);
  return { game, lineup, roster: Array.isArray(roster) ? roster : [], opponentRoster: Array.isArray(opponentRoster) ? opponentRoster : [], standings: Array.isArray(standings) ? standings : [] };
};

// @spec RLDRUI-006 — one shared RouteObject[], consumed by createBrowserRouter (app) and
// createMemoryRouter (tests).
const routes: RouteObject[] = createRoutesFromElements(
  // @spec SHELL-001,SHELL-002,SHELL-010
  <Route element={<AppShell />}>
    <Route index element={<Home />} />
    <Route path=":gwId" id="gwId" loader={gwLoader}>
      <Route index element={<GameWorld />} />
      <Route path=":leagueId" element={<League />} loader={leagueLoader} />
      {/* @spec PREGAME-001,PREGAME-002,PREGAME-003,PREGAME-004 */}
      <Route path=":leagueId/game/:gameId" element={<PreGamePrep />} loader={preGamePrepLoader} />
      {/* @spec XFERUI-001,XFERUI-002,XFERUI-003,XFERUI-004,XFERUI-006 */}
      <Route path="transfers" element={<Transfers />} loader={transfersLoader} />
      {/* @spec PDETUI-001,PDETUI-002,PDETUI-003,PDETUI-004,PDETUI-005,PDETUI-006,PDETUI-007,PDETUI-008,PDETUI-009 */}
      <Route path="player/:playerId" element={<PlayerDetail />} loader={playerDetailLoader} />
      {/* @spec ROSTUI-006,ROSTUI-007,LINEUI-001 */}
      <Route path="team/:teamId" element={<TeamHub />}>
        <Route index element={<Navigate to="calendar" replace />} />
        <Route path="calendar" element={<TeamCalendar />} loader={teamCalendarLoader} shouldRevalidate={calendarShouldRevalidate} />
        <Route path="roster" element={<TeamRoster />} loader={teamRosterLoader} />
        {/* @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004 */}
        <Route path="lineup" element={<TeamLineupView />} loader={teamLineupLoader} />
      </Route>
    </Route>
  </Route>,
);

export default routes;
