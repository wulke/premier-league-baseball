import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { TeamSeasonCalendar, TeamSeasonGame } from '../../api/models';
import { useGameWorldContext } from '../context/game-world-context';

type CalendarFilter = 'all' | 'scheduled' | 'played';
type SimulateRowStatus = 'idle' | 'loading' | 'error';

const isPlayed = (game: TeamSeasonGame) =>
  game.status === 'COMPLETED';

const gameSort = (a: TeamSeasonGame, b: TeamSeasonGame): number => {
  if (!a.scheduledDate && !b.scheduledDate) return a.gameId - b.gameId;
  if (!a.scheduledDate) return 1;
  if (!b.scheduledDate) return -1;
  return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
};

const formatGameDate = (value: string | null): string => {
  if (!value) return 'TBD';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const monthLabel = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

const GameRow = ({
  game,
  teamId,
  simulateStatus,
  onSimulate,
}: {
  game: TeamSeasonGame;
  teamId: string;
  simulateStatus: SimulateRowStatus;
  onSimulate: () => void;
}) => {
  const isHome = game.homeTeamId === Number(teamId);
  const isBye = game.awayTeamId === null;
  const opponent = isBye ? 'Bye' : (isHome ? game.awayTeamName : game.homeTeamName);

  // Flow A (SIMUI-019..026): the result cell branches on `game.status` first (COMPLETED /
  // IN_PROGRESS render their own indicator), then on the per-row `simulateStatus` for a
  // still-SCHEDULED game (idle button / loading spinner / persistent error icon — no retry).
  const renderResultCell = () => {
    if (game.status === 'COMPLETED') {
      if (isBye) {
        return (
          <span data-testid={`bye-${game.gameId}`} style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Bye
          </span>
        );
      }

      return (
        <span data-testid={`score-${game.gameId}`} style={{ fontWeight: 700, fontSize: '0.9rem' }}>
          {isHome
            ? `${game.homeTeamResult}–${game.awayTeamResult}`
            : `${game.awayTeamResult}–${game.homeTeamResult}`}
        </span>
      );
    }

    if (game.status === 'IN_PROGRESS') {
      return (
        <span data-testid={`status-${game.gameId}`} style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 500 }}>
          In Progress
        </span>
      );
    }

    if (simulateStatus === 'loading') {
      return (
        <span data-testid={`spinner-${game.gameId}`} style={{ fontSize: '0.75rem', color: '#888' }}>
          Simulating…
        </span>
      );
    }

    if (simulateStatus === 'error') {
      return (
        <span data-testid={`error-${game.gameId}`} role="img" aria-label="Simulation failed" style={{ color: '#c00', fontSize: '0.95rem' }}>
          ⚠
        </span>
      );
    }

    return (
      <button
        data-testid={`simulate-${game.gameId}`}
        onClick={onSimulate}
        style={{
          padding: '4px 12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          background: '#fff',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontWeight: 600,
        }}
      >
        Simulate
      </button>
    );
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '120px 60px 1fr auto',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
      fontSize: '0.875rem',
    }}>
      {/* Date */}
      <div style={{ color: '#666', fontSize: '0.8rem' }}>
        {formatGameDate(game.scheduledDate)}
      </div>

      {/* Home/Away badge */}
      <div>
        <span style={{
          display: 'inline-block',
          padding: '2px 7px',
          borderRadius: '3px',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          background: isHome ? '#000' : '#f0f0f0',
          color: isHome ? '#fff' : '#555',
        }}>
          {isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent + competition */}
      <div>
        <span style={{ fontWeight: 600 }}>
          {isBye || isHome ? 'vs' : '@'} {opponent}
        </span>
        <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#999' }}>
          {game.divisionName}{game.roundLabel ? ` · ${game.roundLabel}` : ''}
        </span>
      </div>

      {/* Result, status, or simulate action */}
      <div style={{ textAlign: 'right', minWidth: '64px' }}>
        {renderResultCell()}
      </div>
    </div>
  );
};

