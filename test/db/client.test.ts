import { isTestEnv, resolveDbStorage } from '../../src/db/client';

// These tests lock in the test-isolation guarantee in src/db/client.ts: under
// Jest, storage is ALWAYS ':memory:' — never a file-backed DATABASE_URL. This is
// what stops every backend test's db.sync({ force: true }) (which DROPs and
// recreates every table) from clobbering the real dev.sqlite, regardless of how
// the test is launched (npm script, bare `npx jest`, IDE runner) or any ambient
// DATABASE_URL exported into the shell.
describe('db client test isolation (src/db/client.ts)', () => {
  describe('isTestEnv', () => {
    it('is true under NODE_ENV=test', () => {
      expect(isTestEnv({ NODE_ENV: 'test' })).toBe(true);
    });

    it('is true when JEST_WORKER_ID is set, even without NODE_ENV', () => {
      // covers a bare `npx jest`, which JEST_WORKER_ID marks but NODE_ENV may not
      expect(isTestEnv({ JEST_WORKER_ID: '1' })).toBe(true);
    });

    it('stays true when an IDE/runner overrides NODE_ENV but the worker id is set', () => {
      expect(isTestEnv({ NODE_ENV: 'production', JEST_WORKER_ID: '1' })).toBe(true);
    });

    it('is false outside Jest', () => {
      expect(isTestEnv({ NODE_ENV: 'production', DATABASE_URL: './dev.sqlite' })).toBe(false);
      expect(isTestEnv({})).toBe(false);
    });
  });

  describe('resolveDbStorage', () => {
    it('forces :memory: under Jest', () => {
      expect(resolveDbStorage({ NODE_ENV: 'test' })).toBe(':memory:');
      expect(resolveDbStorage({ JEST_WORKER_ID: '1' })).toBe(':memory:');
    });

    it('ignores a file-backed DATABASE_URL under Jest', () => {
      // THE guarantee: a shell-exported (e.g. via direnv/.envrc) DATABASE_URL
      // pointing at the real file must be ignored under Jest.
      expect(resolveDbStorage({ NODE_ENV: 'test', DATABASE_URL: './dev.sqlite' })).toBe(':memory:');
      expect(resolveDbStorage({ JEST_WORKER_ID: '1', DATABASE_URL: './dev.sqlite' })).toBe(':memory:');
    });

    it('uses DATABASE_URL outside Jest', () => {
      expect(resolveDbStorage({ DATABASE_URL: './dev.sqlite' })).toBe('./dev.sqlite');
    });

    it('is undefined outside Jest with no DATABASE_URL', () => {
      expect(resolveDbStorage({})).toBeUndefined();
    });
  });

  it('the live client, imported under Jest, resolves to :memory:', () => {
    // importing client.ts under jest runs its module-level resolution against the
    // real process.env — it must land on the in-memory DB.
    expect(resolveDbStorage()).toBe(':memory:');
    expect(isTestEnv()).toBe(true);
  });
});
