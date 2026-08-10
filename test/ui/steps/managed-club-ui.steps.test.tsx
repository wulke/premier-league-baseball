// @spec MCLUI-001..MCLUI-006 (managed-club UI acceptance)
import React from 'react';
import path from 'path';
import { MemoryRouter } from 'react-router';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/managed-club-ui.feature'));

// Mutable in-memory world + request logs. The POST mutates `world.managedTeamId` so the
// context's re-GET (invalidate) reflects the new pointer — mirroring MCLUI-003's contract that
// the hub/rail read managedTeamId from the re-fetched GameWorld, never the POST response body.
let world: any;
let posted: Array<{ url: string; body: any }>;
let gameWorldGets: number;

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const res = (payload: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(payload),
    });

    if (method === 'POST' && url === '/api/gameWorld/1/managed-club') {
      posted.push({ url, body });
      world.managedTeamId = body?.teamId ?? null;
      return res({ id: world.id, managedTeamId: world.managedTeamId });
    }
    if (url === '/api/gameWorld/1') {
      gameWorldGets += 1;
      return res(world);
    }
    if (url === '/api/team/10/roster') return res([]);
    if (url === '/api/team/10/calendar?gwId=1') return res({ teamName: 'Manchester Mariners', games: [] });
    return res([]);
  }) as jest.Mock;
};

beforeEach(() => {
  world = {
    id: 1,
    year: 2025,
    currentDate: '2025-04-10',
    config: { name: 'Test World', inProgress: true },
    Leagues: [],
    managedTeamId: null,
  };
  posted = [];
  gameWorldGets = 0;
  installFetch();
});
afterEach(() => cleanup());

const renderAt = (entry: string) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes />
    </MemoryRouter>,
  );
};

const registerSteps = ({ given, when, then }: any) => {
  given('GameWorld 1 exists', () => {});
  given(/^Team 10 "Manchester Mariners" belongs to GameWorld 1$/, () => {});
  given('GameWorld 1 has no managed club', () => { world.managedTeamId = null; });
  given('GameWorld 1 has Team 10 as its managed club', () => { world.managedTeamId = 10; });

  when("the player navigates to Team 10's hub", () => renderAt('/1/team/10/roster'));
  when('the player claims Team 10 as their club', async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Claim as My Club' }));
  });
  when('the player resigns from managing Team 10', async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Stop managing' }));
  });

  then('the hub shows a "Claim as My Club" action', async () => {
    expect(await screen.findByRole('button', { name: 'Claim as My Club' })).toBeInTheDocument();
  });
  then('the hub shows a "Stop managing" action', async () => {
    expect(await screen.findByRole('button', { name: 'Stop managing' })).toBeInTheDocument();
  });
  then(/^the client POSTs managed-club with teamId (null|\d+)$/, (teamId: string) => {
    const last = posted[posted.length - 1];
    expect(last.url).toBe('/api/gameWorld/1/managed-club');
    const expected = teamId === 'null' ? null : Number(teamId);
    expect(last.body).toEqual({ teamId: expected });
  });
  then('the hub shows a "Stop managing" action without a full reload', async () => {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop managing' })).toBeInTheDocument());
    // MCLUI-003 — the reflect came from a context re-GET (initial mount + invalidate), not a reload.
    expect(gameWorldGets).toBeGreaterThanOrEqual(2);
  });
  then('the hub shows a "Claim as My Club" action without a full reload', async () => {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Claim as My Club' })).toBeInTheDocument());
    expect(gameWorldGets).toBeGreaterThanOrEqual(2);
  });
  then('the claim is accepted with no confirmation or interview gate', async () => {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop managing' })).toBeInTheDocument());
    expect(posted.some((p) => p.url === '/api/gameWorld/1/managed-club')).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  then(/^the nav rail's "(My Club|Roster)" links to "(.*)"$/, async (label: string, href: string) => {
    const testid = label === 'My Club' ? 'nav-managed-club' : 'nav-managed-roster';
    const link = await screen.findByTestId(testid);
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveTextContent(label);
  });
  then('the nav rail shows no dimmed "My Club" or "Roster" item', async () => {
    await waitFor(() => {
      expect(screen.queryByTestId('nav-fog-club')).toBeNull();
      expect(screen.queryByTestId('nav-fog-roster')).toBeNull();
    });
  });
  then('the nav rail shows the dimmed "My Club" item', () =>
    expect(screen.getByTestId('nav-fog-club')).toHaveTextContent('My Club'));
  then('the nav rail shows the dimmed "Roster" item', () =>
    expect(screen.getByTestId('nav-fog-roster')).toHaveTextContent('Roster'));
  then('the nav rail shows the dimmed "Transfers" item', () =>
    expect(screen.getByTestId('nav-fog-transfers')).toHaveTextContent('Transfers'));
  then('the nav rail shows no active "My Club" or "Roster" link', () => {
    expect(screen.queryByTestId('nav-managed-club')).toBeNull();
    expect(screen.queryByTestId('nav-managed-roster')).toBeNull();
  });
};

autoBindSteps(feature, [registerSteps]);
