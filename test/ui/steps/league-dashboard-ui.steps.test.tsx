// @spec LDASH-001,LDASH-002,LDASH-003,LDASH-004,LDASH-005,LDASH-006,LDASH-007,LDASH-008,LDASH-009,LDASH-010
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/league-dashboard-ui.feature'));

type Team = { id: number; config: { name: string } };
type Division = { id: number; config: { name: string; isTopTier?: boolean; format?: { structure: 'ROUND_ROBIN' | 'KNOCKOUT' } }; Teams: Team[] };

const standingRow = (team: Team, points: number) => ({
  teamId: team.id, teamName: team.config.name, played: 5, won: 4, drawn: 0, lost: 1,
  runsFor: 20, runsAgainst: 10, runDifference: 10, points,
});

const divisionIds = { 'Top Flight': 11, Playoffs: 12 } as const;

const topFlightTeams: Team[] = [
  { id: 101, config: { name: 'Team A' } },
  { id: 102, config: { name: 'Team B' } },
];
const playoffTeams: Team[] = [
  { id: 201, config: { name: 'KO A' } },
  { id: 202, config: { name: 'KO B' } },
];

let league: any;
let standings: any[];
let brackets: any[];
let today: any[];
let router: ReturnType<typeof createMemoryRouter>;

const resetState = () => {
  league = {
    id: 1,
    gameWorldId: 1,
    config: { name: 'Premier League', type: 'League' },
    Divisions: [
      { id: divisionIds['Top Flight'], config: { name: 'Top Flight', isTopTier: true, format: { structure: 'ROUND_ROBIN' } }, Teams: topFlightTeams },
      { id: divisionIds.Playoffs, config: { name: 'Playoffs', format: { structure: 'KNOCKOUT' } }, Teams: playoffTeams },
    ],
  };
  standings = [
    { divisionId: divisionIds['Top Flight'], standings: topFlightTeams.map((team, i) => standingRow(team, 10 - i)) },
    { divisionId: divisionIds.Playoffs, standings: [] },
  ];
  brackets = [
    { divisionId: divisionIds['Top Flight'], divisionName: 'Top Flight', structure: 'ROUND_ROBIN', rounds: [] },
    {
      divisionId: divisionIds.Playoffs, divisionName: 'Playoffs', structure: 'KNOCKOUT',
      rounds: [{
        round: 1, label: 'Semifinals', status: 'PENDING',
        ties: [{ kind: 'SERIES', teamA: { teamId: 201, teamName: 'KO A' }, teamB: { teamId: 202, teamName: 'KO B' }, games: [] }],
      }],
    },
  ];
  today = [];
};

const findDivision = (name: string): Division => league.Divisions.find((d: Division) => d.config.name === name);

beforeEach(() => {
  resetState();
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (/\/api\/gameWorld\/1$/.test(url)) return response({ id: 1, year: 2025, currentDate: '2025-04-10', config: { inProgress: true, name: 'World' }, Leagues: [{ id: 1, config: league.config }] });
    if (/\/api\/league\/1\/today$/.test(url)) return response(today);
    if (/\/api\/league\/1\/standings$/.test(url)) return response(standings);
    if (/\/api\/league\/1\/bracket$/.test(url)) return response(brackets);
    if (/\/api\/league\/1$/.test(url)) return response(league);
    return response({});
  }) as jest.Mock;
});

const openDashboard = async () => {
  router = createMemoryRouter(routes, { initialEntries: ['/1/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Premier League' });
};

// Background — the default fixture (resetState) already matches this state; no-op bindings.
const bindBackground = (given: Function, and: Function) => {
  given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, () => {});
  and(/^League (\d+) "([^"]+)" has a round-robin division "([^"]+)" and a knockout division "([^"]+)"$/, () => {});
};

