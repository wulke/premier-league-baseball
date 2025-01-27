import Router from 'preact-router';
import { GameWorld, Home, League } from './pages';

const R = () => (
  <Router>
    <Home path='/' />
    <GameWorld path='/:gwId' />
    <League path='/:gwId/:leagueId' />
  </Router>
);

export default R;