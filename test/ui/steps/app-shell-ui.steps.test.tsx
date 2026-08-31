// @spec SHELL-001..SHELL-010, SIMUI-006,SIMUI-007 (AppShell + NavRail acceptance; real MemoryRouter locations).
import { act } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { cleanup, render, screen } from '@testing-library/react';
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

const response = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });
const renderAt = async (entry: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
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
  then('the rail shows the app mark, HOME link, and disabled fog trio', () => {
    expect(screen.getByTestId('nav-mark')).toBeInTheDocument();
    expect(screen.getByTestId('nav-home')).toBeInTheDocument();
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
  then('the rail shows WORLD linked to "/1"', () => expect(screen.getByTestId('nav-world-link')).toHaveAttribute('href', '/1'));
  then('the rail shows a competition link to "/1/7"', () => expect(screen.getByTestId('nav-league-7')).toHaveAttribute('href', '/1/7'));
  then('the competition link is active', () => expect(screen.getByTestId('nav-league-7')).toHaveAttribute('data-active', 'true'));
  then('no page-local app header or breadcrumb is rendered', () => { expect(screen.queryByTestId('app-header')).toBeNull(); expect(screen.queryByText(/←/)).toBeNull(); });
};

autoBindSteps(feature, [registerSteps]);
