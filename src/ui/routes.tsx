import Router from 'preact-router';
import { GameWorld, Home } from './pages';

const R = () => (
  <Router>
    <Home path='/' />
    <GameWorld path='/:gwId' />
  </Router>
);

export default R;