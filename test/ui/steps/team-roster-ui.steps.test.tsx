// @spec ROSTUI-001..ROSTUI-012
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RosterPlayer } from '../../../src/api/models';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/team-roster-ui.feature'));

let roster: RosterPlayer[] = [];
let rosterStatus = 200;
let requests: string[] = [];

const player = (overrides: Partial<RosterPlayer> = {}): RosterPlayer => ({
  id: 100,
  givenName: 'Riley',
  familyName: 'Rivera',
  countryCode: 'US',
  bats: 'R',
  throws: 'R',
  age: 24,
  primaryPosition: 'Shortstop',
  positionCoverage: ['Shortstop'],
  positions: { Pitcher: 0, Catcher: 0, FirstBase: 0, SecondBase: 0, ThirdBase: 0, Shortstop: 70, LeftField: 0, CenterField: 0, RightField: 0 },
  contact: 70,
  power: 65,
  armStrength: 60,
  accuracy: 62,
  reaction: 71,
  vision: 66,
  discipline: 64,
  ...overrides,
});

let router: ReturnType<typeof createMemoryRouter>;

// @spec ROSTUI-001,ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-005,ROSTUI-006,ROSTUI-007,ROSTUI-008,ROSTUI-009,ROSTUI-011,RLDRUI-006
const renderAt = async (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('app-shell');
};

// @spec ROSTUI-001,ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-005,ROSTUI-006,ROSTUI-007,ROSTUI-008,ROSTUI-009,ROSTUI-011
const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    requests.push(url);
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (url === '/api/team/10/roster') return response(roster, rosterStatus);
    if (url === '/api/team/10/calendar?gwId=1') return response({ teamName: 'Manchester Mariners', games: [] });
    if (url === '/api/gameWorld/1') return response({ id: 1, year: 2025, config: { name: 'Test World', inProgress: true }, Leagues: [] });
    if (url === '/api/league/7') return response({ id: 7, config: { name: 'Premier' }, Divisions: [{ id: 1, config: { name: 'East' } }] });
    if (url === '/api/league/7/standings') return response([{ divisionId: 1, standings: [{ teamId: 10, teamName: 'Manchester Mariners', played: 1, won: 1, drawn: 0, lost: 0, runsFor: 5, runsAgainst: 2, runDifference: 3, points: 3 }] }]);
    if (url === '/api/league/7/bracket') return response([]);
    return response([]);
  }) as jest.Mock;
};

