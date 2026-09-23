// @spec:SIMUI-009..SIMUI-031, RLDRUI-006 (simulate-game UI acceptance).
// SIMUI-006/007 (currentDate chip display) are implemented in app-shell-ui.steps.test.tsx.
// Flow C (SIMUI-001..005) and SIMUI-015/018/027 are retired — GameWorldProvider is deleted;
// see test/ui/features/route-loader-foundation-ui.feature (RLDRUI-001/002/003/005).
// The @future Advance-Date scenario is excluded here via the `not @future` tag filter.
//
// Rendered through the real route tree (createMemoryRouter, per RLDRUI-006) so the batch
// control (in NavRail) and TeamCalendar/GameRow read gw from the :gwId loader exactly as
// they do in the app — no react-router param mock, no standalone GameWorldProvider mount.
import { act } from 'react-dom/test-utils';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { screen, fireEvent, cleanup, render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';
import path from 'path';

jest.setTimeout(30000);

const feature = loadFeature(path.resolve(__dirname, '../features/simulate-game-ui.feature'), {
  tagFilter: 'not @future',
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared step world
// ─────────────────────────────────────────────────────────────────────────────

interface BatchResponse {
  status: number;
  simulated: unknown[];
  skipped: { reason?: string }[];
  nextDate?: string | null;
  progressBlocked?: boolean;
}

interface SingleResponse {
  status: number;
  body: Record<string, unknown>;
}

interface FetchCall {
  method: string;
  url: string;
}

interface Deferred {
  resolve: (value: any) => void;
}

interface WorldState {
  // GameWorld payload served by GET /api/gameWorld/:gwId
  gw: Record<string, unknown>;
  gwFetchStatus: number;
  // Calendar games served by GET /api/team/:teamId/calendar
  games: Record<string, unknown>[];
  // Batch (AppHeader) response, staged by a "When POST returns …" step then handed to the
  // deferred below.
  batchResponse: BatchResponse;
  // Per-game single-simulate response, staged then handed to the per-game deferred.
  singleResponse: Record<number, SingleResponse>;
  // In-flight POST fetches held as deferreds: the "When POST returns …" steps resolve them
  // explicitly (after staging) so the component's .then() drains deterministically under
  // flush(). A pending promise avoids React 18's sync-act microtask-trapping, which otherwise
  // left the click-fired fetch chain un-drained.
  batchDeferred: Deferred | null;
  singleDeferred: Map<number, Deferred>;
  // Recorded outbound requests (assertions on re-fetch / no-duplicate-fetch)
  fetchCalls: FetchCall[];
  // What has been mounted this scenario (mount helpers are idempotent)
  mounted: 'none' | 'appheader' | 'calendar' | 'crossflow';
  // Cross-flow (SIMUI-027/028) calendar data after a batch-driven re-fetch
  calendarFetchCount: number;
  // Box-score payload exposed by the completed-game click-through regression.
  boxScores: Map<number, Record<string, unknown>>;
}

const createWorld = (): WorldState => ({
  gw: {
    id: 1,
    year: 2025,
    currentDate: '2025-04-10',
    config: { inProgress: true, name: 'Test World' },
    Leagues: [{ id: 1, config: { name: 'Test League', type: 'League' } }],
  },
  gwFetchStatus: 200,
  games: [],
  batchResponse: { status: 200, simulated: [{}], skipped: [] },
  singleResponse: {},
  batchDeferred: null,
  singleDeferred: new Map<number, Deferred>(),
  fetchCalls: [],
  mounted: 'none',
  calendarFetchCount: 0,
  boxScores: new Map(),
});

let world = createWorld();

// ─────────────────────────────────────────────────────────────────────────────
// fetch router — routes by URL/method and reads `world` lazily so that a step
// can stage a response (e.g. the "When POST returns …" steps) AFTER the action
// that issued the request, then flush to resolve it.
// ─────────────────────────────────────────────────────────────────────────────

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    world.fetchCalls.push({ method, url });

    const resolveWith = (status: number, body: unknown) => ({
      ok: status >= 200 && status < 400,
      status,
      json: () => Promise.resolve(body),
    });

    if (method === 'GET' && /\/api\/gameWorld\/\d+$/.test(url)) {
      // Clone so every fetch resolves to a new object identity, matching a real network
      // response's fresh JSON.parse — several consumers (e.g. TeamCalendar's RLDRUI-005
      // bridge) key a dependency on this object's reference, not a deep-equality check.
      return Promise.resolve(resolveWith(world.gwFetchStatus, { ...world.gw }));
    }
    if (method === 'POST' && /\/api\/gameWorld\/\d+\/simulate$/.test(url)) {
      // Deferred: stays pending until a "When POST returns …" step calls resolveBatch() (after
      // staging world.batchResponse), so the staged response is what the component sees when
      // flush() drains the .then() chain. See the Deferred notes in WorldState.
      return new Promise((resolve) => {
        world.batchDeferred = { resolve };
      });
    }
    if (method === 'POST' && /\/api\/game\/(\d+)\/simulate$/.test(url)) {
      const gameId = Number(url.match(/\/api\/game\/(\d+)\/simulate$/)![1]);
      return new Promise((resolve) => {
        world.singleDeferred.set(gameId, { resolve });
      });
    }
    if (method === 'GET' && /\/api\/team\/\d+\/calendar/.test(url)) {
      world.calendarFetchCount += 1;
      return Promise.resolve(
        resolveWith(200, { teamId: 1, teamName: 'Test Team', year: 2025, games: world.games }),
      );
    }
    if (method === 'GET' && /\/api\/game\/\d+$/.test(url)) {
      const gameId = Number(url.match(/\/api\/game\/(\d+)$/)![1]);
      return Promise.resolve(resolveWith(200, world.boxScores.get(gameId) ?? {}));
    }
    // League / standings / other: benign defaults so SIMUI-008 page renders don't crash.
    if (method === 'GET' && /\/api\/league\/\d+$/.test(url)) {
      return Promise.resolve(resolveWith(200, { id: 1, config: { name: 'Test League' }, gameWorldId: 1 }));
    }
    if (method === 'GET' && /\/api\/league\/\d+\/standings/.test(url)) {
      return Promise.resolve(resolveWith(200, []));
    }
    return Promise.resolve(resolveWith(200, {}));
  }) as jest.Mock;
};

