// @spec PDETUI-001..PDETUI-009
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/player-detail-ui.feature'));

type PlayerDetail = {
  id: number;
  givenName: string;
  familyName: string;
  countryCode: string;
  bats: 'R' | 'L' | 'S';
  throws: 'R' | 'L';
  birthDate: string;
  age: number;
  primaryPosition: string;
  contact: number;
  power: number;
  armStrength: number;
  accuracy: number;
  reaction: number;
  vision: number;
  discipline: number;
  positions: Record<string, number>;
  pitches: Array<{ type: string; velocity: number; control: number; spin: number }>;
  contract: { team: { id: number; name: string }; startDate: string; endDate: string } | null;
};

const detail = (overrides: Partial<PlayerDetail> = {}): PlayerDetail => ({
  id: 100,
  givenName: 'Marcus',
  familyName: 'Velandez',
  countryCode: 'US',
  bats: 'R',
  throws: 'R',
  birthDate: '2001-06-15',
  age: 24,
  primaryPosition: 'Pitcher',
  contact: 70,
  power: 65,
  armStrength: 60,
  accuracy: 62,
  reaction: 71,
  vision: 66,
  discipline: 64,
  positions: { Pitcher: 90, Catcher: 10, FirstBase: 5, SecondBase: 5, ThirdBase: 5, Shortstop: 5, LeftField: 10, CenterField: 10, RightField: 10 },
  pitches: [
    { type: 'Fastball', velocity: 80, control: 70, spin: 60 },
    { type: 'Curveball', velocity: 60, control: 75, spin: 82 },
    { type: 'Slider', velocity: 70, control: 72, spin: 78 },
    { type: 'Changeup', velocity: 65, control: 74, spin: 68 },
  ],
  contract: { team: { id: 10, name: 'Manchester Mariners' }, startDate: '2025-01-01', endDate: '2027-12-31' },
  ...overrides,
});

let players: Record<number, PlayerDetail> = {};
let failedPlayerIds: number[] = [];
let unmountPage: (() => void) | undefined;
let router: ReturnType<typeof createMemoryRouter>;

// @spec PDETUI-001..PDETUI-009,RLDRUI-006
const renderAt = (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  const page = render(<RouterProvider router={router} />);
  unmountPage = page.unmount;
};

// @spec PDETUI-001..PDETUI-009
const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const match = input.toString().match(/^\/api\/player\/(\d+)$/);
    const id = Number(match?.[1]);
    const status = failedPlayerIds.includes(id) || !players[id] ? 404 : 200;
    return Promise.resolve({ ok: status === 200, status, json: () => Promise.resolve(players[id]) });
  }) as jest.Mock;
};

