import { render } from 'preact';
import Router from './routes';

const App = () => {
  return (
    <Router />
  );
};

render(<App />, document.getElementById('app'));