const countCalls = (method: string, pattern: RegExp) =>
  world.fetchCalls.filter((c) => c.method === method && pattern.test(c.url)).length;

// Resolve the in-flight POST deferreds with the staged response. Called by the "When POST
// returns …" steps AFTER they stage world.batchResponse / world.singleResponse[gameId].
const resolveBatch = () => {
  const d = world.batchDeferred;
  if (!d) return;
  const r = world.batchResponse;
  d.resolve({ ok: r.status >= 200 && r.status < 400, status: r.status, json: () => Promise.resolve({ simulated: r.simulated, skipped: r.skipped, nextDate: r.nextDate, progressBlocked: r.progressBlocked }) });
  world.batchDeferred = null;
};

const resolveSingle = (gameId: number) => {
  const d = world.singleDeferred.get(gameId);
  if (!d) return;
  const r = world.singleResponse[gameId] ?? { status: 200, body: { status: 'COMPLETED', homeTeamResult: 5, awayTeamResult: 2 } };
  d.resolve({ ok: r.status >= 200 && r.status < 400, status: r.status, json: () => Promise.resolve(r.body) });
  world.singleDeferred.delete(gameId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Mount helpers — idempotent within a scenario. `world.mounted` guards re-render.
// Rendered through the real route tree: NavRail (and its BatchSimulateControl) is always
// present alongside whichever page is open, so a GameWorld-route mount and a
// TeamCalendar-route mount both give the batch button + the page-specific UI.
// ─────────────────────────────────────────────────────────────────────────────

const flush = async (ms = 0) => {
  await act(async () => {
    await Promise.resolve();
    // allow chained .then handlers (fetch → setState) to drain
    await Promise.resolve();
    if (ms > 0) {
      try {
        const jestWithTimers = jest as unknown as { advanceTimersByTimeAsync?: (t: number) => Promise<void> };
        if (typeof jestWithTimers.advanceTimersByTimeAsync === 'function') {
          await jestWithTimers.advanceTimersByTimeAsync(ms);
        }
      } catch {
        /* timers not fake — no-op */
      }
    }
  });
};

const mountAt = (entry: string, kind: WorldState['mounted']) => {
  if (world.mounted !== 'none') return;
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [entry] })} />);
  world.mounted = kind;
};

const ensureAppHeader = async () => {
  mountAt('/1', 'appheader');
  await flush();
};

const ensureCalendar = async () => {
  mountAt('/1/team/1/calendar', 'calendar');
  await flush();
};

