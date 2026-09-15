import React, { useState } from 'react';
import { TeamSeasonGame } from '../../api/models';
import { Button } from './ui';
import { TeamCrest } from './team-crest';

// Adding a new DayEntry kind (e.g. training):
//   1. Define its shape and add it to the `DayEntry` union below.
//   2. Add a `kind -> render` mapping to DAY_ENTRY_RENDERERS.
//   3. Populate entries of that kind from wherever their source data lives —
//      CalendarStrip only groups/renders DayEntry[] by `date`; it has no
//      opinion on where an entry comes from.
type DayEntry = GameDayEntry;   // | TrainingDayEntry, etc. — future variants join here

interface GameDayEntry {
  kind: 'game';
  id: string;
  date: string;   // 'YYYY-MM-DD', derived from game.scheduledDate — the grouping key
  game: TeamSeasonGame;
}

interface CalendarStripProps {
  currentDate: string;
  seasonStart: string | null;
  seasonEnd: string | null;
  entries: DayEntry[];
  onWindowChange: (from: string, to: string) => void;
}

// @spec CALWUI-001 — centered ±3-day window anchor, matching the prior getToday span.
const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// seasonStart/seasonEnd arrive as full ISO timestamps (same shape as scheduledDate);
// normalize to a plain 'YYYY-MM-DD' for lexical comparison against windowStart.
const boundDate = (iso: string | null): string | null => (iso == null ? null : iso.slice(0, 10));

// @spec BADGEUI-009 — relocated from the retired "Today" scoreboard (#326 supersedes that
// surface with this calendar strip); TeamCrest wiring/testId convention carried over as-is.
const renderGameEntry = ({ game }: GameDayEntry) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', padding: '2px 0' }}>
    <TeamCrest name={game.homeTeamName} badge={game.homeTeamBadge} size={16} testId={`calendar-entry-badge-${game.gameId}-home`} />
    <TeamCrest name={game.awayTeamName} badge={game.awayTeamBadge} size={16} testId={`calendar-entry-badge-${game.gameId}-away`} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {game.homeTeamName} v {game.awayTeamName}
    </span>
  </div>
);

const DAY_ENTRY_RENDERERS: { [K in DayEntry['kind']]: (entry: Extract<DayEntry, { kind: K }>) => React.ReactNode } = {
  game: renderGameEntry,
};

// @spec CALWUI-001,CALWUI-002,CALWUI-003,CALWUI-004,CALWUI-005,CALWUI-006
const CalendarStrip = ({ currentDate, seasonStart, seasonEnd, entries, onWindowChange }: CalendarStripProps) => {
  const [windowStart, setWindowStart] = useState(() => addDays(currentDate, -3));

  const entriesByDate = new Map<string, DayEntry[]>();
  entries.forEach((entry) => {
    entriesByDate.set(entry.date, [...(entriesByDate.get(entry.date) ?? []), entry]);
  });

  const dates = Array.from({ length: 7 }, (_, i) => addDays(windowStart, i));
  const start = boundDate(seasonStart);
  const end = boundDate(seasonEnd);

  // @spec CALWUI-006 — clamped so navigation never renders/fetches an out-of-season window;
  // a null bound (no games at all this year) disables that direction entirely.
  const nextDisabled = end == null || addDays(windowStart, 13) > end;
  const prevDisabled = start == null || addDays(windowStart, -7) < start;

  // @spec CALWUI-005 — pages a full week at a time; the parent re-fetches for the new window.
  const shiftWindow = (deltaDays: number) => {
    const newStart = addDays(windowStart, deltaDays);
    const newEnd = addDays(newStart, 6);
    setWindowStart(newStart);
    onWindowChange(newStart, newEnd);
  };

  return (
    <div data-testid="calendar-strip">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
        <Button
          intent="secondary"
          size="sm"
          data-testid="calendar-prev"
          disabled={prevDisabled}
          onClick={() => shiftWindow(-7)}
        >
          ← Prev
        </Button>
        <Button
          intent="secondary"
          size="sm"
          data-testid="calendar-next"
          disabled={nextDisabled}
          onClick={() => shiftWindow(7)}
        >
          Next →
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
        {dates.map((date) => {
          const dayEntries = entriesByDate.get(date) ?? [];
          const isEmpty = dayEntries.length === 0;
          return (
            <div
              key={date}
              data-testid={`calendar-day-${date}`}
              data-entry-count={dayEntries.length}
              style={{
                minHeight: '64px',
                padding: '8px',
                border: '1px solid #dfe5dc',
                borderRadius: '6px',
                background: isEmpty ? '#f7f9f6' : '#fff',
                opacity: isEmpty ? 0.55 : 1,
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#777', marginBottom: '4px' }}>
                {date === currentDate ? `${date} (Today)` : date}
              </div>
              {dayEntries.map((entry) => (
                <div key={entry.id} data-testid={`calendar-entry-${entry.id}`}>
                  {DAY_ENTRY_RENDERERS[entry.kind](entry as never)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { CalendarStrip, addDays, type DayEntry, type GameDayEntry };
