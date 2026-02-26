import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { TeamSeasonCalendar, TeamSeasonGame } from '../../api/models';

type CalendarFilter = 'all' | 'scheduled' | 'played';

const isPlayed = (game: TeamSeasonGame) =>
  game.homeTeamResult !== null && game.awayTeamResult !== null;

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

const GameRow = ({ game, teamId }: { game: TeamSeasonGame; teamId: string }) => {
  const isHome = game.homeTeamId === Number(teamId);
  const opponent = isHome ? game.awayTeamName : game.homeTeamName;
  const played = isPlayed(game);

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
          {isHome ? 'vs' : '@'} {opponent}
        </span>
        <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#999' }}>
          {game.divisionName}{game.roundLabel ? ` · ${game.roundLabel}` : ''}
        </span>
      </div>

      {/* Result or status */}
      <div style={{ textAlign: 'right', minWidth: '64px' }}>
        {played ? (
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {isHome
              ? `${game.homeTeamResult}–${game.awayTeamResult}`
              : `${game.awayTeamResult}–${game.homeTeamResult}`}
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 500 }}>Scheduled</span>
        )}
      </div>
    </div>
  );
};

const TeamCalendar = () => {
  const { gwId, leagueId, teamId } = useParams();
  const [calendar, setCalendar] = useState<TeamSeasonCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<CalendarFilter>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [refreshToken, setRefreshToken] = useState<number>(0);

  useEffect(() => {
    if (!teamId) return;
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (gwId) qs.append('gwId', gwId);
    if (leagueId) qs.append('leagueId', leagueId);

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
  }, [gwId, leagueId, refreshToken, teamId]);

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

      {/* Nav bar */}
      <header style={{
        borderBottom: '2px solid #000',
        padding: '14px 0',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link
          to={`/${gwId}/${leagueId}`}
          style={{ textDecoration: 'none', color: '#555', fontSize: '0.85rem', fontWeight: 500 }}
        >
          ← League
        </Link>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>Premier League Baseball</span>
      </header>

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
            onClick={() => setRefreshToken((v) => v + 1)}
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
            <GameRow key={game.gameId} game={game} teamId={teamId!} />
          ))}
        </div>
      ))}
    </div>
  );
};

export { TeamCalendar };
