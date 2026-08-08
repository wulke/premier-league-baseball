import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer } from '../../api/models';

type SortKey = 'name' | 'age' | 'primaryPosition';
type SortDirection = 'asc' | 'desc';

const ratings: Array<{ key: keyof Pick<RosterPlayer, 'contact' | 'power' | 'armStrength' | 'accuracy' | 'reaction' | 'vision' | 'discipline'>; label: string }> = [
  { key: 'contact', label: 'CON' },
  { key: 'power', label: 'POW' },
  { key: 'armStrength', label: 'ARM' },
  { key: 'accuracy', label: 'ACC' },
  { key: 'reaction', label: 'REA' },
  { key: 'vision', label: 'VIS' },
  { key: 'discipline', label: 'DIS' },
];

const playerName = (player: RosterPlayer) => `${player.givenName} ${player.familyName}`;

const ratingTint = (rating: number) => {
  const hue = Math.round(Math.max(0, Math.min(100, rating)) * 1.2);
  return `hsl(${hue} 62% 91%)`;
};

// @spec ROSTUI-003
const comparePlayers = (left: RosterPlayer, right: RosterPlayer, key: SortKey, direction: SortDirection) => {
  const leftValue = key === 'name' ? playerName(left) : left[key];
  const rightValue = key === 'name' ? playerName(right) : right[key];
  const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));
  return direction === 'asc' ? comparison : -comparison;
};

// @spec ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-008,ROSTUI-009
const TeamRoster = () => {
  const { gwId, teamId } = useParams();
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (!teamId) return;
    let isMounted = true;

    fetch(Endpoints.GetTeamRoster.replace(':teamId', teamId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => (response.ok ? response.json() : []))
      .then((data) => { if (isMounted) setPlayers(Array.isArray(data) ? data : []); })
      .catch(() => { if (isMounted) setPlayers([]); });

    return () => { isMounted = false; };
  }, [teamId]);

  const visiblePlayers = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return players
      .filter((player) => !query || [playerName(player), player.primaryPosition, ...player.positionCoverage].join(' ').toLowerCase().includes(query))
      .sort((left, right) => comparePlayers(left, right, sortKey, sortDirection));
  }, [filter, players, sortDirection, sortKey]);

  const changeSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 24px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Roster</h1>
        <label style={{ fontSize: '0.8rem', color: '#666' }}>
          Filter
          <input
            aria-label="Filter roster"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{ marginLeft: '7px', padding: '5px 7px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '0.8rem' }}
          />
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table data-testid="roster-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #222' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}><button type="button" onClick={() => changeSort('name')} style={sortButtonStyle}>Player</button></th>
              <th style={{ textAlign: 'center', padding: '6px 8px' }}><button type="button" onClick={() => changeSort('age')} style={sortButtonStyle}>Age</button></th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}><button type="button" onClick={() => changeSort('primaryPosition')} style={sortButtonStyle}>Coverage</button></th>
              <th style={{ textAlign: 'center', padding: '6px 8px' }}>B/T</th>
              {ratings.map((rating) => <th key={rating.key} data-testid={`rating-header-${rating.key}`} style={{ textAlign: 'center', padding: '6px 5px', fontSize: '0.7rem', color: '#555' }}>{rating.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <tr key={player.id} data-testid={`roster-row-${player.id}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}><Link to={`/${gwId}/player/${player.id}`} style={{ color: '#222', fontWeight: 600, textUnderlineOffset: '3px' }}>{playerName(player)}</Link></td>
                <td style={{ padding: '8px', textAlign: 'center', color: '#555' }}>{player.age}</td>
                <td data-testid={`position-coverage-${player.id}`} style={{ padding: '8px' }}>
                  {player.positionCoverage.map((position) => position === player.primaryPosition
                    ? <strong key={position} data-testid={`position-primary-${player.id}`} style={{ fontWeight: 700 }}>{position}</strong>
                    : <span key={position} data-testid={`position-secondary-${player.id}-${position}`} style={{ color: '#888', marginLeft: '6px' }}>{position}</span>)}
                </td>
                <td style={{ padding: '8px', textAlign: 'center', color: '#666' }}>{player.bats}/{player.throws}</td>
                {ratings.map((rating) => <td key={rating.key} data-testid={`rating-${player.id}-${rating.key}`} style={{ padding: '8px 5px', textAlign: 'center', fontWeight: 700, background: ratingTint(player[rating.key]) }}>{player[rating.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const sortButtonStyle: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  color: '#555',
  cursor: 'pointer',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export { TeamRoster };
