import '@testing-library/jest-dom';
import 'whatwg-fetch';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// jsdom has no EventSource. GameWorld renders NotificationStream (@spec NOTIFUI-002),
// which opens one on mount, so every UI test that reaches that page needs a global
// stub even when it isn't exercising the notification stream itself. A test that
// drives live SSE messages installs test-utils' controllable mock instead, which
// overrides this inert default for the duration of that test file.
if (!('EventSource' in global)) {
  (global as any).EventSource = class {
    onmessage: ((event: { data: string }) => void) | null = null;
    close() {}
  };
}
