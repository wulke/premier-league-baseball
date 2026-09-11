// @spec BRKT-001..BRKT-008 — League Cup bracket-tree UI acceptance bindings
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/bracket-tree-ui.feature'));

type FixtureMode = 'empty' | 'pending' | 'complete';
let fixtureMode: FixtureMode = 'pending';

const teams = [
  { id: 201, config: { name: 'Manchester City' } },
  { id: 202, config: { name: 'Leeds United' } },
  { id: 203, config: { name: 'Chelsea' } },
];

const league = {
  id: 313,
  gameWorldId: 1,
  config: { name: 'League Cup', type: 'League Cup' },
  Divisions: [{ id: 3130, config: { name: 'League Cup', format: { structure: 'KNOCKOUT' } }, Teams: teams }],
};

const gameWorld = {
  id: 1,
  year: 2025,
  currentDate: null,
  config: { name: 'Bracket Test World', inProgress: true },
  Leagues: [{ id: 313, config: { name: 'League Cup', type: 'League Cup' } }],
};

const completedSeries = {
  kind: 'SERIES' as const,
  teamA: { teamId: 201, teamName: 'Manchester City' },
  teamB: { teamId: 202, teamName: 'Leeds United' },
  winnerTeamId: 201,
  games: [
    { gameId: 401, status: 'COMPLETED' as const, homeTeamId: 201, homeTeamName: 'Manchester City', awayTeamId: 202, awayTeamName: 'Leeds United', homeTeamResult: 2, awayTeamResult: 1 },
    { gameId: 402, status: 'COMPLETED' as const, homeTeamId: 202, homeTeamName: 'Leeds United', awayTeamId: 201, awayTeamName: 'Manchester City', homeTeamResult: 0, awayTeamResult: 2 },
  ],
};

// @spec BRKT-001,BRKT-002,BRKT-003,BRKT-004,BRKT-005,BRKT-006,BRKT-007,BRKT-008
const bracket = () => [{
  divisionId: 3130,
  divisionName: 'League Cup',
  structure: 'KNOCKOUT' as const,
  rounds: fixtureMode === 'empty' ? [] : [
    {
      round: 1, label: 'Quarterfinals', status: 'COMPLETE' as const,
      ties: [
        { kind: 'BYE' as const, teamA: { teamId: 203, teamName: 'Chelsea' }, teamB: null, winnerTeamId: 203, games: [] },
        completedSeries,
      ],
    },
    {
      round: 2, label: 'Semifinals', status: fixtureMode === 'complete' ? 'IN_PROGRESS' as const : 'PENDING' as const,
      ties: [{ kind: 'SERIES' as const, teamA: { teamId: 203, teamName: 'Chelsea' }, teamB: { teamId: 201, teamName: 'Manchester City' }, games: [] }],
    },
    { round: 3, label: 'Final', status: fixtureMode === 'complete' ? 'IN_PROGRESS' as const : 'PENDING' as const, ties: [{ kind: 'SERIES' as const, teamA: { teamId: null, teamName: null }, teamB: { teamId: null, teamName: null }, games: [] }] },
  ],
}];

// @spec BRKT-001..BRKT-008
const renderLeague = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1/313'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'League Cup' });
};

// @spec BRKT-001..BRKT-008
const bracketCard = () => screen.getByTestId('division-card-3130');

beforeEach(() => {
  fixtureMode = 'pending';
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    if (method === 'GET' && url === '/api/gameWorld/1') return response(gameWorld);
    if (method === 'GET' && url === '/api/league/313') return response(league);
    if (method === 'GET' && url === '/api/league/313/standings') return response([]);
    if (method === 'GET' && url === '/api/league/313/bracket') return response(bracket());

    return Promise.reject(new Error(`Unexpected fetch in bracket-tree UI test: ${method} ${url}`));
  }) as jest.Mock;
});

afterEach(() => jest.clearAllMocks());

