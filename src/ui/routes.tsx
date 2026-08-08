import React from 'react';
import { Navigate, Routes, Route } from 'react-router';
import { GameWorld, Home, League, TeamCalendar, TeamHub, TeamRoster } from './pages';
import { AppShell } from './components/app-shell';

const R = () => (
  <Routes>
    {/* @spec SHELL-001,SHELL-002,SHELL-010 */}
    <Route element={<AppShell />}>
      <Route index element={<Home />} />
      <Route path=":gwId">
        <Route index element={<GameWorld />} />
        <Route path=":leagueId" element={<League />} />
        {/* @spec ROSTUI-006,ROSTUI-007 */}
        <Route path="team/:teamId" element={<TeamHub />}>
          <Route index element={<Navigate to="calendar" replace />} />
          <Route path="calendar" element={<TeamCalendar />} />
          <Route path="roster" element={<TeamRoster />} />
        </Route>
      </Route>
    </Route>
  </Routes>
);

export default R;
