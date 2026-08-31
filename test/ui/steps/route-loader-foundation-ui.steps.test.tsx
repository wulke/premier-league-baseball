// @spec RLDRUI-001,RLDRUI-002,RLDRUI-003,RLDRUI-005
// Acceptance bindings for the route-loader foundation (docs/llds/route-loader-foundation-ui.md):
// the gw loader shared via the :gwId route, and revalidate() replacing invalidate() at the
// batch-simulate call site. Rendered through the real route tree (createMemoryRouter), same
// harness pattern as every other UI acceptance file post route-loader migration (map #229).
import { act } from 'react';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import path from 'path';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/route-loader-foundation-ui.feature'));

type Game = {
  gameId: number;
  status: 'SCHEDULED' | 'COMPLETED';
  scheduledDate: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  divisionId: number;
  divisionName: string;
  roundLabel: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
};

let world: Record<string, unknown>;
let games: Game[];
let gwFetchStatus: number;
let batchStatus: number;
let calls: string[];
let pendingEntry: string;
let mounted: boolean;
let router: ReturnType<typeof createMemoryRouter>;

const resetWorld = () => {
  world = { id: 1, year: 2025, currentDate: '2025-04-10', config: { name: 'Test World', inProgress: true }, Leagues: [] };
  games = [];
  gwFetchStatus = 200;
  batchStatus = 200;
  calls = [];
  pendingEntry = '/1';
  mounted = false;
};

const response = (body: unknown, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(url);

    if (method === 'GET' && /\/api\/gameWorld\/1$/.test(url)) {
      return gwFetchStatus === 200 ? response({ ...world }) : response({}, gwFetchStatus);
    }
    if (method === 'POST' && /\/api\/gameWorld\/1\/simulate$/.test(url)) {
      return batchStatus === 200 ? response({ simulated: [{ gameId: 42 }], skipped: [] }) : response({}, 500);
    }
    if (method === 'GET' && /\/api\/team\/1\/calendar/.test(url)) {
      return response({ teamId: 1, teamName: 'Test Team', year: 2025, games });
    }
    return response([]);
  }) as jest.Mock;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const gwGetCount = () => calls.filter((url) => /\/api\/gameWorld\/1$/.test(url)).length;
const calendarGetCount = () => calls.filter((url) => /\/api\/team\/1\/calendar/.test(url)).length;

const ensureMounted = async () => {
  if (mounted) return;
  router = createMemoryRouter(routes, { initialEntries: [pendingEntry] });
  render(<RouterProvider router={router} />);
  mounted = true;
  await flush();
};

const registerSteps = ({ given, when, then, and }: any) => {
  given(/^a GameWorld exists with id 1, year 2025, currentDate "([^"]+)", and season in progress$/, (date: string) => {
    world.currentDate = date;
    (world.config as Record<string, unknown>).inProgress = true;
  });

  given('GET /api/gameWorld/1 returns a server error', () => {
    gwFetchStatus = 500;
  });

  when('the player opens the GameWorld route for GameWorld 1', async () => {
    pendingEntry = '/1';
    await ensureMounted();
  });

  then('GET /api/gameWorld/1 is requested exactly once', () => {
    expect(gwGetCount()).toBe(1);
  });

  then('the NavRail and the GameWorld page both display data from that one response', async () => {
    expect(await screen.findAllByText('Test World')).not.toHaveLength(0);
    expect(screen.getByText(/Current year: 2025/)).toBeInTheDocument();
  });

  then('the NavRail renders HOME-only chrome', async () => {
    expect(await screen.findByTestId('nav-home')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-world')).not.toBeInTheDocument();
  });

  then('the GameWorld page renders without crashing', () => {
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  given('the player is viewing the GameWorld route for GameWorld 1', async () => {
    pendingEntry = '/1';
    await ensureMounted();
  });

  when('the player clicks "Simulate Today" and batch simulation succeeds', async () => {
    batchStatus = 200;
    if (games.length > 0) {
      games = games.map((game) => (game.gameId === 42
        ? { ...game, status: 'COMPLETED', homeTeamResult: 7, awayTeamResult: 4 }
        : game));
    }
    await ensureMounted();
    const button = await screen.findByTestId('batch-simulate');
    fireEvent.click(button);
    await flush();
  });

  when('the player clicks "Simulate Today" and the batch simulation request fails', async () => {
    batchStatus = 500;
    await ensureMounted();
    const button = await screen.findByTestId('batch-simulate');
    fireEvent.click(button);
    await flush();
  });

  then('GET /api/gameWorld/1 is requested again', () => {
    expect(gwGetCount()).toBeGreaterThanOrEqual(2);
  });

  then('the NavRail reflects the refreshed GameWorld data', async () => {
    expect(await screen.findByTestId('nav-world-link')).toBeInTheDocument();
  });

  then('no additional GET /api/gameWorld/1 request is made', () => {
    expect(gwGetCount()).toBe(1);
  });

  then('the NavRail continues to display the GameWorld data from the prior successful fetch', async () => {
    expect(await screen.findAllByText('Test World')).not.toHaveLength(0);
  });

  given('the player is viewing the TeamCalendar page for GameWorld 1', () => {
    pendingEntry = '/1/team/1/calendar';
  });

  and('the TeamCalendar has loaded a list of games', async () => {
    games = [{
      gameId: 42,
      status: 'SCHEDULED',
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
    }];
    await ensureMounted();
    await screen.findByTestId('simulate-42');
  });

  then('the gw loader for GameWorld 1 re-runs', async () => {
    await waitFor(() => expect(gwGetCount()).toBeGreaterThanOrEqual(2));
  });

  then('the TeamCalendar re-fetches GET /api/team/:teamId/calendar', async () => {
    await waitFor(() => expect(calendarGetCount()).toBeGreaterThanOrEqual(2));
  });

  then('the TeamCalendar displays the updated game results', async () => {
    expect(await screen.findByTestId('score-42')).toBeInTheDocument();
  });
};

beforeEach(() => {
  resetWorld();
  installFetch();
});
afterEach(() => cleanup());
autoBindSteps(feature, [registerSteps]);