const ensureCrossFlow = async () => {
  // NavRail (with BatchSimulateControl) renders on every /:gwId page, so the TeamCalendar
  // route alone gives the cross-flow scenarios both the batch button and the per-row
  // simulate UI they need.
  mountAt('/1/team/1/calendar', 'crossflow');
  await flush();
};

const batchButton = () => screen.getByTestId('batch-simulate');

// ─────────────────────────────────────────────────────────────────────────────
// Step bindings
// ─────────────────────────────────────────────────────────────────────────────

const registerSteps = ({ given, when, then }: any) => {
  // ── Background ─────────────────────────────────────────────────────────────
  given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, (id: string, year: string, currentDate: string) => {
    world.gw = { ...world.gw, id: Number(id), year: Number(year), currentDate, config: { ...(world.gw.config as object), inProgress: true } };
  });

  given(/^teams, a League, a Division, and a DivisionSeason exist in GameWorld (\d+)$/, () => {
    /* backend state is irrelevant under the fetch mock — no-op */
  });

  given(/^the player is viewing a page scoped to GameWorld (\d+)$/, () => {
    /* contextual framing only — no-op */
  });

given(/^gw\.config\.inProgress is (true|false)$/, (flag: string) => {
    (world.gw.config as Record<string, unknown>).inProgress = flag === 'true';
  });

  given(/^gw\.currentDate is "([^"]+)"$/, (currentDate: string) => {
    (world.gw as Record<string, unknown>).currentDate = currentDate;
  });

  given('gw.currentDate is null', () => {
    (world.gw as Record<string, unknown>).currentDate = null;
  });

  // @spec SIMUI-029/030/031
  given(/^the managed team is team (\d+)$/, (teamId: string) => {
    (world.gw as Record<string, unknown>).managedTeamId = Number(teamId);
  });

  when('AppHeader renders', async () => {
    await ensureAppHeader();
  });

  // "the 'Simulate Today' button is visible and enabled" — shared by SIMUI-009 (Then) and
  // SIMUI-012 (Given). autoBindSteps matches by text only (keyword is ignored), so the step is
  // registered ONCE; the handler both mounts and asserts, covering both uses.
  const assertBatchButtonVisibleEnabled = async () => {
    await ensureAppHeader();
    const btn = batchButton();
    expect(btn).toBeInTheDocument();
    expect(btn).toBeEnabled();
  };
  then('the "Simulate Today" button is visible and enabled', assertBatchButtonVisibleEnabled);

  then('the "Simulate Today" button is not visible', () => {
    expect(screen.queryByTestId('batch-simulate')).toBeNull();
  });

  // "the player clicks 'Simulate Today'" — shared by SIMUI-012 (When) and SIMUI-013..#18
  // (Given). Registered ONCE (autoBindSteps matches by text only, keyword ignored).
  const clickBatch = async () => {
    await ensureAppHeader();
    // fireEvent already wraps in act; an extra sync act(...) here traps the fetch microtasks so
    // a later flush() can't drain them (React 18), so click directly.
    fireEvent.click(batchButton());
  };
  given('the player clicks "Simulate Today"', clickBatch);

  then('the button is disabled', () => {
    expect(batchButton()).toBeDisabled();
  });

  then(/^the button label changes to "([^"]+)"$/, (label: string) => {
    expect(batchButton()).toHaveTextContent(label);
  });

  when(/^POST \/api\/gameWorld\/(\d+)\/simulate returns 200 with simulated (\d+) games? and skipped (\d+)$/, async (_id: string, simulated: string, skipped: string) => {
    world.batchResponse = {
      status: 200,
      simulated: Array.from({ length: Number(simulated) }, () => ({})),
      skipped: Array.from({ length: Number(skipped) }, () => ({ reason: 'game in progress' })),
      progressBlocked: Number(skipped) > 0,
    };
    // SIMUI-013 relies on the ~3s auto-dismiss timer — switch to fake timers BEFORE
    // flushing so the component schedules that timer under the fake clock.
    if (Number(skipped) === 0) jest.useFakeTimers();
    resolveBatch();
    await flush();
  });

  then(/^a summary "([^"]+)" is briefly shown$/, (summary: string) => {
    expect(screen.getByText(new RegExp(escapeRegExp(summary)))).toBeInTheDocument();
  });

  then('the summary auto-dismisses after approximately 3 seconds', async () => {
    const before = screen.queryByText(/simulated/i);
    expect(before).not.toBeNull();
    await flush(3000);
    expect(screen.queryByText(/simulated/i)).toBeNull();
  });

  then('the "Simulate Today" button returns to its idle enabled state', () => {
    expect(batchButton()).toBeEnabled();
  });

  then(/^a warning indicating (\d+) games? could not be simulated is shown$/, (count: string) => {
    expect(screen.getByText(new RegExp(`${count}.*could not be simulated`, 'i'))).toBeInTheDocument();
  });

  then('the warning does not auto-dismiss', () => {
    // No timer-driven dismissal for the skipped-warning path; presence is sufficient.
    expect(screen.getByText(/could not be simulated/i)).toBeInTheDocument();
  });

  then('the "Simulate Today" button is not shown while the warning is active', () => {
    expect(screen.queryByTestId('batch-simulate')).toBeNull();
  });

  // @spec SIMUI-029
  when(/^POST \/api\/gameWorld\/(\d+)\/simulate returns 200 with simulated (\d+) games?, skipped (\d+) future games?, and nextDate "([^"]+)"$/, async (_id: string, simulated: string, skipped: string, nextDate: string) => {
    world.batchResponse = {
      status: 200,
      simulated: Array.from({ length: Number(simulated) }, () => ({})),
      skipped: Array.from({ length: Number(skipped) }, () => ({ reason: 'future date' })),
      nextDate,
      progressBlocked: false,
    };
    jest.useFakeTimers();
    resolveBatch();
    await flush();
  });

  // @spec SIMUI-029
  then('no warning indicating games could not be simulated is shown', () => {
    expect(screen.queryByText(/could not be simulated/i)).toBeNull();
  });

  when(/^POST \/api\/gameWorld\/(\d+)\/simulate returns a server error$/, async () => {
    world.batchResponse = { status: 500, simulated: [], skipped: [] };
    resolveBatch();
    await flush();
  });

  then('an error message is shown in the header', () => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  then('a "Retry" button is visible', () => {
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  given('batch simulation has failed and the Retry button is visible', async () => {
    await ensureAppHeader();
    await clickBatch();
    world.batchResponse = { status: 500, simulated: [], skipped: [] };
    resolveBatch();
    await flush();
  });

  when('the player clicks "Retry"', async () => {
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flush();
  });

  then(/^the header returns to the "([^"]+)" disabled state$/, (label: string) => {
    const btn = batchButton();
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(label);
  });

  then(/^POST \/api\/gameWorld\/(\d+)\/simulate is requested again$/, (_id: string) => {
    expect(countCalls('POST', /\/api\/gameWorld\/\d+\/simulate$/)).toBeGreaterThanOrEqual(2);
  });

  // ── Flow A: TeamCalendar / GameRow (SIMUI-019..028) ────────────────────────
  given(/^a Game exists with status "([^"]+)" and scheduledDate "([^"]+)"$/, (status: string, scheduledDate: string) => {
    world.games.push(makeGame({ status, scheduledDate }));
  });

  given(/^a Game exists with status "COMPLETED" with homeTeamResult (\d+) and awayTeamResult (\d+)$/, (home: string, away: string) => {
    world.games.push(makeGame({ status: 'COMPLETED', homeTeamResult: Number(home), awayTeamResult: Number(away) }));
  });

  // @spec SIMUI-031, PREGAME-005 — null scheduledDate is ready regardless of currentDate
  given(/^a Game exists with status "([^"]+)" and no scheduledDate$/, (status: string) => {
    world.games.push(makeGame({ status, scheduledDate: null }));
  });

  when('the TeamCalendar renders the GameRow for that game', async () => {
    await ensureCalendar();
  });

  then('a "Simulate" button is visible on the game row', () => {
    expect(screen.queryAllByTestId(/^simulate-\d+$/)[0]).toBeInTheDocument();
  });

  then('no "Simulate" button is visible on the game row', () => {
    expect(screen.queryAllByTestId(/^simulate-\d+$/)).toHaveLength(0);
  });

  then(/^the score "([^"]+)" is displayed$/, (score: string) => {
    expect(screen.queryAllByTestId(/^score-\d+$/).some((el) => el.textContent?.replace(/\s/g, '').includes(score.replace(/\s/g, '')))).toBe(true);
  });

  then('a status indicator is displayed instead', () => {
    expect(screen.queryAllByTestId(/^status-\d+$/)[0]).toBeInTheDocument();
  });

  // @spec SIMUI-029/030/031
  then('a game screen link is visible on the game row', () => {
    expect(screen.queryAllByTestId(/^game-link-\d+$/)[0]).toBeInTheDocument();
  });

  // @spec SIMUI-030
  then('no game screen link is visible on the game row', () => {
    expect(screen.queryAllByTestId(/^game-link-\d+$/)).toHaveLength(0);
  });

  // @spec SIMUI-031
  then(/^the game screen link is labeled "([^"]+)"$/, (label: string) => {
    expect(screen.queryAllByTestId(/^game-link-\d+$/)[0]).toHaveTextContent(label);
  });

  // @spec SIMUI-029
  given('GET /api/game for that completed game returns a box score', () => {
    const game = world.games.at(-1)!;
    world.boxScores.set(Number(game.gameId), {
      id: game.gameId,
      home: { teamId: 1, teamName: 'Home Team', score: 6, players: [] },
      away: { teamId: 2, teamName: 'Away Team', score: 2, players: [] },
    });
  });

  // @spec SIMUI-029
  when('the player clicks the completed game\'s "Review" link', async () => {
    fireEvent.click(screen.getByTestId(`game-link-${world.games.at(-1)!.gameId}`));
    await flush();
  });

  // @spec SIMUI-029
  then('the completed game\'s box score is shown', async () => {
    expect(await screen.findByTestId('game-box-score')).toBeInTheDocument();
  });

  given(/^a "Simulate" button is visible for game (\d+)$/, async (gameId: string) => {
    world.games = [makeGame({ gameId: Number(gameId), status: 'SCHEDULED', scheduledDate: '2025-04-10' })];
    await ensureCalendar();
  });

  when(/^the player clicks "Simulate" on game (\d+)$/, (gameId: string) => {
    fireEvent.click(screen.getByTestId(`simulate-${gameId}`));
  });

  then('the "Simulate" button is replaced by a loading spinner', () => {
    expect(screen.queryAllByTestId(/^simulate-\d+$/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^spinner-\d+$/)[0]).toBeInTheDocument();
  });

  then('the spinner is shown while the request is in flight', () => {
    expect(screen.queryAllByTestId(/^spinner-\d+$/)[0]).toBeInTheDocument();
  });

  given(/^the player has clicked "Simulate" on game (\d+)$/, async (gameId: string) => {
    world.games = [makeGame({ gameId: Number(gameId), status: 'SCHEDULED', scheduledDate: '2025-04-10' })];
    await ensureCalendar();
    fireEvent.click(screen.getByTestId(`simulate-${gameId}`));
  });

  when(/^POST \/api\/game\/(\d+)\/simulate returns status "COMPLETED" with homeTeamResult (\d+) and awayTeamResult (\d+)$/, async (gameId: string, home: string, away: string) => {
    world.singleResponse[Number(gameId)] = {
      status: 200,
      body: { status: 'COMPLETED', homeTeamResult: Number(home), awayTeamResult: Number(away) },
    };
    resolveSingle(Number(gameId));
    await flush();
  });

  then('the loading spinner is removed', () => {
    expect(screen.queryAllByTestId(/^spinner-\d+$/)).toHaveLength(0);
  });

  then(/^the score "([^"]+)" is displayed in the game row$/, (score: string) => {
    expect(screen.queryAllByTestId(/^score-\d+$/).some((el) => el.textContent?.replace(/\s/g, '').includes(score.replace(/\s/g, '')))).toBe(true);
  });

  then(/^no "Simulate" button is shown for game (\d+)$/, (gameId: string) => {
    expect(screen.queryByTestId(`simulate-${gameId}`)).toBeNull();
  });

  given(/^games (\d+) and (\d+) both show "Simulate" buttons$/, async (a: string, b: string) => {
    world.games = [
      makeGame({ gameId: Number(a), status: 'SCHEDULED', scheduledDate: '2025-04-10' }),
      makeGame({ gameId: Number(b), status: 'SCHEDULED', scheduledDate: '2025-04-11' }),
    ];
    await ensureCalendar();
  });

  when(/^the player simulates game (\d+) successfully$/, async (gameId: string) => {
    world.singleResponse[Number(gameId)] = {
      status: 200,
      body: { status: 'COMPLETED', homeTeamResult: 4, awayTeamResult: 3 },
    };
    fireEvent.click(screen.getByTestId(`simulate-${gameId}`));
    resolveSingle(Number(gameId));
    await flush();
  });

  then(/^game (\d+) still shows its "Simulate" button unchanged$/, (gameId: string) => {
    expect(screen.getByTestId(`simulate-${gameId}`)).toBeInTheDocument();
  });

  when(/^POST \/api\/game\/(\d+)\/simulate returns a 4xx error$/, async (gameId: string) => {
    world.singleResponse[Number(gameId)] = { status: 422, body: { error: 'Unprocessable' } };
    resolveSingle(Number(gameId));
    await flush();
  });

  then(/^an error icon is shown on the game row for game (\d+)$/, (gameId: string) => {
    expect(screen.getByTestId(`error-${gameId}`)).toBeInTheDocument();
  });

  then('the score is not changed', () => {
    // No score rendered for a still-SCHEDULED game that failed to simulate.
    expect(screen.queryAllByTestId(/^score-\d+$/)).toHaveLength(0);
  });

  given(/^simulation of game (\d+) has failed and shows an error icon$/, async (gameId: string) => {
    world.games = [makeGame({ gameId: Number(gameId), status: 'SCHEDULED', scheduledDate: '2025-04-10' })];
    await ensureCalendar();
    fireEvent.click(screen.getByTestId(`simulate-${gameId}`));
    world.singleResponse[Number(gameId)] = { status: 422, body: { error: 'Unprocessable' } };
    resolveSingle(Number(gameId));
    await flush();
  });

  then('the error icon remains visible until the player navigates away or the calendar re-fetches', () => {
    expect(screen.queryAllByTestId(/^error-\d+$/)[0]).toBeInTheDocument();
  });

  then('no retry button is shown on the game row', () => {
    expect(screen.queryAllByRole('button', { name: /retry/i })).toHaveLength(0);
  });

  // ── Cross-flow: batch (nav rail) → TeamCalendar refresh (SIMUI-028) ─────────
  // SIMUI-027's own scenario is retired (see route-loader-foundation-ui.feature RLDRUI-005);
  // this remaining step covers SIMUI-028 (updated score/button state after the re-fetch).
  given(/^game (\d+) is showing a "Simulate" button on the TeamCalendar$/, async (gameId: string) => {
    world.games = [makeGame({ gameId: Number(gameId), status: 'SCHEDULED', scheduledDate: '2025-04-10' })];
    await ensureCrossFlow();
  });

  when('the player clicks "Simulate Today" in the AppHeader and batch simulation completes', async () => {
    world.batchResponse = { status: 200, simulated: [makeGame({ gameId: 42 })], skipped: [] };
    world.games = world.games.map((g) => (g.gameId === 42 ? { ...g, status: 'COMPLETED', homeTeamResult: 6, awayTeamResult: 2 } : g));
    fireEvent.click(batchButton());
    resolveBatch();
    await flush();
  });

  then('the TeamCalendar re-fetches its game list', async () => {
    await waitFor(() => expect(world.calendarFetchCount).toBeGreaterThanOrEqual(2));
  });

  then(/^game (\d+) no longer shows a "Simulate" button$/, (gameId: string) => {
    expect(screen.queryByTestId(`simulate-${gameId}`)).toBeNull();
  });

  then(/^game (\d+) displays its simulated score$/, (gameId: string) => {
    expect(screen.getByTestId(`score-${gameId}`)).toBeInTheDocument();
  });

  // ── @future — validation-only no-ops ───────────────────────────────────────
  // This scenario is EXCLUDED from execution by the `not @future` tag filter.
  // jest-cucumber's `stepsMustMatchFeatureFile` validation runs on every
  // scenario regardless of the tag skip, so these handlers exist solely to satisfy
  // that check. They never execute. Do not implement behaviour here.
  given('batch simulation completed with 1 skipped game', () => {});
  given('the warning banner is active', () => {});
  when('the player attempts to advance the GameWorld date', () => {});
  then('the Advance Date action is disabled', () => {});
  then('a message indicates unresolved games must be simulated first', () => {});
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers + lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nextGameId = (() => {
  let n = 100;
  return () => ++n;
})();

const makeGame = (overrides: Partial<Record<string, unknown>> & { gameId?: number }): Record<string, unknown> => ({
  gameId: overrides.gameId ?? nextGameId(),
  scheduledDate: '2025-04-10',
  homeTeamId: 1,
  homeTeamName: 'Home Team',
  awayTeamId: 2,
  awayTeamName: 'Away Team',
  divisionId: 1,
  divisionName: 'Test Division',
  leagueId: 1,
  leagueName: 'Test League',
  roundLabel: null,
  homeTeamResult: null,
  awayTeamResult: null,
  status: 'SCHEDULED',
  ...overrides,
});

beforeEach(() => {
  world = createWorld();
  installFetch();
});

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

autoBindSteps(feature, [registerSteps]);
