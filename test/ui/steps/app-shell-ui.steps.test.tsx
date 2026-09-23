// @spec SHELL-001..SHELL-011, LDASH-001,LDASH-005, SIMUI-006,SIMUI-007 (AppShell + NavRail acceptance; real MemoryRouter locations).
import { act } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import path from 'path';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/app-shell-ui.feature'));

let world = {
  id: 1,
  year: 2025,
  currentDate: '2025-04-10',
  config: { name: 'Test World', inProgress: true },
  Leagues: [{ id: 7, config: { name: 'Premier' } }],
};
let calls: string[] = [];
let router: ReturnType<typeof createMemoryRouter>;

const response = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });
const renderAt = async (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  calls = [];
  world = {
    id: 1,
    year: 2025,
    currentDate: '2025-04-10',
    config: { name: 'Test World', inProgress: true },
    Leagues: [{ id: 7, config: { name: 'Premier' } }],
  };
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    calls.push(url);
    if (/\/api\/gameWorld\/1$/.test(url)) return Promise.resolve(response(world));
    if (/\/api\/gameWorlds$/.test(url)) return Promise.resolve(response([]));
    if (/\/api\/league\/7\/(standings|bracket)/.test(url)) return Promise.resolve(response([]));
    if (/\/api\/league\/7$/.test(url)) return Promise.resolve(response({ id: 7, config: { name: 'Premier' } }));
    return Promise.resolve(response([]));
  }) as jest.Mock;
});
afterEach(() => cleanup());

const registerSteps = ({ given, when, then }: any) => {

  given('the player opens the Home route', () => renderAt('/'));
  given(/^GameWorld 1 is named "([^"]+)" with league 7 named "([^"]+)"$/, (name: string, league: string) => {
    world.config.name = name;
    world.Leagues[0].config.name = league;
  });
  given('GameWorld 1 has no leagues', () => { world.Leagues = []; });
  given(/^GameWorld 1 has currentDate "([^"]+)"$/, (currentDate: string) => { world.currentDate = currentDate; });
  given('GameWorld 1 has currentDate null', () => { world.currentDate = null as any; });
  when('the player opens the League route for GameWorld 1 and league 7', () => renderAt('/1/7'));
  when('the player opens the GameWorld route for GameWorld 1', () => renderAt('/1'));
  when('the GameWorld refreshes', async () => {
    await act(async () => { screen.getByTestId('shell-invalidate').click(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  });
  then('the App Shell and NavRail are present', () => {
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('nav-rail')).toBeInTheDocument();
  });
  // @spec SHELL-004
  then('the rail shows an active branded home link, no standalone HOME link, and disabled fog trio', () => {
    expect(screen.getByTestId('nav-home')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-home')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('nav-home')).toHaveTextContent('Premier League Baseball');
    expect(screen.queryByText('HOME')).toBeNull();
    expect(screen.getAllByTestId(/nav-fog-/)).toHaveLength(3);
  });
  then('the rail has no WORLD or COMPETITIONS section', () => {
    expect(screen.queryByTestId('nav-world')).toBeNull();
    expect(screen.queryByTestId('nav-competitions')).toBeNull();
  });
  then('the rail has no COMPETITIONS section', () => expect(screen.queryByTestId('nav-competitions')).toBeNull());
  then(/^the WORLD section displays the formatted date "([^"]+)"$/, (date: string) => expect(screen.getByTestId('nav-current-date')).toHaveTextContent(date));
  then('the WORLD section displays "No date set" in a muted style', () => {
    expect(screen.getByTestId('nav-current-date')).toHaveTextContent('No date set');
    expect(screen.getByTestId('nav-current-date')).toHaveStyle({ color: '#888' });
  });
  then('no GET request is made for an undefined GameWorld', () => expect(calls).not.toContain('/api/gameWorld/undefined'));
  // @spec SHELL-006
  then('the rail shows WORLD linked to "/1"', () => expect(screen.getByTestId('nav-world-link')).toHaveAttribute('href', '/1'));
  // @spec SHELL-006
  then('the WORLD link prefixes its name with a decorative home icon', () => {
    expect(screen.getByTestId('nav-world-home-icon')).toHaveAttribute('aria-hidden', 'true');
  });
  then('the rail shows a competition link to "/1/7"', () => expect(screen.getByTestId('nav-league-7')).toHaveAttribute('href', '/1/7'));
  then('the competition link is active', () => expect(screen.getByTestId('nav-league-7')).toHaveAttribute('data-active', 'true'));
  // @spec SHELL-007,LDASH-001 — the rail is the GameWorld-to-dashboard entry point.
  when(/^the player selects the "([^"]+)" competition from the rail$/, async (name: string) => {
    fireEvent.click(screen.getByRole('link', { name }));
    await screen.findByTestId('league-dashboard-page');
  });
  // @spec LDASH-001
  then('the League Dashboard page renders', () => expect(screen.getByTestId('league-dashboard-page')).toBeInTheDocument());
  // @spec LDASH-005
  when(/^the player selects "([^"]+)"$/, (name: string) => fireEvent.click(screen.getByRole('link', { name })));
  // @spec LDASH-005
  then(/^the app navigates to "([^"]+)"$/, async (target: string) => {
    await waitFor(() => expect(router.state.location.pathname).toBe(target));
  });
  then('no page-local app header or breadcrumb is rendered', () => { expect(screen.queryByTestId('app-header')).toBeNull(); expect(screen.queryByText(/←/)).toBeNull(); });
  // @spec SHELL-011
  then('the App Shell separates viewport scrolling between the rail and main content', () => {
    expect(screen.getByTestId('app-shell')).toHaveStyle({ height: '100vh', overflow: 'hidden' });
    expect(screen.getByTestId('nav-rail')).toHaveStyle({ position: 'sticky', top: '0px', height: '100vh', overflowY: 'auto' });
    expect(screen.getByTestId('app-shell').querySelector('main')).toHaveStyle({ height: '100vh', overflowY: 'auto' });
  });
};

autoBindSteps(feature, [registerSteps]);
