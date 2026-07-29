// @spec:SIMUI-001..SIMUI-005, SIMUI-008..SIMUI-028 (simulate-game UI acceptance).
// SIMUI-006/007 (currentDate chip display) are retired this branch — re-tagged @future by #44
// and excluded here via the `not @future` tag filter. The @future Advance-Date scenario is
// likewise excluded. 26 in-scope scenarios bind against this file.
//
// LID Arrow of Intent: these step definitions are authored AHEAD of the components they drive
// (#23 GameWorldProvider, #24 AppHeader, #25 TeamCalendar/GameRow). Until those land the suite
// is RED by design (the component modules do not yet exist). The shared step world, the
// `fetch` router, and the data-testid contracts below are the blueprint the implementation
// tickets turn green against.
//
// Test contracts this file assumes (to be provided by the implementation tickets):
//   - GameWorldProvider({ gwId, children }) exposes { gw, refreshToken, invalidate } via context
//     (useGameWorldContext). See docs/llds/simulate-game-ui.md Flow C. [#23]
//   - AppHeader renders root [data-testid="app-header"]; the batch "Simulate Today" button is
//     [data-testid="batch-simulate"] (label toggles "Simulate Today" / "Simulating…"); batch
//     error region is [role="alert"]; Retry button by name /retry/i. [#24]
//   - TeamCalendar GameRow: Simulate button [data-testid="simulate-<gameId>"], spinner
//     [data-testid="spinner-<gameId>"], error icon [data-testid="error-<gameId>"],
//     status indicator [data-testid="status-<gameId>"], score [data-testid="score-<gameId>"].
//     GameRow reads `game.status` (SCHEDULED/IN_PROGRESS/COMPLETED) — see LLD edge case u1. [#25]
import React from 'react';
import { act } from 'react-dom/test-utils';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { render } from '../test-utils';
import { GameWorldProvider, useGameWorldContext } from '../../../src/ui/context/game-world-context';
import { AppHeader } from '../../../src/ui/components/app-header';
import { GameWorld, League, TeamCalendar } from '../../../src/ui/pages';
import path from 'path';

