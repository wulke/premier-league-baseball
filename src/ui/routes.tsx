import React from 'react';
import { Routes, Route } from 'react-router';
import { GameWorld, Home, League } from './pages';

const R = () => (
  <Routes>
    <Route index element={<Home />} />
    <Route path=":gwId" element={<GameWorld />} />
    <Route path=":gwId/:leagueId" element={<League />} />
  </Routes>
);

export default R;