beforeEach(() => {
  roster = [];
  rosterStatus = 200;
  requests = [];
  installFetch();
});
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('Clicking a team in the League standings navigates to the team hub', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player clicks Team 10 in the League standings for GameWorld 1', async () => {
      renderAt('/1/7');
      fireEvent.click(await screen.findByRole('button', { name: 'Manchester Mariners' }));
    });
    // @spec ROSTUI-001
    then('the browser navigates to "/1/team/10"', async () => {
      await waitFor(() => expect(router.state.location.pathname).toBe('/1/team/10/calendar'));
    });
  });

  test('Navigating to the team hub with no tab redirects to the calendar', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10"', () => renderAt('/1/team/10'));
    // @spec ROSTUI-006
    then('the browser is redirected to "/1/team/10/calendar"', async () => {
      await waitFor(() => expect(router.state.location.pathname).toBe('/1/team/10/calendar'));
    });
  });

  test('The team hub offers Calendar and Roster tabs', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-007
    then('the page shows a Calendar tab', () => expect(screen.getByRole('link', { name: 'Calendar' })).toBeInTheDocument());
    // @spec ROSTUI-007
    and('the page shows a Roster tab', () => expect(screen.getByRole('link', { name: 'Roster' })).toBeInTheDocument());
  });

  test('Team Hub tabs share one stable content width', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-010
    then('the Team Hub tab bar and Roster page use the shared 960px content width', async () => {
      expect(await screen.findByTestId('team-hub-tabs')).toHaveStyle({ maxWidth: '960px' });
      expect(screen.getByTestId('team-roster-page')).toHaveStyle({ maxWidth: '960px' });
    });
  });

  test('The roster renders as a flat table with the positions-coverage cell as organizer', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-008
    given('GET /api/team/10/roster returns a multi-position Player covering Shortstop and ThirdBase', () => { roster = [player({ primaryPosition: 'Shortstop', positionCoverage: ['Shortstop', 'ThirdBase'] })]; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-008
    then('the roster table shows that Player\'s row with abbreviated position badges in the coverage cell', async () => {
      const row = await screen.findByTestId('roster-row-100');
      const coverage = within(row).getByTestId('position-coverage-100');
      expect(coverage).toHaveTextContent('SS');
      expect(coverage).toHaveTextContent('3B');
      expect(coverage).not.toHaveTextContent('Shortstop');
      expect(coverage).not.toHaveTextContent('ThirdBase');
      expect(within(coverage).getByTestId('position-primary-100')).toHaveStyle({ borderRadius: '999px' });
      expect(within(coverage).getByTestId('position-secondary-100-ThirdBase')).toHaveStyle({ borderRadius: '999px' });
      expect(screen.queryByRole('columnheader', { name: 'Pos' })).toBeNull();
    });
    // @spec ROSTUI-008,ROSTUI-011
    and('the primary position is bolded and the secondary is dimmed', () => {
      expect(screen.getByTestId('position-primary-100')).toHaveStyle({ fontWeight: 700 });
      expect(screen.getByTestId('position-secondary-100-ThirdBase')).toHaveStyle({ color: '#888' });
    });
  });

  test('Rating columns are seven tinted columns with no OVR', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-009
    given('GET /api/team/10/roster returns a Player with flat-7 ratings', () => { roster = [player()]; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-009
    then('the roster table shows seven rating columns', async () => {
      await screen.findByTestId('roster-row-100');
      expect(screen.getAllByTestId(/rating-header-/)).toHaveLength(7);
      expect(screen.getAllByTestId(/rating-100-/)).toHaveLength(7);
    });
    // @spec ROSTUI-009
    and('the roster table shows no OVR column', () => expect(screen.queryByText('OVR')).toBeNull());
  });

  test('Sorting the roster is client-side with no refetch', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-003
    given('GET /api/team/10/roster returns several Players', () => { roster = [player({ id: 100, age: 30 }), player({ id: 101, givenName: 'Avery', age: 21 })]; });
    when('the player navigates to "/1/team/10/roster"', async () => {
      renderAt('/1/team/10/roster');
      await screen.findByTestId('roster-row-100');
    });
    and('the player sorts the roster by age', () => fireEvent.click(screen.getByRole('button', { name: 'Age' })));
    // @spec ROSTUI-003
    then('the rows are reordered by age', () => expect(screen.getAllByTestId(/roster-row-/).map((row) => row.getAttribute('data-testid'))).toEqual(['roster-row-101', 'roster-row-100']));
    // @spec ROSTUI-003
    and('no second GET /api/team/10/roster request is made', () => expect(requests.filter((url) => url === '/api/team/10/roster')).toHaveLength(1));
  });

  test('My Club roster defaults to primary defensive position and player name order', ({ given, when, then }) => {
    given('GET /api/team/10/roster returns Players with mixed primary defensive positions and matching-position names', () => {
      roster = [
        player({ id: 100, givenName: 'Zane', familyName: 'Catcher', primaryPosition: 'Catcher' }),
        player({ id: 101, givenName: 'Bert', familyName: 'Pitcher', primaryPosition: 'Pitcher' }),
        player({ id: 102, givenName: 'Avery', familyName: 'Catcher', primaryPosition: 'Catcher' }),
        player({ id: 103, givenName: 'Casey', familyName: 'First', primaryPosition: 'FirstBase' }),
        player({ id: 104, givenName: 'Drew', familyName: 'Second', primaryPosition: 'SecondBase' }),
        player({ id: 105, givenName: 'Evan', familyName: 'Third', primaryPosition: 'ThirdBase' }),
        player({ id: 106, givenName: 'Finn', familyName: 'Short', primaryPosition: 'Shortstop' }),
        player({ id: 107, givenName: 'Gray', familyName: 'Left', primaryPosition: 'LeftField' }),
        player({ id: 108, givenName: 'Hayden', familyName: 'Center', primaryPosition: 'CenterField' }),
        player({ id: 109, givenName: 'Indy', familyName: 'Right', primaryPosition: 'RightField' }),
      ];
    });
    when('the player navigates to "/1/team/10/roster"', async () => {
      renderAt('/1/team/10/roster');
      await screen.findByTestId('roster-row-100');
    });
    // @spec ROSTUI-012
    then('the roster rows are ordered C, 1B, 2B, 3B, SS, LF, CF, RF, P with player names alphabetized within each position', () => {
      expect(screen.getAllByTestId(/roster-row-/).map((row) => row.getAttribute('data-testid')))
        .toEqual(['roster-row-102', 'roster-row-100', 'roster-row-103', 'roster-row-104', 'roster-row-105', 'roster-row-106', 'roster-row-107', 'roster-row-108', 'roster-row-109', 'roster-row-101']);
    });
  });

  test('Clicking a roster row\'s player name navigates to player detail', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-004
    given('GET /api/team/10/roster returns a Player with id 100', () => { roster = [player()]; });
    when('the player navigates to "/1/team/10/roster"', async () => { renderAt('/1/team/10/roster'); await screen.findByTestId('roster-row-100'); });
    and('the player clicks that Player\'s name', () => fireEvent.click(screen.getByRole('link', { name: 'Riley Rivera' })));
    // @spec ROSTUI-004
    then('the browser navigates to "/1/player/100"', async () => await waitFor(() => expect(router.state.location.pathname).toBe('/1/player/100')));
  });

  test('A failed roster fetch degrades to an empty table', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-002
    given('GET /api/team/10/roster fails', () => { rosterStatus = 500; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-002
    then('the roster table renders empty', async () => { await waitFor(() => expect(screen.queryAllByTestId(/roster-row-/)).toHaveLength(0)); });
    // @spec ROSTUI-002
    and('no error message is shown', () => expect(screen.queryByText(/failed|unable/i)).toBeNull());
  });

  test('An empty roster renders an empty table with no message', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec ROSTUI-002
    given('GET /api/team/10/roster returns no players', () => { roster = []; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-002
    then('the roster table renders empty', async () => { await waitFor(() => expect(screen.queryAllByTestId(/roster-row-/)).toHaveLength(0)); });
    // @spec ROSTUI-002
    and('no "no players" message is shown', () => expect(screen.queryByText(/no players/i)).toBeNull());
  });

  test('No roster or team item is added to the nav rail', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    // @spec ROSTUI-005
    then('the nav rail shows no roster entry', () => expect(screen.queryByTestId('nav-roster')).toBeNull());
    // @spec ROSTUI-005
    and('the nav rail shows no team entry', () => expect(screen.queryByTestId('nav-team')).toBeNull());
  });
});
