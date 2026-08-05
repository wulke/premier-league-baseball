// @spec MSUI-001,MSUI-002,MSUI-003 — multi-stage League UI acceptance bindings
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { screen, within } from '@testing-library/react';
import { render } from '../test-utils';
import { GameWorldProvider } from '../../../src/ui/context/game-world-context';
import { League } from '../../../src/ui/pages';

const feature = loadFeature(path.resolve(__dirname, '../features/multi-stage-season-ui.feature'));

const mockNavigate = jest.fn();
let renderMode: 'before' | 'advanced' | 'champion' = 'before';

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: () => ({ gwId: '1', leagueId: '162' }),
  useNavigate: () => mockNavigate,
}));

const league = {
  id: 162,
  gameWorldId: 1,
  config: {
    name: 'Champions League',
    type: 'League Cup',
    stages: [
      { id: 'group-stage', name: 'Group Stage' },
      { id: 'knockout', name: 'Knockout Stage' },
    ],
  },
  Divisions: [
    { id: 1, config: { name: 'Group A', stageId: 'group-stage' }, Teams: [{ id: 11, config: { name: 'Group A Winners' } }] },
    { id: 2, config: { name: 'Group B', stageId: 'group-stage' }, Teams: [{ id: 21, config: { name: 'Group B Winners' } }] },
    {
      id: 3,
      config: {
        name: 'Knockout Stage',
        stageId: 'knockout',
        isTopTier: true,
        format: { structure: 'KNOCKOUT' },
        seedingSelection: { kind: 'TOP_N_PER_DIVISION', fromStage: 'group-stage', topN: 2 },
      },
      Teams: [],
    },
  ],
};

const standings = [
  { divisionId: 1, standings: [{ teamId: 11, teamName: 'Group A Winners', played: 6, won: 4, drawn: 1, lost: 1, runsFor: 12, runsAgainst: 4, runDifference: 8, points: 13 }] },
  { divisionId: 2, standings: [{ teamId: 21, teamName: 'Group B Winners', played: 6, won: 4, drawn: 1, lost: 1, runsFor: 10, runsAgainst: 3, runDifference: 7, points: 13 }] },
];

const bracket = () => [{
  divisionId: 3,
  divisionName: 'Knockout Stage',
  structure: 'KNOCKOUT' as const,
  champion: renderMode === 'champion' ? { teamId: 11 } : undefined,
  rounds: renderMode === 'before' ? [] : [{
    round: 1,
    label: 'Round of 16',
    status: 'IN_PROGRESS' as const,
    ties: [{
      kind: 'SERIES' as const,
      teamA: { teamId: 11, teamName: 'Group A Winners' },
      teamB: { teamId: 21, teamName: 'Group B Winners' },
      games: [],
    }],
  }],
}];

beforeEach(() => {
  mockNavigate.mockReset();
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    const body = url.endsWith('/standings') ? standings : url.endsWith('/bracket') ? bracket() : league;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as jest.Mock;
});

const renderLeague = async () => {
  render(<GameWorldProvider gwId="1"><League /></GameWorldProvider>);
  await screen.findByRole('heading', { name: 'Champions League' });
};

const getCard = (name: string) => {
  const division = league.Divisions.find((entry) => entry.config.name === name)!;
  return screen.getByTestId(`division-card-${division.id}`);
};

defineFeature(feature, (test) => {
  test('Group-stage divisions render their existing standings tables', ({ given, when, then, and }) => {
    given('the player opens the Champions League on the existing League route', () => { renderMode = 'before'; });
    when('the multi-stage League page renders before knockout advancement', renderLeague);
    then(/^the "([^"]+)" card shows the standings table$/, (name: string) => {
      expect(within(getCard(name)).getByRole('columnheader', { name: 'Pos' })).toBeInTheDocument();
    });
    and(/^the "([^"]+)" card shows the standings table$/, (name: string) => {
      expect(within(getCard(name)).getByRole('columnheader', { name: 'Pos' })).toBeInTheDocument();
    });
  });

  test('The bracket identifies its completed group-stage origin after advancement', ({ given, when, then, and }) => {
    given('the player opens the Champions League on the existing League route', () => { renderMode = 'advanced'; });
    when('the multi-stage League page renders after group-stage advancement', renderLeague);
    then(/^the "([^"]+)" card shows "([^"]+)"$/, (name: string, text: string) => {
      expect(within(getCard(name)).getByText(text)).toBeInTheDocument();
    });
    and(/^the "([^"]+)" card shows round "([^"]+)"$/, (name: string, label: string) => {
      expect(within(getCard(name)).getByText(label)).toBeInTheDocument();
    });
  });

  test('The knockout champion drives the existing champion banner', ({ given, when, then }) => {
    given('the player opens the Champions League on the existing League route', () => { renderMode = 'champion'; });
    when('the multi-stage League page renders with a knockout champion', renderLeague);
    then(/^the League identity block shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });
});
