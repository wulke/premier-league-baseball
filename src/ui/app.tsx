import React from 'react';
import { createRoot } from 'react-dom/client';
import Router from './routes';
import { BrowserRouter } from 'react-router';

const App = () => {
  return (
    <Router />
  );
};

const root = createRoot(document.getElementById('app'));
root.render(<BrowserRouter><App /></BrowserRouter>);