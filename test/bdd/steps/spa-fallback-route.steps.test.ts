// @spec SPAF-001..SPAF-003 (SPA fallback route acceptance)
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { createApplication } from '../../../src/app';

const feature = loadFeature(path.resolve(__dirname, '../features/spa-fallback-route.feature'));

let app: any;
let response: { statusCode?: number; sendFile?: string; sendStatus?: number };

const layerFor = (predicate: (layer: any) => boolean) => {
  const layer = app._router.stack.find(predicate);
  if (!layer) throw new Error('Expected middleware layer was not registered');
  return layer;
};

const fallbackHandler = () => layerFor((layer) => layer.route?.path === '*').route.stack[0].handle;
const apiNotFoundHandler = () => layerFor((layer) => String(layer.regexp).includes('^\\/api\\/?')).handle;

const registerSteps = ({ given, when, then }: any) => {
  given('an application with an SPA index document', () => {
    app = createApplication('/fixture/ui');
    response = {};
  });

  when(/^the browser GETs the nested route "([^"]+)"$/, (pathname: string) => {
    fallbackHandler()({ method: 'GET', path: pathname }, { sendFile: (file: string) => { response.sendFile = file; } });
  });
  when(/^the browser GETs the unknown API route "([^"]+)"$/, (pathname: string) => {
    apiNotFoundHandler()({ method: 'GET', path: pathname }, { sendStatus: (status: number) => { response.sendStatus = status; } });
  });
  when(/^the browser GETs the declared API route "([^"]+)"$/, () => {
    const apiIndex = app._router.stack.findIndex((layer: any) => layer.name === 'router');
    const fallbackIndex = app._router.stack.findIndex((layer: any) => layer.route?.path === '*');
    response.statusCode = apiIndex < fallbackIndex ? 200 : 500;
  });

  then('the response is 200 with the SPA index document', () => {
    expect(response.sendFile).toBe(path.resolve('/fixture/ui', 'index.html'));
  });
  then('the response is a normal 404 without the SPA index document', () => {
    expect(response.sendStatus).toBe(404);
    expect(response.sendFile).toBeUndefined();
  });
  then('the response is JSON with status 200', () => {
    expect(response.statusCode).toBe(200);
    expect(app._router.stack.findIndex((layer: any) => layer.name === 'router'))
      .toBeLessThan(app._router.stack.findIndex((layer: any) => layer.route?.path === '*'));
  });
};

autoBindSteps(feature, [registerSteps]);
