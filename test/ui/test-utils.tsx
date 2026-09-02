import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router';

/**
 * Standardizes mocking of the global fetch API for UI BDD tests.
 */
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    })
  ) as jest.Mock;
};

/**
 * A controllable fake EventSource for SSE-consuming components — jsdom has no native
 * EventSource. Mirrors mockFetch's role: install once per test, then drive it by url.
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

export const installEventSource = () => {
  MockEventSource.instances = [];
  (global as any).EventSource = MockEventSource;
  return MockEventSource;
};

export const emitSSEMessage = (url: string, data: any) => {
  const instance = MockEventSource.instances.find((candidate) => candidate.url === url && !candidate.closed);
  instance?.onmessage?.({ data: JSON.stringify(data) } as any);
};

/**
 * Wraps components with necessary providers (Router, Context, etc.) for testing.
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
