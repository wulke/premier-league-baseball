import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Home } from '../../src/ui/pages';
import { render } from './test-utils';

jest.setTimeout(30000);

const mockNavigate = jest.fn();

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate,
}));

describe('Home new game world form', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/api/gameWorlds')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      }

      if (url.endsWith('/api/gameWorld/new')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 99 }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits the default template leagues, teams, and year when creating a game world', async () => {
    render(<Home />);

    await screen.findByText(/no game worlds yet/i);
    fireEvent.click(screen.getByRole('button', { name: /create your first game world/i }));

    const nameInput = screen.getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'My Test World' } });
    fireEvent.click(screen.getByRole('button', { name: /create game world/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/gameWorld/new',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls.find(([url]) => `${url}`.endsWith('/api/gameWorld/new'));
    const payload = JSON.parse(requestInit.body);

    expect(payload.name).toBe('My Test World');
    expect(payload.year).toBe(new Date().getFullYear() - 1);
    expect(payload.teams).toHaveLength(44);
    expect(payload.leagues).toHaveLength(2);
    expect(payload.leagues[0].divisions).toHaveLength(2);
    expect(payload.leagues[1].divisions).toHaveLength(1);
  });
});
