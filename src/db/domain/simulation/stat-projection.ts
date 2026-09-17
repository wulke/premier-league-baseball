import { EventEnvelope } from '../events/envelope';
import { BaserunningContext, PlateAppearanceResolutionContext } from './events';
import { SyntheticLineup } from './synthetic-lineup';

// @spec PARP-011,PARP-012,PARP-013,PARP-014 — the ONLY place PlayerGameStats-shaped rows are
// derived; batting and pitching stats and team score all come from one replay of the same
// eventChain (map #136 decision #9 — no separate resolver that can drift).
export interface PlayerGameStatsProjection {
  playerId: number;
  gameId: number;
  AB: number; H: number; R: number; RBI: number; HR: number; '2B': number; '3B': number;
  BB: number; SO: number;
  GS: boolean; outsRecorded: number;
  pitchingH: number; pitchingBB: number; pitchingSO: number; ER: number;
}

const emptyRow = (playerId: number, gameId: number, isStartingPitcher: boolean): PlayerGameStatsProjection => ({
  playerId, gameId, AB: 0, H: 0, R: 0, RBI: 0, HR: 0, '2B': 0, '3B': 0, BB: 0, SO: 0,
  GS: isStartingPitcher, outsRecorded: 0, pitchingH: 0, pitchingBB: 0, pitchingSO: 0, ER: 0,
});

export const projectPlayerGameStats = (
  eventChain: EventEnvelope<PlateAppearanceResolutionContext | BaserunningContext>[],
  lineups: { home: SyntheticLineup; away: SyntheticLineup },
): PlayerGameStatsProjection[] => {
  const gameId = eventChain[0]?.gameId ?? 0;
  const rows = new Map<number, PlayerGameStatsProjection>();
  const ensure = (playerId: number, isStartingPitcher = false) => {
    if (!rows.has(playerId)) rows.set(playerId, emptyRow(playerId, gameId, isStartingPitcher));
    return rows.get(playerId)!;
  };

  [lineups.home, lineups.away].forEach((lineup) => {
    lineup.battingOrder.forEach((entry) => ensure(entry.playerId, entry.playerId === lineup.startingPitcherId));
  });

  // sequence => the PlateAppearanceResolutionContext that caused it (for RBI/ER attribution)
  const paBySequence = new Map<number, PlateAppearanceResolutionContext>();

  for (const event of eventChain) {
    if (event.type === 'PlateAppearanceResolutionEvent') {
      const { batterId, pitcherId, outcome } = event.context as PlateAppearanceResolutionContext;
      paBySequence.set(event.sequence, event.context as PlateAppearanceResolutionContext);

      const batterRow = ensure(batterId);
      const pitcherRow = ensure(pitcherId);

      if (outcome !== 'BB') batterRow.AB += 1;
      if (outcome === '1B' || outcome === '2B' || outcome === '3B' || outcome === 'HR') {
        batterRow.H += 1;                       // no separate '1B' column — H minus 2B/3B/HR derives it
        if (outcome !== '1B') batterRow[outcome] += 1;
        pitcherRow.pitchingH += 1;
      }
      if (outcome === 'BB') { batterRow.BB += 1; pitcherRow.pitchingBB += 1; }
      if (outcome === 'SO') { batterRow.SO += 1; pitcherRow.pitchingSO += 1; }
      if (outcome === 'out' || outcome === 'SO') pitcherRow.outsRecorded += 1;   // PARP-009,014
    }

    if (event.type === 'BaserunningEvent') {
      const { runnerId, toBase } = event.context as BaserunningContext;
      if (toBase !== 'home') continue;

      const causingPA = event.causedByEventId != null ? paBySequence.get(event.causedByEventId) : undefined;
      ensure(runnerId).R += 1;   // PARP-011
      if (causingPA) {
        ensure(causingPA.batterId).RBI += 1;    // PARP-013 — including the batter's own HR run
        ensure(causingPA.pitcherId).ER += 1;    // no fielding ⇒ no earned/unearned split (#136 decision 13)
      }
    }
  }

  return [...rows.values()];
};
