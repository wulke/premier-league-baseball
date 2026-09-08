// @spec GWT-004 — game-world template picker UI acceptance bindings
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../test-utils';
import { Home } from '../../../src/ui/pages';
import { useDefaultGameWorld, GameWorldType } from '../../../src/api/models';

const feature = loadFeature(path.resolve(__dirname, '../features/game-world-templates-ui.feature'));

const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate,
}));

let postedPayload: any | null = null;

defineFeature(feature, (test) => {
  beforeEach(() => {
    mockNavigate.mockClear();
    postedPayload = null;
    // GET game worlds → empty list so the create form renders
    global.fetch = jest.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/api/gameWorld') && (!init || init.method === 'GET' || !init.method)) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url.includes('/api/gameWorld/new') && init?.method === 'POST') {
        postedPayload = JSON.parse(init.body);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 42 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }) as jest.Mock;
  });

  test('The create-world form offers both pickable templates', ({ given, then, and }) => {
    given('the player opens the home create-world form', () => {
      render(<Home />);
      fireEvent.click(screen.getByRole('button', { name: /\+ new game world/i }));
    });

    then(/^the template selector lists "(.*)"$/, (template: string) => {
      expect(screen.getByRole('option', { name: template })).toBeInTheDocument();
    });

    and(/^the template selector lists "(.*)"$/, (template: string) => {
      expect(screen.getByRole('option', { name: template })).toBeInTheDocument();
    });
  });

  test('Selecting Champions League shows its bundle summary and submits that bundle', ({ given, when, then, and }) => {
    given('the player opens the home create-world form', () => {
      render(<Home />);
      fireEvent.click(screen.getByRole('button', { name: /\+ new game world/i }));
    });

    when(/^the player selects the "(.*)" template$/, (template: string) => {
      fireEvent.change(screen.getByRole('combobox', { name: /template/i }), { target: { value: template } });
    });

    then(/^the summary shows "(.*)"$/, (text: string) => {
      expect(screen.getByText(new RegExp(text, 'i'))).toBeInTheDocument();
    });

    and(/^the summary lists the "(.*)" competition$/, (competition: string) => {
      expect(screen.getByText(new RegExp(`${competition} — \\d+ divisions`, 'i'))).toBeInTheDocument();
    });

    and('the create-world request posts the Champions League bundle', async () => {
      fireEvent.click(screen.getByRole('button', { name: /create/i }));
      await waitFor(() => expect(postedPayload).not.toBeNull());
      const expected = useDefaultGameWorld(GameWorldType.ChampionsLeague);
      // TLO-002 — the template's League owns its 32-team pool
      expect(postedPayload.leagues[0].teams).toHaveLength(32);
      expect(postedPayload.leagues.map((l: any) => l.name)).toEqual(expected.leagues.map((l: any) => l.name));
    });
  });
});
