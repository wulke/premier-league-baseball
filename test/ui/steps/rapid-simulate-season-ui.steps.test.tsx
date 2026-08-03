// @spec RSSUI-001,RSSUI-002,RSSUI-003,RSSUI-004,RSSUI-005,RSSUI-006
// Acceptance bindings for the dev-only RapidSimulateControl (renders in the NavRail
// alongside the player-facing BatchSimulateControl). Both controls are mounted under
// one GameWorldProvider with a shared busy flag so RSSUI-006 cross-locking is exercised.
import React, { act } from 'react';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import path from 'path';
import { BatchSimulateControl } from '../../../src/ui/components/batch-simulate-control';
import { RapidSimulateControl } from '../../../src/ui/components/rapid-simulate-control';
import { GameWorldProvider } from '../../../src/ui/context/game-world-context';
import { render } from '../test-utils';

const feature = loadFeature(path.resolve(__dirname, '../features/rapid-simulate-season-ui.feature'));

type Deferred = { resolve: (response: unknown) => void };
type RapidResponse = { status: number; body: Record<string, unknown> };

const world = {
  gw: {} as Record<string, unknown>,
  calls: [] as Array<{ method: string; url: string }>,
  rapidDeferred: null as Deferred | null,
  batchDeferred: null as Deferred | null,
  mounted: false,
};

const resetWorld = () => {
  world.gw = { id: 1, currentDate: '2025-04-10', config: { inProgress: true }, devToolsEnabled: true };
  world.calls = [];
  world.rapidDeferred = null;
  world.batchDeferred = null;
  world.mounted = false;
};

const response = (status: number, body: Record<string, unknown>) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    world.calls.push({ method, url });
    if (method === 'GET' && /\/api\/gameWorld\/1$/.test(url)) return Promise.resolve(response(200, world.gw));
    if (method === 'POST' && /\/api\/gameWorld\/1\/rapid-simulate$/.test(url)) {
      return new Promise((resolve) => { world.rapidDeferred = { resolve }; });
    }
    if (method === 'POST' && /\/api\/gameWorld\/1\/simulate$/.test(url)) {
      return new Promise((resolve) => { world.batchDeferred = { resolve }; });
    }
    return Promise.resolve(response(200, {}));
  }) as jest.Mock;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

// Mirrors NavRail: both simulate controls under one provider, sharing a busy flag so
// they lock each other while either request is in flight (RSSUI-006).
const SimulateControlsMount = () => {
  const [busy, setBusy] = React.useState(false);
  return (
    <GameWorldProvider gwId="1">
      <BatchSimulateControl disabled={busy} onBusyChange={setBusy} />
      <RapidSimulateControl disabled={busy} onBusyChange={setBusy} />
    </GameWorldProvider>
  );
};

const mountControls = async () => {
  if (!world.mounted) {
    render(<SimulateControlsMount />);
    world.mounted = true;
  }
  await flush();
};

const resolveRapid = async (result: RapidResponse) => {
  world.rapidDeferred?.resolve(response(result.status, result.body));
  world.rapidDeferred = null;
  await flush();
};

const gameWorldGetCount = () => world.calls.filter((call) => call.method === 'GET' && /\/api\/gameWorld\/1$/.test(call.url)).length;

const registerSteps = ({ given, when, then }: any) => {
  given(/GameWorld page has loaded/, () => {});
  given(/devToolsEnabled is true/, () => { world.gw.devToolsEnabled = true; });
  given(/devToolsEnabled is false/, () => { world.gw.devToolsEnabled = false; });
  given("GameWorld 1's response has no devToolsEnabled field", () => { delete world.gw.devToolsEnabled; });
  given("GameWorld 1's config.inProgress is false", () => { (world.gw.config as Record<string, unknown>).inProgress = false; });

  then('the "Rapid Simulate Season" control is visible', async () => {
    await mountControls();
    expect(screen.getByTestId('rapid-simulate-season')).toBeVisible();
  });
  then('the "Rapid Simulate Season" control is not visible', async () => {
    await mountControls();
    expect(screen.queryByTestId('rapid-simulate-season')).toBeNull();
  });
  then('it is visually distinguished from the "Simulate Today" control', () => {
    expect(screen.getByTestId('rapid-simulate-season')).toHaveTextContent('DEV');
    expect(screen.getByTestId('rapid-simulate-season')).toHaveStyle({ borderStyle: 'dashed' });
  });

  const clickRapid = async () => {
    await mountControls();
    fireEvent.click(screen.getByTestId('rapid-simulate-season'));
    await flush();
  };
  when('the player clicks "Rapid Simulate Season"', clickRapid);
  then('the "Rapid Simulate Season" control is disabled', () => expect(screen.getByTestId('rapid-simulate-season')).toBeDisabled());
  then('it shows a submitting state', () => expect(screen.getByTestId('rapid-simulate-season')).toHaveTextContent('Simulating season…'));

  when(/^POST \/api\/gameWorld\/1\/rapid-simulate returns 200 with daysAdvanced (\d+), (\d+) simulated, and (\d+) skipped$/, async (days: string, simulated: string, skipped: string) => {
    await resolveRapid({ status: 200, body: { daysAdvanced: Number(days), simulated: Array(Number(simulated)).fill({}), skipped: Array(Number(skipped)).fill({}) } });
  });
  then(/^a summary showing "(\d+)" days advanced, "(\d+)" simulated, and "(\d+)" skipped is shown$/, (days: string, simulated: string, skipped: string) => {
    expect(screen.getByTestId('rapid-simulate-summary')).toHaveTextContent(new RegExp(`${days} days advanced.*${simulated} simulated.*${skipped} skipped`));
  });
  then('the GameWorld context is refreshed', () => expect(gameWorldGetCount()).toBe(2));

  when('POST /api/gameWorld/1/rapid-simulate returns a 422 error naming the blocking date', async () => {
    await resolveRapid({ status: 422, body: { error: 'A game on 2025-04-12 is still in progress' } });
  });
  then('an error region shows the blocking-date message', () => expect(screen.getByRole('alert')).toHaveTextContent('2025-04-12'));
  then('a "Retry" control is shown', () => expect(screen.getByRole('button', { name: /retry/i })).toBeVisible());
  then('the GameWorld context is not refreshed', () => expect(gameWorldGetCount()).toBe(1));
  given('the "Rapid Simulate Season" control shows an error after a failed attempt', async () => {
    await clickRapid();
    await resolveRapid({ status: 422, body: { error: 'A game on 2025-04-12 is still in progress' } });
  });
  when('the player clicks "Retry"', async () => {
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flush();
  });

  when('the rapid-simulate request has not yet resolved', () => {});
  then('the "Simulate Today" control is disabled', () => expect(screen.getByTestId('batch-simulate')).toBeDisabled());
  when('the player clicks "Simulate Today"', async () => {
    await mountControls();
    fireEvent.click(screen.getByTestId('batch-simulate'));
    await flush();
  });
  when('the batch-simulate request has not yet resolved', () => {});
};

beforeEach(() => { resetWorld(); installFetch(); });
afterEach(() => cleanup());
autoBindSteps(feature, [registerSteps]);
