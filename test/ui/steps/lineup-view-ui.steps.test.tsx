// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008,LINEUI-009,LINEUI-010,LINEUI-011,LINEUI-013,LINEUI-014
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/lineup-view-ui.feature'));

type PlayerPosition = 'Pitcher' | 'Catcher' | 'FirstBase' | 'SecondBase' | 'ThirdBase' | 'Shortstop' | 'LeftField' | 'CenterField' | 'RightField';
type RosterPlayer = { id: number; givenName: string; familyName: string; countryCode: string; bats: 'R'; throws: 'R'; age: number; primaryPosition: PlayerPosition; positionCoverage: PlayerPosition[]; positions: Record<PlayerPosition, number>; contact: number; power: number; armStrength: number; accuracy: number; reaction: number; vision: number; discipline: number };
type TeamLineup = { starters: Array<{ playerId: number; battingOrder: number | null; fieldingPosition: PlayerPosition | null }>; startingPitcherId: number; bench: Array<{ playerId: number }>; bullpen: Array<{ playerId: number }> };

const ALL_POSITIONS: PlayerPosition[] = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];
const RATING = 82;

let lineup: TeamLineup;
let roster: RosterPlayer[];
let managedTeamId: number | null = null;
let rejectLineupSave = false;

const rosterPlayer = (id: number): RosterPlayer => ({
  id, givenName: `Player`, familyName: String(id), countryCode: 'US', bats: 'R', throws: 'R', age: 25,
  primaryPosition: 'Shortstop', positionCoverage: ['Shortstop'],
  positions: ALL_POSITIONS.reduce((map, position) => ({ ...map, [position]: RATING }), {} as Record<PlayerPosition, number>),
  contact: 60, power: 60, armStrength: 60, accuracy: 60, reaction: 60, vision: 60, discipline: 60,
});
const makeRoster = () => Array.from({ length: 14 }, (_, index) => rosterPlayer(index + 1));
const dhOff = (): TeamLineup => ({ starters: [
  { playerId: 1, battingOrder: 1, fieldingPosition: 'Catcher' }, { playerId: 2, battingOrder: 2, fieldingPosition: 'FirstBase' }, { playerId: 3, battingOrder: 3, fieldingPosition: 'SecondBase' },
  { playerId: 4, battingOrder: 4, fieldingPosition: 'ThirdBase' }, { playerId: 5, battingOrder: 5, fieldingPosition: 'Shortstop' }, { playerId: 6, battingOrder: 6, fieldingPosition: 'LeftField' },
  { playerId: 7, battingOrder: 7, fieldingPosition: 'CenterField' }, { playerId: 8, battingOrder: 8, fieldingPosition: 'RightField' }, { playerId: 9, battingOrder: 9, fieldingPosition: 'Pitcher' },
], startingPitcherId: 9, bench: [{ playerId: 10 }, { playerId: 11 }], bullpen: [{ playerId: 12 }, { playerId: 13 }] });
const dhOn = (): TeamLineup => ({ ...dhOff(), starters: [...dhOff().starters.slice(0, 8), { playerId: 9, battingOrder: 9, fieldingPosition: null }, { playerId: 10, battingOrder: null, fieldingPosition: 'Pitcher' }], startingPitcherId: 10, bench: [{ playerId: 11 }], bullpen: [{ playerId: 12 }] });

const MISSING_STARTER_ID = 5; // the Shortstop starter in dhOff()

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (url === '/api/team/10/lineup?gwId=1') return response(lineup);
    if (url === '/api/team/10/lineup' && (init as RequestInit | undefined)?.method === 'PUT') {
      return Promise.resolve(rejectLineupSave
        ? { ok: false, status: 422, json: () => Promise.resolve({ error: 'Starters must have batting orders 1 through 9 exactly once' }) }
        : { ok: true, status: 200, json: () => Promise.resolve(lineup) });
    }
    if (url === '/api/team/10/roster') return response(roster);
    if (url === '/api/gameWorld/1') return response({ id: 1, year: 2025, config: { name: 'Test World', inProgress: true }, Leagues: [], managedTeamId });
    return response([]);
  }) as jest.Mock;
};

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,RLDRUI-006
const renderAt = async (entry: string) => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [entry] })} />);
  await screen.findByTestId('app-shell');
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Defensive' })).toBeInTheDocument());
};

