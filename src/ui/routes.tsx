import React from 'react';
import { Routes, Route, Outlet, useParams } from 'react-router';
import { GameWorld, Home, League, TeamCalendar } from './pages';
import { GameWorldProvider } from './context/game-world-context';

// Layout route (LLD u8): mounts GameWorldProvider once for the whole /:gwId subtree so every
// descendant page shares one GET /api/gameWorld/:gwId and the refreshToken invalidation counter.
const GameWorldLayout = () => {
  const { gwId } = useParams();
  return (
    <GameWorldProvider gwId={gwId!}>
      <Outlet />
    </GameWorldProvider>
  );
};

const R = () => (
  <Routes>
    <Route index element={<Home />} />
    <Route path=":gwId" element={<GameWorldLayout />}>
      <Route index element={<GameWorld />} />
      <Route path=":leagueId" element={<League />} />
      <Route path=":leagueId/team/:teamId/calendar" element={<TeamCalendar />} />
    </Route>
  </Routes>
);

export default R;
