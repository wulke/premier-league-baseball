import React from 'react';
import { Routes, Route } from 'react-router';
import { GameWorld, Home, League, TeamCalendar } from './pages';
import { AppShell } from './components/app-shell';

const R = () => (
  <Routes>
    {/* @spec SHELL-001,SHELL-002,SHELL-010 */}
    <Route element={<AppShell />}>
      <Route index element={<Home />} />
      <Route path=":gwId">
        <Route index element={<GameWorld />} />
        <Route path=":leagueId" element={<League />} />
        <Route path="team/:teamId/calendar" element={<TeamCalendar />} />
      </Route>
    </Route>
  </Routes>
);

export default R;
