import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { RosterPlayer } from '../../api/models';
import { positionLabels } from '../position-labels';
import { Button, Input, Table, Td, Th, Tr } from './ui';

type SortKey = 'name' | 'age' | 'primaryPosition';
type DefaultSort = 'name' | 'primaryPosition';
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
const primaryPositionOrder = ['Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField', 'Pitcher'] as const;

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

// @spec ROSTUI-012
const compareByPrimaryPosition = (left: RosterPlayer, right: RosterPlayer) => {
  const positionDifference = primaryPositionOrder.indexOf(left.primaryPosition) - primaryPositionOrder.indexOf(right.primaryPosition);
  if (positionDifference !== 0) return positionDifference;

  const nameDifference = playerName(left).localeCompare(playerName(right));
  return nameDifference !== 0 ? nameDifference : left.id - right.id;
};

interface RowAction {
  testId: string;
  label: string;
  onClick: (playerId: number) => void;
}

interface RosterTableProps {
  players: RosterPlayer[];
  gwId?: string;
  testIdPrefix: string;
  actions?: RowAction[];
  defaultSort?: DefaultSort;
}

// @spec ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-008,ROSTUI-009,ROSTUI-011,ROSTUI-012 — the shared flat-table
// renderer for a RosterPlayer[] list. Reused by the Team Roster view and the Transfers
// free-agent market (contract-lifecycle.md's getRoster()/getFreeAgents() share the same
// row shape, so the UI layer mirrors that reuse rather than re-deriving a second table).
const RosterTable = ({ players, gwId, testIdPrefix, actions, defaultSort = 'name' }: RosterTableProps) => {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(defaultSort === 'primaryPosition' ? null : 'name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const visiblePlayers = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return players
      .filter((player) => !query || [playerName(player), player.primaryPosition, ...player.positionCoverage].join(' ').toLowerCase().includes(query))
      .sort((left, right) => sortKey
        ? comparePlayers(left, right, sortKey, sortDirection)
        : compareByPrimaryPosition(left, right));
  }, [filter, players, sortDirection, sortKey]);

  const changeSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '16px', marginBottom: '16px' }}>
        <label style={{ fontSize: '0.8rem', color: '#666' }}>
          Filter
          <Input
            aria-label={`Filter ${testIdPrefix}`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{ width: 'auto', display: 'inline-block', marginLeft: '7px', padding: '5px 7px', borderRadius: '3px', fontSize: '0.8rem' }}
          />
        </label>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Table data-testid={`${testIdPrefix}-table`} style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #222' }}>
              <Th align="left"><Button intent="ghost" onClick={() => changeSort('name')} style={sortButtonStyle}>Player</Button></Th>
              <Th><Button intent="ghost" onClick={() => changeSort('age')} style={sortButtonStyle}>Age</Button></Th>
              <Th align="left"><Button intent="ghost" onClick={() => changeSort('primaryPosition')} style={sortButtonStyle}>Coverage</Button></Th>
              <Th>B/T</Th>
              {ratings.map((rating) => <Th key={rating.key} data-testid={`rating-header-${rating.key}`} style={{ fontSize: '0.7rem', color: '#555', textTransform: 'none', letterSpacing: 'normal' }}>{rating.label}</Th>)}
              {actions && actions.length > 0 && <Th />}
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <Tr key={player.id} data-testid={`${testIdPrefix}-row-${player.id}`}>
                <Td align="left">
                  {gwId
                    ? <Link to={`/${gwId}/player/${player.id}`} style={{ color: '#222', fontWeight: 600, textUnderlineOffset: '3px' }}>{playerName(player)}</Link>
                    : playerName(player)}
                </Td>
                <Td style={{ color: '#555' }}>{player.age}</Td>
                <Td align="left" data-testid={`position-coverage-${player.id}`}>
                  {player.positionCoverage.map((position) => position === player.primaryPosition
                    ? <strong key={position} data-testid={`position-primary-${player.id}`} title={position} style={positionBadgeStyle}>{positionLabels[position]}</strong>
                    : <span key={position} data-testid={`position-secondary-${player.id}-${position}`} title={position} style={{ ...positionBadgeStyle, color: '#888', marginLeft: '6px', fontWeight: 500 }}>{positionLabels[position]}</span>)}
                </Td>
                <Td style={{ color: '#666' }}>{player.bats}/{player.throws}</Td>
                {ratings.map((rating) => <Td key={rating.key} data-testid={`rating-${player.id}-${rating.key}`} style={{ padding: '8px 5px', fontWeight: 700, background: ratingTint(player[rating.key]) }}>{player[rating.key]}</Td>)}
                {actions && actions.length > 0 && (
                  <Td align="right" style={{ whiteSpace: 'nowrap' }}>
                    {actions.map((action) => (
                      <Button
                        key={action.testId}
                        type="button"
                        data-testid={`${action.testId}-${player.id}`}
                        onClick={() => action.onClick(player.id)}
                        style={actionButtonStyle}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

const sortButtonStyle: React.CSSProperties = {
  padding: 0,
  color: '#555',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const actionButtonStyle: React.CSSProperties = {
  marginLeft: '6px',
  padding: '3px 9px',
  borderRadius: '4px',
  background: '#fff',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: '#222',
};

const positionBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '24px',
  padding: '2px 5px',
  border: '1px solid #b5bdb3',
  borderRadius: '999px',
  background: '#f3f6f2',
  color: '#243126',
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: 1.2,
  textAlign: 'center',
};

export { RosterTable };
