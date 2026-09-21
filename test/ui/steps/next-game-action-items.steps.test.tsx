// @spec NGAI-001,NGAI-002,NGAI-003,NGAI-004,NGAI-005,NGAI-006
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../test-utils';
import { ActionItemsPanel } from '../../../src/ui/components/action-items-panel';
import { useNextGameActionItems } from '../../../src/ui/hooks/use-next-game-action-items';

const feature = loadFeature(path.resolve(__dirname, '../features/next-game-action-items.feature'));

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate,
}));

const gwId = '1';
const managedTeamId = 1;
let currentDate: string | null = null;
let leagues: Array<{ id: number; name: string }> = [];
let leagueGames: Record<number, any[]> = {};

const opponentTeamIdByName: Record<string, number> = { 'Team B': 2, 'Team C': 3 };

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (url.startsWith(`/api/team/${managedTeamId}/calendar`)) {
      const query = new URLSearchParams(url.split('?')[1] ?? '');
      const leagueId = Number(query.get('leagueId'));
      return response({ games: leagueGames[leagueId] ?? [], seasonStart: null, seasonEnd: null });
    }

    return response({});
  }) as jest.Mock;
};

// A harness, not the full GameWorld page: exercises the hook + panel exactly as
// game-world.tsx wires them (NGAI's own scope), without re-testing route-loader plumbing
// that ACTUI-001/ACTUI-005 already cover.
const Harness = () => {
  const items = useNextGameActionItems(gwId, managedTeamId, currentDate, leagues);
  return <ActionItemsPanel items={items} />;
};

const renderHarness = async () => {
  render(<Harness />);
  await screen.findByTestId('action-items-section');
};

beforeEach(() => {
  currentDate = null;
  leagues = [];
  leagueGames = {};
  mockNavigate.mockClear();
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

const addLeagueGame = (leagueId: number, leagueName: string, gameId: number, opponentName: string, scheduledDate: string) => {
  if (!leagues.some((league) => league.id === leagueId)) leagues.push({ id: leagueId, name: leagueName });
  leagueGames[leagueId] = [
    ...(leagueGames[leagueId] ?? []),
    {
      gameId,
      scheduledDate: `${scheduledDate}T00:00:00.000Z`,
      homeTeamId: managedTeamId,
      homeTeamName: 'Team A',
      awayTeamId: opponentTeamIdByName[opponentName],
      awayTeamName: opponentName,
      divisionId: 1,
      divisionName: 'Division',
      leagueId,
      leagueName,
      roundLabel: null,
      homeTeamResult: null,
      awayTeamResult: null,
      status: 'SCHEDULED',
    },
  ];
};

defineFeature(feature, (test) => {
  test("A league's next game is ready to prep", ({ given, when, then }) => {
    given('GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1', () => {
      currentDate = '2026-04-10';
    });
    given('League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"', () => {
      addLeagueGame(10, 'American League', 100, 'Team B', '2026-04-10');
    });
    when('the GameWorld 1 home page loads', renderHarness);

    then('an action item for League 10 appears linking to "/1/10/game/100"', async () => {
      await screen.findByTestId('action-item-next-game-league-10');
      fireEvent.click(screen.getByTestId('action-item-next-game-league-10'));
      expect(mockNavigate).toHaveBeenCalledWith('/1/10/game/100');
    });
  });

  test('Two leagues both have a ready next game', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1', () => {
      currentDate = '2026-04-10';
    });
    given('League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"', () => {
      addLeagueGame(10, 'American League', 100, 'Team B', '2026-04-10');
    });
    and('League 20 "National League" has a SCHEDULED game 200 for Team A vs "Team C" scheduled "2026-04-09"', () => {
      addLeagueGame(20, 'National League', 200, 'Team C', '2026-04-09');
    });
    when('the GameWorld 1 home page loads', renderHarness);

    then('an action item for League 10 appears linking to "/1/10/game/100"', async () => {
      await screen.findByTestId('action-item-next-game-league-10');
    });

    and('an action item for League 20 appears linking to "/1/20/game/200"', async () => {
      await screen.findByTestId('action-item-next-game-league-20');
    });
  });

  test("A league's next game has not reached the current date yet", ({ given, when, then }) => {
    given('GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1', () => {
      currentDate = '2026-04-10';
    });
    given('League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-11"', () => {
      addLeagueGame(10, 'American League', 100, 'Team B', '2026-04-11');
    });
    when('the GameWorld 1 home page loads', renderHarness);

    then('no action item for League 10 appears', async () => {
      await screen.findByTestId('action-items-empty');
      expect(screen.queryByTestId('action-item-next-game-league-10')).toBeNull();
    });
  });

  test('A league has no scheduled games left', ({ given, when, then }) => {
    given('GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1', () => {
      currentDate = '2026-04-10';
    });
    given('League 10 "American League" has no scheduled games for Team A', () => {
      leagues.push({ id: 10, name: 'American League' });
      leagueGames[10] = [];
    });
    when('the GameWorld 1 home page loads', renderHarness);

    then('no action item for League 10 appears', async () => {
      await screen.findByTestId('action-items-empty');
      expect(screen.queryByTestId('action-item-next-game-league-10')).toBeNull();
    });
  });

  test("Clicking an action item navigates to the game's prep screen", ({ given, when, and, then }) => {
    given('GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1', () => {
      currentDate = '2026-04-10';
    });
    given('League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"', () => {
      addLeagueGame(10, 'American League', 100, 'Team B', '2026-04-10');
    });
    when('the GameWorld 1 home page loads', renderHarness);

    and('the manager clicks the action item for League 10', async () => {
      await screen.findByTestId('action-item-next-game-league-10');
      fireEvent.click(screen.getByTestId('action-item-next-game-league-10'));
    });

    then('the browser navigates to "/1/10/game/100"', () => {
      expect(mockNavigate).toHaveBeenCalledWith('/1/10/game/100');
    });
  });
});
