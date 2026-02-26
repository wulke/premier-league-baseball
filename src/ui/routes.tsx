import React from 'react';
import { Routes, Route } from 'react-router';
import { GameWorld, Home, League, TeamCalendar } from './pages';

const R = () => (
  <Routes>
    <Route index element={<Home />} />
    <Route path=":gwId" element={<GameWorld />} />
    <Route path=":gwId/:leagueId" element={<League />} />
    <Route path=":gwId/:leagueId/team/:teamId/calendar" element={<TeamCalendar />} />
  </Routes>
);

export default R;
