import { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { TeamSeasonGame } from '../../api/models';
import { ActionItem } from '../components/action-items-panel';

interface LeagueRef {
  id: number;
  name: string;
}

// @spec NGAI-002 — earliest-by-date SCHEDULED game is a league's "next" game; a null
// scheduledDate sorts last, matching TeamCalendar's existing gameSort.
const nextScheduledGame = (games: TeamSeasonGame[]): TeamSeasonGame | undefined =>
  games
    .filter((game) => game.status === 'SCHEDULED')
    .sort((a, b) => {
      if (!a.scheduledDate && !b.scheduledDate) return a.gameId - b.gameId;
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return a.scheduledDate.localeCompare(b.scheduledDate);
    })[0];

// @spec NGAI-003,NGAI-004 — mirrors PREGAME-005's boundary exactly: a null scheduledDate is
// exempt from the currentDate check; otherwise the comparison is <=, not strict.
const isReadyToPrep = (game: TeamSeasonGame, currentDate: string | null | undefined): boolean =>
  game.scheduledDate == null || (currentDate != null && game.scheduledDate.slice(0, 10) <= currentDate);

// @spec NGAI-001,NGAI-002,NGAI-003,NGAI-004,NGAI-005,NGAI-006 — the first real ActionItemsPanel
// producer: the managed team's next ready-to-sim game, surfaced once per league.
const useNextGameActionItems = (
  gwId: string | undefined,
  managedTeamId: number | null | undefined,
  currentDate: string | null | undefined,
  leagues: LeagueRef[],
): ActionItem[] => {
  const [items, setItems] = useState<ActionItem[]>([]);
  // @spec NGAI-001 — callers (game-world.tsx) recompute `leagues` fresh every render from
  // `gw.Leagues`, so depending on the array reference itself would re-run this effect (and
  // re-fetch) on every render; a content-derived key keeps the effect stable across renders
  // where the underlying league set hasn't actually changed.
  const leaguesKey = leagues.map((league) => `${league.id}:${league.name}`).join(',');

  useEffect(() => {
    if (!gwId || managedTeamId == null || leagues.length === 0) {
      setItems([]);
      return;
    }

    let cancelled = false;

    // @spec NGAI-002 — one fetch per league, independent of the others: a single league's
    // failed request must not blank out another league's item.
    Promise.all(leagues.map(async (league): Promise<ActionItem | null> => {
      const games: TeamSeasonGame[] = await fetch(
        `${Endpoints.GetTeamSchedule.replace(':teamId', String(managedTeamId))}?${new URLSearchParams({ gwId, leagueId: String(league.id) })}`,
        { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => (Array.isArray(body?.games) ? body.games : []))
        .catch(() => []);

      const game = nextScheduledGame(games);
      if (!game || !isReadyToPrep(game, currentDate)) return null;

      const opponentName = game.homeTeamId === managedTeamId ? game.awayTeamName : game.homeTeamName;

      return {
        id: `next-game-league-${league.id}`,
        label: `${opponentName} (${league.name}) is ready to prep`,
        severity: 'warning',
        href: `/${gwId}/${league.id}/game/${game.gameId}`,
        ctaLabel: 'Prep',
      };
    }))
      .then((results) => {
        if (!cancelled) setItems(results.filter((item): item is ActionItem => item != null));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [gwId, managedTeamId, currentDate, leaguesKey]);

  return items;
};

export { useNextGameActionItems };
export type { LeagueRef };
