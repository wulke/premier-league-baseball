import { formatUtcDate } from '../../src/ui/format-date';

// Regression test for the "Simulate Today" schedule-display bug: a game whose
// scheduledDate the backend stores/compares as UTC midnight (e.g. 2025-04-07T00:00:00.000Z)
// must always display as its UTC calendar date, even when the viewer's local timezone
// is behind UTC and would otherwise roll it back a day (2025-04-07T00:00:00.000Z ->
// "Apr 6" under toLocaleDateString()'s default local-timezone behavior).
describe('formatUtcDate', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('does not roll a UTC-midnight date back a day under a timezone behind UTC', () => {
    process.env.TZ = 'America/Chicago';

    expect(formatUtcDate('2025-04-07T00:00:00.000Z', { weekday: 'short', month: 'short', day: 'numeric' }))
      .toBe('Mon, Apr 7');
  });

  it('does not roll a UTC-midnight date forward a day under a timezone ahead of UTC', () => {
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14

    expect(formatUtcDate('2025-04-07T00:00:00.000Z', { weekday: 'short', month: 'short', day: 'numeric' }))
      .toBe('Mon, Apr 7');
  });

  it('formats a plain YYYY-MM-DD (GameWorld.currentDate) consistently regardless of local timezone', () => {
    process.env.TZ = 'America/Chicago';

    expect(formatUtcDate('2025-04-07', { month: 'short', day: 'numeric', year: 'numeric' }))
      .toBe('Apr 7, 2025');
  });

  it('agrees on a calendar date across timezones on both sides of UTC', () => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
    const value = '2025-04-07T00:00:00.000Z';

    process.env.TZ = 'America/Chicago'; // UTC-5
    const behindUtc = formatUtcDate(value, options);

    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
    const aheadOfUtc = formatUtcDate(value, options);

    expect(behindUtc).toBe(aheadOfUtc);
    expect(behindUtc).toBe('April 2025');
  });

  it('returns null for an unparseable value', () => {
    expect(formatUtcDate('not-a-date')).toBeNull();
  });
});