const selectTab = (name: 'Defensive' | 'Batting') => fireEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => { lineup = dhOff(); roster = makeRoster(); managedTeamId = null; rejectLineupSave = false; installFetch(); });
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('The team hub offers a Lineup tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-001
    then('the page shows a Lineup tab', () => expect(screen.getByRole('link', { name: 'Lineup' })).toBeInTheDocument());
  });

  test('A DH-off active lineup shows its nine batting starters and reserve rows on the Batting tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    and('the player selects the Batting tab', () => selectTab('Batting'));
    // @spec LINEUI-002
    then('the batting rows show starters 1 through 9 with fielding positions', async () => { await waitFor(() => expect(screen.getAllByTestId(/batting-row-/)).toHaveLength(9)); expect(screen.getByTestId('batting-row-9')).toHaveTextContent('Pitcher'); });
    // @spec LINEUI-002
    and('the starting pitcher is highlighted', () => expect(screen.getByTestId('starting-pitcher')).toHaveTextContent('Player 9'));
    // @spec LINEUI-002
    and('no DH row is shown', () => expect(screen.queryByTestId('dh-row')).toBeNull());
    // @spec LINEUI-004,LINEUI-007
    and('bench and bullpen rows tagged BENCH and BULLPEN are shown', () => {
      expect(screen.getByTestId('bench-row-10')).toHaveTextContent('BENCH');
      expect(screen.getByTestId('bullpen-row-12')).toHaveTextContent('BULLPEN');
    });
    // @spec LINEUI-004
    and('starter, bench, and bullpen rows link to player detail', () => {
      expect(within(screen.getByTestId('batting-row-1')).getByRole('link')).toHaveAttribute('href', '/1/player/1');
      expect(within(screen.getByTestId('bench-row-10')).getByRole('link', { name: 'Player 10' })).toHaveAttribute('href', '/1/player/10');
      expect(within(screen.getByTestId('bullpen-row-12')).getByRole('link', { name: 'Player 12' })).toHaveAttribute('href', '/1/player/12');
    });
  });

  test('A DH-on active lineup shows a DH row and a non-batting starting pitcher on the Batting tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-on active lineup', () => { lineup = dhOn(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    and('the player selects the Batting tab', () => selectTab('Batting'));
    // @spec LINEUI-003
    then('the batting rows show starters 1 through 9 with fielding positions', async () => { await waitFor(() => expect(screen.getAllByTestId(/batting-row-/)).toHaveLength(9)); expect(screen.getByTestId('batting-row-9')).toHaveTextContent('DH'); });
    // @spec LINEUI-003
    and('a DH row is shown', () => expect(screen.getByTestId('dh-row')).toHaveTextContent('Player 9'));
    // @spec LINEUI-003
    and('the starting pitcher is highlighted', () => expect(screen.getByTestId('starting-pitcher')).toHaveTextContent('Player 10'));
    // @spec LINEUI-004
    and('no mutating lineup controls are shown', () => expect(screen.queryByRole('button', { name: /edit|save|set starter|substitute/i })).toBeNull());
  });

  test('The Lineup tab defaults to the Defensive tab, showing each starter\'s position and rating', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-006
    then('the Defensive tab is shown by default', () => expect(screen.getByRole('tab', { name: 'Defensive' })).toHaveAttribute('aria-selected', 'true'));
    // @spec LINEUI-005
    and('the defensive rows show one row per starter with their fielding position and positional rating', async () => {
      await waitFor(() => expect(screen.getAllByTestId(/defensive-row-/)).toHaveLength(9));
      expect(screen.getByTestId('defensive-row-5')).toHaveTextContent('Shortstop');
      expect(screen.getByTestId('defensive-row-5')).toHaveTextContent(String(RATING));
    });
  });

  test('Switching between Defensive and Batting tabs does not refetch data', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    let callsBeforeTabSwitches = 0;
    when('the player navigates to "/1/team/10/lineup"', async () => {
      await renderAt('/1/team/10/lineup');
      await waitFor(() => expect(screen.getAllByTestId(/defensive-row-/)).toHaveLength(9));
      callsBeforeTabSwitches = (global.fetch as jest.Mock).mock.calls.length;
    });
    and('the player selects the Batting tab', () => selectTab('Batting'));
    and('the player selects the Defensive tab', () => selectTab('Defensive'));
    // @spec LINEUI-006
    then('no additional lineup or roster request is made', () => expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBeforeTabSwitches));
  });

  test('Bench and bullpen rows show no fielding position or rating on the Defensive tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-007
    then('bench and bullpen rows tagged BENCH and BULLPEN are shown', () => {
      expect(screen.getByTestId('bench-row-10')).toHaveTextContent('BENCH');
      expect(screen.getByTestId('bullpen-row-12')).toHaveTextContent('BULLPEN');
    });
    // @spec LINEUI-007
    and('the bench and bullpen rows show no fielding position or rating', () => {
      expect(screen.getByTestId('bench-row-10')).not.toHaveTextContent(String(RATING));
      expect(screen.getByTestId('bullpen-row-12')).not.toHaveTextContent(String(RATING));
    });
  });

  test('A starter absent from the roster response shows an em-dash rating on the Defensive tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup except one starter', () => { roster = makeRoster().filter((player) => player.id !== MISSING_STARTER_ID); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-008
    then('the row for the missing starter shows "Player #<id>" as its label', async () => {
      await waitFor(() => expect(screen.getByTestId(`defensive-row-${MISSING_STARTER_ID}`)).toHaveTextContent(`Player #${MISSING_STARTER_ID}`));
    });
    // @spec LINEUI-008
    and('the row for the missing starter shows an em dash for its rating', () => expect(screen.getByTestId(`defensive-row-${MISSING_STARTER_ID}`)).toHaveTextContent('—'));
  });

  test('A managed team enters edit mode and assigns an unassigned player', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings including unassigned players', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    then('an Edit lineup control is shown', async () => expect(await screen.findByRole('button', { name: 'Edit Lineup' })).toBeInTheDocument());
    when('the manager enters lineup edit mode', () => fireEvent.click(screen.getByRole('button', { name: 'Edit Lineup' })));
    then('the unassigned bucket is shown', () => expect(screen.getByTestId('unassigned-bucket')).toHaveTextContent('Player 14'));
    and('fielding position, derived batting slot, and role controls are shown', () => {
      expect(screen.getByTestId('role-picker-1')).toBeInTheDocument();
      expect(screen.getByTestId('position-picker-1')).toBeInTheDocument();
      expect(screen.getByTestId('batting-picker-1')).toBeDisabled();
    });
    and('the pitcher batting slot is locked to 9', () => expect(screen.getByTestId('batting-picker-9')).toHaveValue('9'));
    when('the manager assigns unassigned player 14 to the bench', () => fireEvent.change(screen.getByTestId('role-picker-14'), { target: { value: 'BENCH' } }));
    then('player 14 leaves the unassigned bucket', () => expect(screen.queryByTestId('unassigned-row-14')).toBeNull());
    and('no lineup save request has been made', () => expect((global.fetch as jest.Mock).mock.calls.some(([url, options]) => url === '/api/team/10/lineup' && options?.method === 'PUT')).toBe(false));
    when('the manager saves the lineup', () => fireEvent.click(screen.getByRole('button', { name: 'Save Lineup' })));
    // @spec LINEUI-009
    then('the active lineup draft is sent to the save endpoint', async () => await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some(([url, options]) => url === '/api/team/10/lineup' && options?.method === 'PUT')).toBe(true)));
  });

  test('A non-managed team has no lineup editing controls', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 11 as its managed club', () => { managedTeamId = 11; });
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-004,LINEUI-009
    then('no mutating lineup controls are shown', () => expect(screen.queryByRole('button', { name: /save lineup/i })).toBeNull());
  });

  test('A rejected managed-team lineup save shows the validation failure', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    and('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings for the active lineup', () => { roster = makeRoster(); });
    and('PATCH /api/team/10/lineup rejects the lineup as invalid', () => { rejectLineupSave = true; });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    and('the manager enters lineup edit mode', () => fireEvent.click(screen.getByRole('button', { name: 'Edit Lineup' })));
    and('the manager assigns unassigned player 14 to the bench', () => fireEvent.change(screen.getByTestId('role-picker-14'), { target: { value: 'BENCH' } }));
    and('the manager saves the lineup', () => fireEvent.click(screen.getByRole('button', { name: 'Save Lineup' })));
    // @spec LINEUI-011
    then('the lineup validation failure is shown', async () => await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Starters must have batting orders 1 through 9 exactly once')));
    and('the draft remains in edit mode', () => expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument());
  });

  test('Cancelling an edit discards its draft', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    and('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); });
    and('GET /api/team/10/roster returns names and ratings including unassigned players', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    and('the manager enters lineup edit mode', () => fireEvent.click(screen.getByRole('button', { name: 'Edit Lineup' })));
    and('the manager assigns unassigned player 14 to the bench', () => fireEvent.change(screen.getByTestId('role-picker-14'), { target: { value: 'BENCH' } }));
    and('the manager cancels lineup editing', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));
    then('the unassigned player is not assigned in the read-only lineup', () => expect(screen.queryByTestId('bench-row-14')).toBeNull());
  });
});