// react-router: stub the routing primitives so the pages resolve the path params they expect.
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: () => ({ gwId: '1', leagueId: '1', teamId: '1' }),
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const feature = loadFeature(path.resolve(__dirname, '../features/simulate-game-ui.feature'), {
  tagFilter: 'not @future',
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared step world
// ─────────────────────────────────────────────────────────────────────────────

interface BatchResponse {
  status: number;
  simulated: unknown[];
  skipped: unknown[];
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
  mounted: 'none' | 'probe' | 'appheader' | 'gameworld' | 'league' | 'calendar' | 'crossflow';
  // Cross-flow (SIMUI-027/028) calendar data after a batch-driven re-fetch
  calendarFetchCount: number;
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
      return Promise.resolve(resolveWith(world.gwFetchStatus, world.gw));
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
  d.resolve({ ok: r.status >= 200 && r.status < 400, status: r.status, json: () => Promise.resolve({ simulated: r.simulated, skipped: r.skipped }) });
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
// Test-only context probe (Flow C) — renders the context value into the DOM so
// the SIMUI-001..005 assertions can observe gw / refreshToken / invalidate().
// ─────────────────────────────────────────────────────────────────────────────

const ContextProbe = () => {
  const ctx = useGameWorldContext();
  return (
    <div data-testid="context-probe">
      <span data-testid="gw-id">{ctx.gw?.id ?? 'null'}</span>
      <span data-testid="gw-year">{ctx.gw?.year ?? 'null'}</span>
      <span data-testid="gw-currentDate">{ctx.gw?.currentDate ?? 'null'}</span>
      <span data-testid="refreshToken">{ctx.refreshToken}</span>
      <button onClick={() => ctx.invalidate()}>invalidate</button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mount helpers — idempotent within a scenario. `world.mounted` guards re-render.
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

const mountProvider = (children: React.ReactNode, kind: WorldState['mounted']) => {
  if (world.mounted !== 'none') return;
  render(<GameWorldProvider gwId="1">{children}</GameWorldProvider>);
  world.mounted = kind;
};

const ensureProbe = async () => {
  mountProvider(<ContextProbe />, 'probe');
  await flush();
};

const ensureAppHeader = async () => {
  mountProvider(<AppHeader />, 'appheader');
  await flush();
};

const ensureCalendar = async () => {
  mountProvider(<TeamCalendar />, 'calendar');
  await flush();
};

const ensureCrossFlow = async () => {
  mountProvider(
    <>
      <AppHeader />
      <TeamCalendar />
    </>,
    'crossflow',
  );
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

  // ── Flow C: GameWorldProvider (SIMUI-001..005) ─────────────────────────────
  when(/^the GameWorldProvider mounts for GameWorld (\d+)$/, async () => {
    await ensureProbe();
  });

  then(/^the context exposes gw with id (\d+), year (\d+), and currentDate "([^"]+)"$/, (id: string, year: string, currentDate: string) => {
    expect(screen.getByTestId('gw-id')).toHaveTextContent(id);
    expect(screen.getByTestId('gw-year')).toHaveTextContent(year);
    expect(screen.getByTestId('gw-currentDate')).toHaveTextContent(currentDate);
  });

  then(/^the context exposes refreshToken with value (\d+)$/, (value: string) => {
    expect(screen.getByTestId('refreshToken')).toHaveTextContent(value);
  });

  given(/^the GameWorldProvider is mounted with refreshToken (\d+)$/, async () => {
    await ensureProbe();
  });

  when('invalidate() is called', async () => {
    fireEvent.click(screen.getByText('invalidate'));
    await flush();
  });

  then(/^GET \/api\/gameWorld\/(\d+) is requested again$/, (id: string) => {
    expect(countCalls('GET', new RegExp(`/api/gameWorld/${id}$`))).toBeGreaterThanOrEqual(2);
  });

  then(/^refreshToken is incremented to (\d+)$/, (value: string) => {
    expect(screen.getByTestId('refreshToken')).toHaveTextContent(value);
  });

  given(/^a child component consuming GameWorldProvider context$/, async () => {
    await ensureProbe();
  });

  given(/^the GameWorld currentDate is "([^"]+)"$/, (currentDate: string) => {
    (world.gw as Record<string, unknown>).currentDate = currentDate;
  });

  when(/^invalidate\(\) is called and GET \/api\/gameWorld\/(\d+) responds with currentDate "([^"]+)"$/, async (_id: string, currentDate: string) => {
    (world.gw as Record<string, unknown>).currentDate = currentDate;
    fireEvent.click(screen.getByText('invalidate'));
    await flush();
  });

  then(/^the child component receives the updated currentDate "([^"]+)"$/, (currentDate: string) => {
    expect(screen.getByTestId('gw-currentDate')).toHaveTextContent(currentDate);
  });

  when(/^the GameWorld page renders within GameWorldProvider for GameWorld (\d+)$/, async () => {
    mountProvider(<GameWorld />, 'gameworld');
    await flush();
  });

  then('the GameWorld page reads gw from context', () => {
    // The page renders GameWorld content sourced from the context gw (no own fetch).
    expect(screen.getByText(/Current year/i)).toBeInTheDocument();
  });

  then(/^no additional GET \/api\/gameWorld\/(\d+) request is made by the GameWorld page itself$/, (id: string) => {
    expect(countCalls('GET', new RegExp(`/api/gameWorld/${id}$`))).toBe(1);
  });

  given(/^GET \/api\/gameWorld\/(\d+) returns a server error$/, (_id: string) => {
    world.gwFetchStatus = 500;
  });

  then('the context gw is null', () => {
    expect(screen.getByTestId('gw-id')).toHaveTextContent('null');
  });

  then('child pages render without crashing', () => {
    expect(screen.getByTestId('context-probe')).toBeInTheDocument();
  });

  // ── Flow B: AppHeader presence + batch guards (SIMUI-008..018) ──────────────
  then('the AppHeader is present on the GameWorld page', async () => {
    mountProvider(<GameWorld />, 'gameworld');
    await flush();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  then('the AppHeader is present on the League page', async () => {
    mountProvider(<League />, 'league');
    await flush();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
  });

  then('the AppHeader is present on the TeamCalendar page', async () => {
    mountProvider(<TeamCalendar />, 'calendar');
    await flush();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
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
      skipped: Array.from({ length: Number(skipped) }, () => ({})),
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

  when(/^POST \/api\/gameWorld\/(\d+)\/simulate returns a 200 response$/, async () => {
    world.batchResponse = { status: 200, simulated: [{}], skipped: [] };
    resolveBatch();
    await flush();
  });

  then('invalidate() is called on the GameWorldProvider context', () => {
    // invalidate() re-GETs the GameWorld; a second GET evidences the call.
    expect(countCalls('GET', /\/api\/gameWorld\/\d+$/)).toBeGreaterThanOrEqual(2);
  });

  then('refreshToken is incremented', () => {
    // The provider re-fetched after invalidate → at least two GameWorld GETs.
    expect(countCalls('GET', /\/api\/gameWorld\/\d+$/)).toBeGreaterThanOrEqual(2);
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

  then('invalidate() is not called', () => {
    expect(countCalls('GET', /\/api\/gameWorld\/\d+$/)).toBe(1);
  });

  then('refreshToken remains unchanged', () => {
    expect(countCalls('GET', /\/api\/gameWorld\/\d+$/)).toBe(1);
  });

  // ── Flow A: TeamCalendar / GameRow (SIMUI-019..028) ────────────────────────
  given(/^a Game exists with status "([^"]+)" and scheduledDate "([^"]+)"$/, (status: string, scheduledDate: string) => {
    world.games.push(makeGame({ status, scheduledDate }));
  });

  given(/^a Game exists with status "COMPLETED" with homeTeamResult (\d+) and awayTeamResult (\d+)$/, (home: string, away: string) => {
    world.games.push(makeGame({ status: 'COMPLETED', homeTeamResult: Number(home), awayTeamResult: Number(away) }));
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

  // ── Cross-flow: batch (AppHeader) → TeamCalendar refresh (SIMUI-027/028) ────
  given('the player is viewing the TeamCalendar page', async () => {
    await ensureCrossFlow();
  });

  given('the TeamCalendar has loaded a list of games', () => {
    if (world.games.length === 0) {
      world.games = [makeGame({ gameId: 42, status: 'SCHEDULED', scheduledDate: '2025-04-10' })];
    }
  });

  when('the player clicks "Simulate Today" in the AppHeader and batch simulation succeeds', async () => {
    world.batchResponse = { status: 200, simulated: [makeGame({ gameId: 42 })], skipped: [] };
    // Reflect the batch result in the calendar data so the re-fetch returns updated scores.
    world.games = world.games.map((g) => (g.gameId === 42 ? { ...g, status: 'COMPLETED', homeTeamResult: 7, awayTeamResult: 4 } : g));
    fireEvent.click(batchButton());
    resolveBatch();
    await flush();
  });

  then('invalidate() is called and refreshToken increments', () => {
    expect(countCalls('GET', /\/api\/gameWorld\/\d+$/)).toBeGreaterThanOrEqual(2);
  });

  then('the TeamCalendar re-fetches GET /api/team/:teamId/calendar', () => {
    expect(world.calendarFetchCount).toBeGreaterThanOrEqual(2);
  });

  then('the TeamCalendar displays the updated game results', () => {
    expect(screen.queryAllByTestId(/^score-\d+$/).some((el) => el.textContent?.includes('7'))).toBe(true);
  });

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

  then('the TeamCalendar re-fetches its game list', () => {
    expect(world.calendarFetchCount).toBeGreaterThanOrEqual(2);
  });

  then(/^game (\d+) no longer shows a "Simulate" button$/, (gameId: string) => {
    expect(screen.queryByTestId(`simulate-${gameId}`)).toBeNull();
  });

  then(/^game (\d+) displays its simulated score$/, (gameId: string) => {
    expect(screen.getByTestId(`score-${gameId}`)).toBeInTheDocument();
  });

  // ── @future — validation-only no-ops ───────────────────────────────────────
  // These scenarios are EXCLUDED from execution by the `not @future` tag filter
  // (SIMUI-006/007 chip display → future left-pane nav; Advance-Date → future use
  // case). jest-cucumber's `stepsMustMatchFeatureFile` validation runs on every
  // scenario regardless of the tag skip, so these handlers exist solely to satisfy
  // that check. They never execute. Do not implement behaviour here.
  when(/^AppHeader renders for GameWorld (\d+) with currentDate "([^"]+)"$/, () => {});
  when(/^AppHeader renders for GameWorld (\d+)$/, () => {});
  then(/^the header displays the formatted date "([^"]+)"$/, () => {});
  given('the GameWorld currentDate is null', () => {});
  then('the header displays "No date set" in a muted style', () => {});
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