beforeEach(() => {
  players = {};
  failedPlayerIds = [];
  installFetch();
});
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('The page renders a persistent masthead and a page-level tab bar', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail with a current Contract', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    // @spec PDETUI-006
    then('the page shows the identity masthead with Player 100\'s name', async () => expect(await screen.findByTestId('player-masthead')).toHaveTextContent('Marcus Velandez'));
    // @spec PDETUI-008
    and('the masthead shows the display-only OVR badge beside the primary-position badge', () => {
      expect(screen.getByTestId('display-ovr-badge')).toHaveTextContent('OVR: 65');
      expect(screen.getByTestId('primary-position-badge').nextElementSibling).toBe(screen.getByTestId('display-ovr-badge'));
    });
    // @spec PDETUI-006
    and('the page shows an Overview tab', () => expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument());
    // @spec PDETUI-006
    and('the page shows a Positions tab', () => expect(screen.getByRole('button', { name: 'Positions' })).toBeInTheDocument());
    // @spec PDETUI-006
    and('the page shows a Pitch repertoire tab', () => expect(screen.getByRole('button', { name: 'Pitch repertoire' })).toBeInTheDocument());
  });

  test('Overview shows flat-7 tinted ratings, a contract block, and the deferred career hook', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail with a current Contract', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Overview tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Overview' })));
    // @spec PDETUI-008
    then('the Overview shows the flat-7 tinted ratings', async () => expect(await screen.findAllByTestId(/player-rating-/)).toHaveLength(7));
    // @spec PDETUI-008
    and('the Overview does not show a Display OVR toggle', () => expect(screen.queryByRole('button', { name: /display ovr/i })).toBeNull());
    // @spec PDETUI-008
    and('the Overview shows a contract block with the team and term', () => expect(screen.getByTestId('contract-block')).toHaveTextContent('Manchester Mariners 2025-01-01 – 2027-12-31'));
    // @spec PDETUI-008
    and('the Overview shows a Career & accomplishments hook', () => expect(screen.getByTestId('career-deferred')).toBeInTheDocument());
  });

  test('The Positions tab offers a view-switcher over the 9-key positions map', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail with the full positions map', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Positions tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Positions' })));
    // @spec PDETUI-007
    then('the Positions tab shows a view-switcher with field diagram, bar grid, and coverage pills options', () => ['Field diagram', 'Bar grid', 'Coverage pills'].forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument()));
    // @spec PDETUI-007
    and('the field diagram is shown by default', () => expect(screen.getByTestId('position-field-diagram')).toBeInTheDocument());
  });

  test('Position affinity remains legible across the polished Positions views', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail with the full positions map', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Positions tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Positions' })));
    // @spec PDETUI-007
    then('the masthead primary-position badge uses the primary affinity tint', () => expect(screen.getByTestId('primary-position-badge')).toHaveStyle({ background: 'hsl(108 72% 58%)' }));
    // @spec PDETUI-007
    and('the field diagram shows a baseball field, affinity legend, and visible affinity for every position', () => {
      expect(screen.getByTestId('position-field-dirt')).toBeInTheDocument();
      expect(screen.getByTestId('position-field-mound')).toBeInTheDocument();
      expect(screen.getByTestId('position-affinity-legend')).toHaveTextContent('Low affinity');
      expect(screen.getAllByTestId(/field-position-affinity-/)).toHaveLength(9);
    });
    // @spec PDETUI-007
    and('the field diagram explicitly labels the primary position', () => expect(screen.getByTestId('field-position-primary-Pitcher')).toHaveTextContent('Primary'));
    // @spec PDETUI-007
    and('the field diagram includes Left Field and Right Field markers', () => {
      expect(screen.getByTestId('field-position-LeftField')).toBeInTheDocument();
      expect(screen.getByTestId('field-position-RightField')).toBeInTheDocument();
    });
    when('the player selects the bar grid view', () => fireEvent.click(screen.getByRole('button', { name: 'Bar grid' })));
    // @spec PDETUI-007
    then('the bar grid includes Left Field and Right Field with visible affinities', () => {
      expect(screen.getByTestId('bar-position-LeftField')).toHaveTextContent('LF 10');
      expect(screen.getByTestId('bar-position-RightField')).toHaveTextContent('RF 10');
    });
    when('the player selects the coverage pills view', () => fireEvent.click(screen.getByRole('button', { name: 'Coverage pills' })));
    // @spec PDETUI-007
    then('the coverage pills include Left Field and Right Field with visible affinities', () => {
      expect(screen.getByTestId('pill-position-LeftField')).toHaveTextContent('LF 10');
      expect(screen.getByTestId('pill-position-RightField')).toHaveTextContent('RF 10');
    });
  });

  test('The Positions view-switcher defaults to field diagram and is not URL-encoded', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Positions tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Positions' })));
    and('the player selects the bar grid view', () => fireEvent.click(screen.getByRole('button', { name: 'Bar grid' })));
    and('the player reloads the page', () => { unmountPage?.(); renderAt('/1/player/100'); });
    // @spec PDETUI-004
    then('the Positions tab is shown with the field diagram by default', async () => { fireEvent.click(await screen.findByRole('button', { name: 'Positions' })); expect(screen.getByTestId('position-field-diagram')).toBeInTheDocument(); });
    // @spec PDETUI-004
    and('the URL does not encode the sub-view', () => expect(router.state.location.pathname).toBe('/1/player/100'));
  });

  test('A pitcher\'s Pitch repertoire tab shows the 4-pitch cards', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail as a Pitcher with four pitches', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Pitch repertoire tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Pitch repertoire' })));
    // @spec PDETUI-009
    then('the tab shows four pitch cards each with VEL, CTL, and SPN', async () => { const cards = await screen.findAllByTestId(/pitch-card-/); expect(cards).toHaveLength(4); cards.forEach((card) => expect(card).toHaveTextContent(/VEL.*CTL.*SPN/)); });
  });

  test('A non-pitcher\'s Pitch repertoire tab is omitted entirely', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/101 returns Player 101\'s detail as a Shortstop', () => { players[101] = detail({ id: 101, primaryPosition: 'Shortstop' }); });
    when('the player navigates to "/1/player/101"', () => renderAt('/1/player/101'));
    // @spec PDETUI-003
    then('the page shows an Overview tab', async () => expect(await screen.findByRole('button', { name: 'Overview' })).toBeInTheDocument());
    // @spec PDETUI-003
    and('the page shows a Positions tab', () => expect(screen.getByRole('button', { name: 'Positions' })).toBeInTheDocument());
    // @spec PDETUI-003
    and('the page does not show a Pitch repertoire tab', () => expect(screen.queryByRole('button', { name: 'Pitch repertoire' })).toBeNull());
  });

  test('A free agent renders a Free Agent chip and the Positions and Pitch tabs normally', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/102 returns Player 102\'s detail as a free agent Pitcher with contract null', () => { players[102] = detail({ id: 102, contract: null }); });
    when('the player navigates to "/1/player/102"', () => renderAt('/1/player/102'));
    // @spec PDETUI-002
    then('the masthead shows a Free Agent chip in place of a team link', async () => { expect(await screen.findByTestId('free-agent-chip')).toBeInTheDocument(); expect(screen.queryByRole('link', { name: 'Manchester Mariners' })).toBeNull(); });
    // @spec PDETUI-002
    and('the page shows a Positions tab', () => expect(screen.getByRole('button', { name: 'Positions' })).toBeInTheDocument());
    // @spec PDETUI-002
    and('the page shows a Pitch repertoire tab', () => expect(screen.getByRole('button', { name: 'Pitch repertoire' })).toBeInTheDocument());
  });

  test('A failed or not-found player fetch renders a not-found state', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/9999 fails', () => { failedPlayerIds = [9999]; });
    when('the player navigates to "/1/player/9999"', () => renderAt('/1/player/9999'));
    // @spec PDETUI-001
    then('the page renders a not-found state', async () => expect(await screen.findByTestId('player-not-found')).toBeInTheDocument());
    // @spec PDETUI-001
    and('the masthead is not partially rendered', () => expect(screen.queryByTestId('player-masthead')).toBeNull());
  });

  test('The Career & accomplishments hook renders a deferred-state message, not an empty section', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1', () => {});
    given('GET /api/player/100 returns Player 100\'s detail', () => { players[100] = detail(); });
    when('the player navigates to "/1/player/100"', () => renderAt('/1/player/100'));
    and('the player selects the Overview tab', async () => fireEvent.click(await screen.findByRole('button', { name: 'Overview' })));
    // @spec PDETUI-005
    then('the Career & accomplishments hook explains what will graduate in', async () => expect(await screen.findByTestId('career-deferred')).toHaveTextContent(/Stats.*contract history.*awards/i));
    // @spec PDETUI-005
    and('it is not rendered as an empty data section', () => expect(screen.queryByTestId('career-empty')).toBeNull());
  });
});