defineFeature(feature, (test) => {
  test('Identity header shows the champion banner once the league is decided', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has a decided champion "([^"]+)"$/, (divisionName: string, teamName: string) => {
      const division = findDivision(divisionName);
      division.Teams[0].config.name = teamName;
      const bracket = brackets.find((b) => b.divisionId === division.id)!;
      bracket.champion = { teamId: division.Teams[0].id };
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the identity header shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });

  test('Identity header falls back to the season-status subtitle before a champion is decided', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given('no division in League 1 has a decided champion', () => { /* default fixture has no champion */ });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the identity header shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });

  test('A league with games in the Today window shows the matchup banner', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^GetLeagueToday for League 1 returns a completed game "([^"]+)"$/, () => {
      today = [{
        gameId: 501, year: 2025, scheduledDate: '2025-04-10', homeTeamId: 101, homeTeamName: 'River City',
        awayTeamId: 202, awayTeamName: 'Southgate United', divisionId: divisionIds['Top Flight'], divisionName: 'Top Flight',
        leagueId: 1, leagueName: 'Premier League', roundLabel: 'Round 1', homeTeamResult: 4, awayTeamResult: 2, status: 'COMPLETED',
      }];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the Today section shows a matchup tile "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
    and(/^the "([^"]+)" lane shows the winner marker$/, (teamName: string) => {
      const lane = screen.getAllByTestId(/^today-lane-/).find((el) => el.textContent?.includes(teamName));
      expect(lane).toHaveAttribute('data-winner', 'true');
    });
  });

  test('A league with no games in the Today window omits the Today section', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given('GetLeagueToday for League 1 returns no games', () => { today = []; });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then('the League Dashboard does not show a Today section', () => {
      expect(screen.queryByTestId('today-section')).toBeNull();
    });
  });

  test("A round-robin division's condensed widget shows only its top 5 teams", ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has standings for (\d+) teams$/, (divisionName: string, count: string) => {
      const division = findDivision(divisionName);
      const teams: Team[] = Array.from({ length: Number(count) }, (_, i) => ({ id: 300 + i, config: { name: `Team ${i}` } }));
      division.Teams = teams;
      standings.find((s) => s.divisionId === division.id)!.standings = teams.map((team, i) => standingRow(team, 20 - i));
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the "([^"]+)" condensed standings widget shows exactly (\d+) rows$/, (divisionName: string, rows: string) => {
      const widget = screen.getByTestId(`condensed-standings-${findDivision(divisionName).id}`);
      expect(within(widget).getAllByRole('row')).toHaveLength(Number(rows) + 1); // +1 header row
    });
    and(/^the League Dashboard shows exactly one "([^"]+)" link$/, (label: string) => {
      expect(screen.getAllByRole('button', { name: label })).toHaveLength(1);
    });
    when(/^the player clicks "([^"]+)"$/, (label: string) => {
      fireEvent.click(screen.getByRole('button', { name: label }));
    });
    then(/^the app navigates to "([^"]+)"$/, async (target: string) => {
      await waitFor(() => expect(router.state.location.pathname).toBe(target));
    });
  });

  test('A knockout division mid-tournament shows a teaser of its first incomplete round', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has a completed "([^"]+)" round and a pending "([^"]+)" round$/, (divisionName: string, completedLabel: string, pendingLabel: string) => {
      const division = findDivision(divisionName);
      const bracket = brackets.find((b) => b.divisionId === division.id)!;
      bracket.rounds = [
        { round: 1, label: completedLabel, status: 'COMPLETE', ties: [{ kind: 'SERIES', teamA: { teamId: 201, teamName: 'KO A' }, teamB: { teamId: 202, teamName: 'KO B' }, winnerTeamId: 201, games: [] }] },
        { round: 2, label: pendingLabel, status: 'PENDING', ties: [{ kind: 'SERIES', teamA: { teamId: 201, teamName: 'KO A' }, teamB: { teamId: null, teamName: null }, games: [] }] },
      ];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the "([^"]+)" bracket teaser shows round label "([^"]+)"$/, (divisionName: string, label: string) => {
      const teaser = screen.getByTestId(`bracket-teaser-${findDivision(divisionName).id}`);
      expect(within(teaser).getByText(label)).toBeInTheDocument();
    });
    and(/^the "([^"]+)" bracket teaser does not show a "([^"]+)" round column$/, (divisionName: string, label: string) => {
      const teaser = screen.getByTestId(`bracket-teaser-${findDivision(divisionName).id}`);
      expect(within(teaser).queryByText(label)).toBeNull();
    });
  });

  test('A fully resolved knockout division shows its champion instead of a round teaser', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^every round of the "([^"]+)" division is complete with champion "([^"]+)"$/, (divisionName: string, championName: string) => {
      const division = findDivision(divisionName);
      division.Teams[0].config.name = championName;
      const bracket = brackets.find((b) => b.divisionId === division.id)!;
      bracket.champion = { teamId: division.Teams[0].id };
      bracket.rounds = [
        { round: 1, label: 'Semifinals', status: 'COMPLETE', ties: [{ kind: 'SERIES', teamA: { teamId: division.Teams[0].id, teamName: championName }, teamB: { teamId: 202, teamName: 'KO B' }, winnerTeamId: division.Teams[0].id, games: [] }] },
      ];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the "([^"]+)" section shows champion "([^"]+)"$/, (divisionName: string, championName: string) => {
      const section = screen.getByTestId(`division-section-${findDivision(divisionName).id}`);
      expect(within(section).getByText(new RegExp(championName))).toBeInTheDocument();
    });
    and(/^the "([^"]+)" section does not show a round teaser$/, (divisionName: string) => {
      expect(screen.queryByTestId(`bracket-teaser-${findDivision(divisionName).id}`)).toBeNull();
    });
  });

  test('A division with no standings or bracket yet shows the roster grid fallback', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has no standings and the "([^"]+)" division has no bracket rounds$/, (rrName: string, koName: string) => {
      standings.find((s) => s.divisionId === findDivision(rrName).id)!.standings = [];
      brackets.find((b) => b.divisionId === findDivision(koName).id)!.rounds = [];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    then(/^the "([^"]+)" section shows the team roster grid$/, (divisionName: string) => {
      const section = screen.getByTestId(`division-section-${findDivision(divisionName).id}`);
      expect(within(section).getAllByTestId(/^team-grid-badge-/).length).toBeGreaterThan(0);
    });
    and(/^the "([^"]+)" section shows the team roster grid$/, (divisionName: string) => {
      const section = screen.getByTestId(`division-section-${findDivision(divisionName).id}`);
      expect(within(section).getAllByTestId(/^team-grid-badge-/).length).toBeGreaterThan(0);
    });
  });

  test('Clicking a team identity on the dashboard opens the team hub', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has standings that include team "([^"]+)" with id (\d+)$/, (divisionName: string, teamName: string, teamId: string) => {
      const division = findDivision(divisionName);
      standings.find((s) => s.divisionId === division.id)!.standings = [standingRow({ id: Number(teamId), config: { name: teamName } }, 10)];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    and(/^the player clicks team "([^"]+)" in the condensed standings widget$/, (teamName: string) => {
      const widget = screen.getByTestId(`condensed-standings-${divisionIds['Top Flight']}`);
      fireEvent.click(within(widget).getByRole('button', { name: teamName }));
    });
    then(/^the app navigates to "([^"]+)"$/, async (target: string) => {
      await waitFor(() => expect(router.state.location.pathname).toBe(target));
    });
  });

  test('Clicking a series tie in a bracket teaser does not expand it', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the "([^"]+)" division has a pending "([^"]+)" round with an unresolved series tie$/, (divisionName: string, label: string) => {
      const division = findDivision(divisionName);
      const bracket = brackets.find((b) => b.divisionId === division.id)!;
      bracket.rounds = [{ round: 1, label, status: 'PENDING', ties: [{ kind: 'SERIES', teamA: { teamId: null, teamName: null }, teamB: { teamId: null, teamName: null }, games: [] }] }];
    });
    when('the player opens the League Dashboard for League 1', openDashboard);
    and(/^the player clicks the series tie in the "([^"]+)" bracket teaser$/, (divisionName: string) => {
      fireEvent.click(screen.getByTestId(`bracket-teaser-tie-${findDivision(divisionName).id}-0`));
    });
    then('no game rows are shown for that tie', () => {
      expect(screen.queryAllByTestId(/^bracket-round-/)).toHaveLength(0);
    });
  });
});
