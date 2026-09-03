// @spec SPAF-001..SPAF-003 (SPA fallback route acceptance)
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import request, { type Response } from 'supertest';
import { createApplication } from '../../../src/app';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/spa-fallback-route.feature'));
const spaDocument = '<!doctype html><title>Premier League Baseball</title>';

let uiDirectory: string;
let app: ReturnType<typeof createApplication>;
let response: Response;

const registerSteps = ({ given, when, then }: any) => {
  given('an application with an SPA index document', async () => {
    uiDirectory = await mkdtemp(path.join(os.tmpdir(), 'plb-spa-'));
    await writeFile(path.join(uiDirectory, 'index.html'), spaDocument);
    app = createApplication(uiDirectory);
  });

  when(/^the browser GETs the nested route "([^"]+)"$/, async (pathname: string) => { response = await request(app).get(pathname); });
  when(/^the browser GETs the unknown API route "([^"]+)"$/, async (pathname: string) => { response = await request(app).get(pathname); });
  when(/^the browser GETs the declared API route "([^"]+)"$/, async (pathname: string) => { response = await request(app).get(pathname); });

  then('the response is 200 with the SPA index document', () => {
    expect(response.status).toBe(200);
    expect(response.text).toBe(spaDocument);
  });
  then('the response is a normal 404 without the SPA index document', () => {
    expect(response.status).toBe(404);
    expect(response.text).not.toBe(spaDocument);
  });
  then('the response is JSON with status 200', () => {
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(Array.isArray(response.body)).toBe(true);
  });
};

beforeEach(async () => { await db.sync({ force: true }); });
afterEach(async () => { await rm(uiDirectory, { recursive: true, force: true }); });

autoBindSteps(feature, [registerSteps]);
