// @spec SPAF-001..SPAF-003 (SPA fallback route acceptance)
import { mkdtemp, rm, writeFile } from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import { createApplication } from '../../../src/app';

const feature = loadFeature(path.resolve(__dirname, '../features/spa-fallback-route.feature'));
const spaDocument = '<!doctype html><title>Premier League Baseball</title>';

let uiDirectory: string;
let server: http.Server;
let response: { statusCode: number; body: string; contentType?: string };

const request = (pathname: string) => new Promise<void>((resolve, reject) => {
  const address = server.address();
  if (!address || typeof address === 'string') return reject(new Error('Test server has no TCP address'));

  http.get({ host: '127.0.0.1', port: address.port, path: pathname }, (result) => {
    let body = '';
    result.setEncoding('utf8');
    result.on('data', (chunk) => { body += chunk; });
    result.on('end', () => {
      response = { statusCode: result.statusCode ?? 0, body, contentType: result.headers['content-type'] };
      resolve();
    });
  }).on('error', reject);
});

const registerSteps = ({ given, when, then }: any) => {
  given('an application with an SPA index document', async () => {
    uiDirectory = await mkdtemp(path.join(os.tmpdir(), 'plb-spa-'));
    await writeFile(path.join(uiDirectory, 'index.html'), spaDocument);
    server = createApplication(uiDirectory).listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
  });

  when(/^the browser GETs the nested route "([^"]+)"$/, async (pathname: string) => request(pathname));
  when(/^the browser GETs the unknown API route "([^"]+)"$/, async (pathname: string) => request(pathname));
  when(/^the browser GETs the declared API route "([^"]+)"$/, async (pathname: string) => request(pathname));

  then('the response is 200 with the SPA index document', () => {
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(spaDocument);
  });
  then('the response is a normal 404 without the SPA index document', () => {
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toBe(spaDocument);
  });
  then('the response is JSON with status 200', () => {
    expect(response.statusCode).toBe(200);
    expect(response.contentType).toContain('application/json');
    expect(() => JSON.parse(response.body)).not.toThrow();
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await rm(uiDirectory, { recursive: true, force: true });
});

autoBindSteps(feature, [registerSteps]);