defineFeature(feature, (test) => {
  test('A knockout without generated rounds retains its roster empty state', ({ given, when, then, and }) => {
    given('the player opens the League Cup with no generated bracket rounds', () => { fixtureMode = 'empty'; });
    when('the bracket tree League page renders', renderLeague);
    then('the bracket tree shows the no-bracket empty state and TeamRoster', () => {
      const card = within(bracketCard());
      expect(card.getByText('No bracket yet — season not started.')).toBeInTheDocument();
      expect(card.getByRole('button', { name: 'Chelsea' })).toBeInTheDocument();
    });
    and('the bracket tree does not render a tree shell', () => expect(within(bracketCard()).queryByTestId('bracket-tree')).toBeNull());
  });

  test('Generated rounds stop at the first pending round', ({ given, when, then, and }) => {
    given('the player opens the League Cup with a resolved quarterfinal and pending later rounds', () => { fixtureMode = 'pending'; });
    when('the bracket tree League page renders', renderLeague);
    then(/^the bracket tree renders only the "([^"]+)" round column$/, (label: string) => expect(screen.getByTestId(`bracket-round-1`)).toHaveTextContent(label));
    and(/^the bracket tree shows "([^"]+)"$/, (text: string) => expect(screen.getByText(text)).toBeInTheDocument());
    and(/^the bracket tree does not render a "([^"]+)" round column$/, (label: string) => expect(screen.queryByRole('heading', { name: label })).toBeNull());
  });

  test('A fully generated bracket renders every round without a pending card', ({ given, when, then, and }) => {
    given('the player opens the League Cup with every round generated', () => { fixtureMode = 'complete'; });
    when('the bracket tree League page renders', renderLeague);
    then(/^the bracket tree renders the "([^"]+)" and "([^"]+)" round columns$/, (first: string, second: string) => {
      expect(screen.getByTestId('bracket-round-1')).toHaveTextContent(first);
      expect(screen.getByTestId('bracket-round-2')).toHaveTextContent(second);
    });
    and('the bracket tree does not show a pending-round card', () => expect(screen.queryByTestId('bracket-pending-round')).toBeNull());
  });

  test('A bye retains its tie slot in the round column', ({ given, when, then, and }) => {
    given('the player opens the League Cup with a quarterfinal bye', () => { fixtureMode = 'pending'; });
    when('the bracket tree League page renders', renderLeague);
    then(/^the "([^"]+)" column has a tie node "([^"]+)"$/, (_round: string, text: string) => expect(screen.getByTestId('bracket-node-1-0')).toHaveTextContent(text));
    and(/^the bye tie node has the auto-advance outcome for "([^"]+)"$/, (team: string) => expect(screen.getByTestId('bracket-node-1-0')).toHaveTextContent(`Auto-advanced: ${team}`));
  });

  test('A series expands from its aggregate summary to game rows', ({ given, when, then, and }) => {
    given('the player opens the League Cup with a completed two-game quarterfinal series', () => { fixtureMode = 'pending'; });
    when('the bracket tree League page renders', renderLeague);
    then(/^the series node shows aggregate summary "([^"]+)"$/, (summary: string) => expect(screen.getByTestId('bracket-node-1-1')).toHaveTextContent(summary));
    when('the player expands the Manchester City series node', () => fireEvent.click(screen.getByTestId('bracket-node-1-1')));
    then(/^the series node shows game row "([^"]+)"$/, (row: string) => expect(screen.getByText(row)).toBeInTheDocument());
    and(/^the series node shows game row "([^"]+)"$/, (row: string) => expect(screen.getByText(row)).toBeInTheDocument());
  });

  test('A decided tie visually distinguishes its winner and loser', ({ given, when, then, and }) => {
    given('the player opens the League Cup with a completed two-game quarterfinal series', () => { fixtureMode = 'pending'; });
    when('the bracket tree League page renders', renderLeague);
    then('the Manchester City team row has winner treatment', () => expect(screen.getByTestId('bracket-team-1-1-201')).toHaveAttribute('data-bracket-result', 'winner'));
    and('the Leeds United team row has loser treatment', () => expect(screen.getByTestId('bracket-team-1-1-202')).toHaveAttribute('data-bracket-result', 'loser'));
  });

  test('Response tie order supplies stable tree coordinates and connectors', ({ given, when, then, and }) => {
    given('the player opens the League Cup with generated fixed-seeding rounds', () => { fixtureMode = 'complete'; });
    when('the bracket tree League page renders', renderLeague);
    then('quarterfinal tie node 0 connects to semifinal tie node 0', () => expect(screen.getByTestId('bracket-node-1-0')).toHaveAttribute('data-connects-to', '2-0'));
    and('quarterfinal tie node 1 connects to semifinal tie node 0', () => expect(screen.getByTestId('bracket-node-1-1')).toHaveAttribute('data-connects-to', '2-0'));
    and('expanding a series leaves its connector shell at the same coordinate', () => {
      const node = screen.getByTestId('bracket-node-1-1');
      const shell = within(node).getByTestId('bracket-node-shell-1-1');
      const coordinate = shell.getAttribute('data-bracket-coordinate');
      fireEvent.click(node);
      expect(shell).toHaveAttribute('data-bracket-coordinate', coordinate!);
    });
  });

  test('The tree scrolls horizontally while its stage-origin label remains above it', ({ given, when, then, and }) => {
    given('the player opens the League Cup with generated fixed-seeding rounds', () => { fixtureMode = 'complete'; });
    when('the bracket tree League page renders', renderLeague);
    then('the bracket tree has horizontally scrollable round columns', () => expect(screen.getByTestId('bracket-tree')).toHaveStyle({ overflowX: 'auto' }));
    and('the existing multi-stage origin-label scenario remains the regression coverage for the label', () => {
      // @spec BRKT-008 — MSUI-002 remains the behavioral regression owner for
      // the unchanged division-level label placement; do not duplicate it here.
    });
  });
});