const TeamCalendar = () => {
  // @spec UI-004
  const { gwId, teamId } = useParams();
  const [calendar, setCalendar] = useState<TeamSeasonCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<CalendarFilter>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [retryToken, setRetryToken] = useState<number>(0);
  const [simulateState, setSimulateState] = useState<Map<number, SimulateRowStatus>>(new Map());
  // Flow A — subscribe to the shared refreshToken (LLD Flow C) so a batch simulate elsewhere
  // (NavRail) triggers a full re-fetch here, keeping single-row and batch simulate consistent.
  const { refreshToken: contextRefreshToken } = useGameWorldContext();

  useEffect(() => {
    if (!teamId) return;
    let isMounted = true;

    setIsLoading(true);
    setError(null);
    setSimulateState(new Map());

    const qs = new URLSearchParams();
    if (gwId) qs.append('gwId', gwId);

    fetch(`${Endpoints.GetTeamSchedule.replace(':teamId', teamId)}?${qs.toString()}`, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((response) => {
      if (!response.ok) throw Error(`Failed to load team calendar (${response.status})`);
      return response.json();
    }).then((data) => {
      if (!isMounted) return;
      setCalendar(data);
    }).catch((err) => {
      if (!isMounted) return;
      console.error(err);
      setError('Unable to load team calendar right now.');
      setCalendar(null);
    }).finally(() => {
      if (!isMounted) return;
      setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, [gwId, retryToken, contextRefreshToken, teamId]);

  const handleSimulate = (gameId: number) => {
    setSimulateState((prev) => new Map(prev).set(gameId, 'loading'));

    fetch(Endpoints.SimulateGame.replace(':gameId', String(gameId)), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((result) => {
        // Patch the row in-place (LLD Flow A) — no full re-fetch needed for a single-game win.
        setCalendar((prev) => (prev ? {
          ...prev,
          games: prev.games.map((g) => (g.gameId === gameId
            ? { ...g, status: result.status, homeTeamResult: result.homeTeamResult, awayTeamResult: result.awayTeamResult }
            : g)),
        } : prev));
        setSimulateState((prev) => {
          const next = new Map(prev);
          next.delete(gameId);
          return next;
        });
      })
      .catch(() => {
        // Error icon persists (no retry) until the player navigates away or the calendar
        // re-fetches via refreshToken.
        setSimulateState((prev) => new Map(prev).set(gameId, 'error'));
      });
  };

  const divisions = useMemo(() => {
    const options = new Map<string, string>();
    (calendar?.games ?? []).forEach((game) => options.set(`${game.divisionId}`, game.divisionName));
    return Array.from(options.entries());
  }, [calendar]);

  const filteredGames = useMemo(() => {
    let games = [...(calendar?.games ?? [])];
    games.sort(gameSort);
    if (statusFilter === 'scheduled') games = games.filter((game) => !isPlayed(game));
    if (statusFilter === 'played') games = games.filter(isPlayed);
    if (divisionFilter !== 'all') games = games.filter((game) => `${game.divisionId}` === divisionFilter);
    return games;
  }, [calendar, divisionFilter, statusFilter]);

  const groupedGames = useMemo(() => {
    const groups: Record<string, TeamSeasonGame[]> = {};
    filteredGames.forEach((game) => {
      const label = game.scheduledDate ? monthLabel(game.scheduledDate) : 'Unscheduled';
      if (!groups[label]) groups[label] = [];
      groups[label].push(game);
    });

    return Object.entries(groups).sort(([left], [right]) => {
      if (left === 'Unscheduled') return 1;
      if (right === 'Unscheduled') return -1;
      return new Date(left).getTime() - new Date(right).getTime();
    });
  }, [filteredGames]);

  const played = (calendar?.games ?? []).filter(isPlayed).length;
  const total = (calendar?.games ?? []).length;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* Team identity */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 700 }}>
          {calendar ? calendar.teamName : `Team ${teamId}`}
        </h1>
        {calendar && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
            {calendar.year} Season
            {total > 0 && (
              <span style={{ marginLeft: '10px', color: '#aaa' }}>
                · {played} of {total} games played
              </span>
            )}
          </p>
        )}
      </div>

      {/* Filters */}
      {!isLoading && !error && (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          padding: '12px 16px',
          background: '#f8f8f8',
          borderRadius: '6px',
          alignItems: 'center',
          fontSize: '0.85rem',
        }}>
          <span style={{ fontWeight: 600, color: '#555', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Filter
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#666' }}>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CalendarFilter)}
              style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '3px 6px', fontSize: '0.85rem', background: '#fff' }}
            >
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="played">Played</option>
            </select>
          </label>

          {divisions.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#666' }}>Competition</span>
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '3px 6px', fontSize: '0.85rem', background: '#fff' }}
              >
                <option value="all">All</option>
                {divisions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}

          {(statusFilter !== 'all' || divisionFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setDivisionFilter('all'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.8rem', padding: 0, marginLeft: 'auto' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* States */}
      {isLoading && (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading schedule…</p>
      )}

      {!isLoading && error && (
        <div style={{ border: '1px solid #fcc', background: '#fff8f8', borderRadius: '6px', padding: '16px' }}>
          <p style={{ margin: '0 0 10px', color: '#c00', fontSize: '0.9rem' }}>{error}</p>
          <button
            onClick={() => setRetryToken((v) => v + 1)}
            style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && groupedGames.length === 0 && (
        <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic' }}>
          No games match the current filters.
        </p>
      )}

      {/* Games grouped by month */}
      {!isLoading && !error && groupedGames.map(([label, games]) => (
        <div key={label} style={{ marginBottom: '28px' }}>
          <h3 style={{
            margin: '0 0 6px',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: '#888',
            fontWeight: 600,
            borderBottom: '1px solid #eee',
            paddingBottom: '6px',
          }}>
            {label}
            <span style={{ marginLeft: '8px', fontWeight: 400, color: '#bbb' }}>
              {games.length} game{games.length !== 1 ? 's' : ''}
            </span>
          </h3>
          {games.map((game) => (
            <GameRow
              key={game.gameId}
              game={game}
              teamId={teamId!}
              simulateStatus={simulateState.get(game.gameId) ?? 'idle'}
              onSimulate={() => handleSimulate(game.gameId)}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export { TeamCalendar };
