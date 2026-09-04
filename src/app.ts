import express, { type Express } from 'express';
import path from 'path';
import { router as ApiRouter } from './api/router';

// @spec SPAF-001,SPAF-002,SPAF-003
export const createApplication = (uiDirectory = path.resolve('dist/ui')): Express => {
  const app = express();
  app.use(express.json());

  // Static site assets must be served before the SPA entry document fallback.
  app.use('/', express.static(uiDirectory));
  // Declared APIs take precedence over both 404 boundaries and the SPA fallback.
  app.use('/', ApiRouter);
  // @spec SPAF-002 — do not convert an unknown API request into an SPA response.
  app.use('/api', (_req, res) => { res.sendStatus(404); });
  // @spec SPAF-001 — remaining GETs are client-side React Router paths.
  app.get('*', (_req, res) => { res.sendFile(path.resolve(uiDirectory, 'index.html')); });

  return app;
};
