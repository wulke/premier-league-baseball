// Every date the backend sends (scheduledDate, currentDate, seasonStart/End) is a UTC-anchored
// calendar date — the domain layer's own date comparisons (src/db/domain/game.ts toDateStr) are
// UTC-based. Formatting with the browser's local timezone can silently roll the displayed date
// back or forward a day depending on the viewer's locale. Always format through this helper so
// the UI never drifts from what the backend actually compares against.
export const formatUtcDate = (value: string, options: Intl.DateTimeFormatOptions = {}): string | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
};
