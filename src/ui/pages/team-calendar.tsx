import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLoaderData, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { TeamSeasonCalendar, TeamSeasonGame } from '../../api/models';
import { Button, ErrorText, PageContainer, SectionLabel } from '../components/ui';
import { TeamCrest } from '../components/team-crest';
import { formatUtcDate } from '../format-date';

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
  return formatUtcDate(value, { weekday: 'short', month: 'short', day: 'numeric' }) ?? 'TBD';
};

const monthLabel = (value: string): string =>
  formatUtcDate(value, { year: 'numeric', month: 'long' }) ?? 'Unscheduled';

// @spec SIMUI-031 — date-only string compare avoids Date/timezone drift at midnight. A null
// scheduledDate is ready unconditionally, mirroring PREGAME-005's exemption (the backend's
// simulate() guard only runs its currentDate check when scheduledDate is set).
const gameLinkLabel = (game: TeamSeasonGame, currentDate: string | null): string => {
  if (game.status === 'IN_PROGRESS') return 'View';
  if (game.status === 'COMPLETED') return 'Review';
  if (game.scheduledDate == null) return 'Prep';
  return currentDate != null && game.scheduledDate.slice(0, 10) <= currentDate ? 'Prep' : 'Preview';
};

const GameRow = ({
  game,
  teamId,
  gwId,
  isManagedTeam,
  currentDate,
  simulateStatus,
  onSimulate,
}: {
  game: TeamSeasonGame;
  teamId: string;
  gwId: string;
  isManagedTeam: boolean;
  currentDate: string | null;
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
      <Button
        intent="secondary"
        data-testid={`simulate-${game.gameId}`}
        onClick={onSimulate}
        style={{ padding: '4px 12px', fontSize: '0.78rem' }}
      >
        Simulate
      </Button>
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
      <div style={{ textAlign: 'right', minWidth: '64px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
        {/* @spec SIMUI-029,SIMUI-030 — link only on the managed team's own calendar */}
        {isManagedTeam && (
          <Link
            to={`/${gwId}/${game.leagueId}/game/${game.gameId}`}
            data-testid={`game-link-${game.gameId}`}
            style={{ fontSize: '0.78rem', fontWeight: 600 }}
          >
            {gameLinkLabel(game, currentDate)}
          </Link>
        )}
        {renderResultCell()}
      </div>
    </div>
  );
};

// @spec SCL-011
const TeamCalendar = () => {
  // @spec UI-004
  const { gwId, teamId } = useParams();
  // @spec NAVLOAD-001,NAVLOAD-003,NAVLOAD-005,NAVLOAD-007
  const loaded = useLoaderData() as { calendar: TeamSeasonCalendar | null; error: string | null };
  // @spec SIMUI-029,SIMUI-030,SIMUI-031 — managedTeamId/currentDate come from the shared
  // :gwId loader (no extra fetch), same mechanism as pre-game-prep.tsx/game-world.tsx.
  const gameWorld = useRouteLoaderData('gwId') as any;
  const isManagedTeam = gameWorld?.managedTeamId != null && Number(teamId) === gameWorld.managedTeamId;
  const currentDate = gameWorld?.currentDate ?? null;
  const [calendar, setCalendar] = useState<TeamSeasonCalendar | null>(loaded.calendar);
  const [error, setError] = useState<string | null>(loaded.error);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<CalendarFilter>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [simulateState, setSimulateState] = useState<Map<number, SimulateRowStatus>>(new Map());
  const { revalidate } = useRevalidator();
  const pendingCalendarPatch = useRef<Pick<TeamSeasonCalendar['games'][number], 'gameId' | 'status' | 'homeTeamResult' | 'awayTeamResult'> | null>(null);

  useEffect(() => {
    setCalendar((current) => {
      const patch = pendingCalendarPatch.current;
      pendingCalendarPatch.current = null;
      if (!loaded.calendar || !patch) return loaded.calendar;
      return { ...loaded.calendar, games: loaded.calendar.games.map((game) => game.gameId === patch.gameId ? { ...game, ...patch } : game) };
    });
    setError(loaded.error); setIsLoading(false); setSimulateState(new Map());
  }, [loaded]);

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
        pendingCalendarPatch.current = { gameId, status: result.status, homeTeamResult: result.homeTeamResult, awayTeamResult: result.awayTeamResult };
        // @spec NAVLOAD-006
        revalidate();
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
    <PageContainer>

      {/* Team identity */}
      <div style={{ marginBottom: '28px' }}>
        {/* @spec BADGEUI-005,BADGEUI-008 */}
        <h1 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.6rem', fontWeight: 700 }}>
          <TeamCrest name={calendar ? calendar.teamName : `Team ${teamId}`} badge={calendar?.teamBadge} size={32} testId="team-calendar-badge" />
          {calendar ? calendar.teamName : `Team ${teamId}`}
        </h1>
        {calendar && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
            Schedule
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
          <SectionLabel as="span" style={{ color: '#555' }}>
            Filter
          </SectionLabel>

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
            <Button
              intent="ghost"
              onClick={() => { setStatusFilter('all'); setDivisionFilter('all'); }}
              style={{ color: '#888', fontSize: '0.8rem', marginLeft: 'auto' }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* States */}
      {isLoading && (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading schedule…</p>
      )}

      {!isLoading && error && (
        <div style={{ border: '1px solid #fcc', background: '#fff8f8', borderRadius: '6px', padding: '16px' }}>
          <ErrorText style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>{error}</ErrorText>
          <Button intent="secondary" onClick={revalidate} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            Retry
          </Button>
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
          <SectionLabel style={{ borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
            {label}
            <span style={{ marginLeft: '8px', fontWeight: 400, color: '#bbb' }}>
              {games.length} game{games.length !== 1 ? 's' : ''}
            </span>
          </SectionLabel>
          {games.map((game) => (
            <GameRow
              key={game.gameId}
              game={game}
              teamId={teamId!}
              gwId={gwId!}
              isManagedTeam={isManagedTeam}
              currentDate={currentDate}
              simulateStatus={simulateState.get(game.gameId) ?? 'idle'}
              onSimulate={() => handleSimulate(game.gameId)}
            />
          ))}
        </div>
      ))}
    </PageContainer>
  );
};

export { TeamCalendar };
