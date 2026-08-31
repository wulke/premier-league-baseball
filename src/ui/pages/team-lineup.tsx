import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { PlayerPosition, RosterPlayer, TeamLineup } from '../../api/models';

type LineupState = TeamLineup | null;
type LineupTab = 'DEFENSIVE' | 'BATTING';
type RowTag = 'STARTER' | 'BENCH' | 'BULLPEN';

interface LineupRow {
  tag: RowTag;
  playerId: number;
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
  positionRating: number | null;
}

// Presentation-only ordering; deliberately not imported from src/db/domain/player.ts
// (the UI never imports across the domain-layer boundary — backend-standards.md §1).
const DEFENSIVE_TAB_ORDER: PlayerPosition[] = [
  'Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase',
  'Shortstop', 'LeftField', 'CenterField', 'RightField',
];

// @spec LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008
const playerName = (playerId: number, players: Map<number, RosterPlayer>) => {
  const player = players.get(playerId);
  return player ? `${player.givenName} ${player.familyName}` : `Player #${playerId}`;
};

const LineupPlayerLink = ({ playerId, players, gwId }: { playerId: number; players: Map<number, RosterPlayer>; gwId?: string }) => (
  <Link to={`/${gwId}/player/${playerId}`} style={{ color: '#222', fontWeight: 650, textUnderlineOffset: '3px' }}>
    {playerName(playerId, players)}
  </Link>
);

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008
const TeamLineupView = () => {
  const { gwId, teamId } = useParams();
  const [lineup, setLineup] = useState<LineupState>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [activeTab, setActiveTab] = useState<LineupTab>('DEFENSIVE'); // @spec LINEUI-006

  useEffect(() => {
    if (!teamId || !gwId) return;
    let mounted = true;
    setLineup(null);
    setRoster([]);
    const lineupUrl = `${Endpoints.GetTeamLineup.replace(':teamId', teamId)}?gwId=${encodeURIComponent(gwId)}`;
    const rosterUrl = Endpoints.GetTeamRoster.replace(':teamId', teamId);

    Promise.all([
      fetch(lineupUrl, { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } })
        .then((response) => response.ok ? response.json() : null)
        .catch(() => null),
      fetch(rosterUrl, { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } })
        .then((response) => response.ok ? response.json() : [])
        .catch(() => []),
    ]).then(([lineupData, rosterData]) => {
      if (!mounted) return;
      setLineup(lineupData && !Array.isArray(lineupData) ? lineupData as TeamLineup : null);
      setRoster(Array.isArray(rosterData) ? rosterData : []);
    });
    return () => { mounted = false; };
  }, [gwId, teamId]);

  const players = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);

  // @spec LINEUI-005,LINEUI-007
  const starterRows: LineupRow[] = useMemo(() => (lineup?.starters ?? []).map((starter) => ({
    tag: 'STARTER',
    playerId: starter.playerId,
    battingOrder: starter.battingOrder,
    fieldingPosition: starter.fieldingPosition,
    positionRating: starter.fieldingPosition ? players.get(starter.playerId)?.positions[starter.fieldingPosition] ?? null : null,
  })), [lineup, players]);

  const poolRows: LineupRow[] = useMemo(() => [
    ...(lineup?.bench ?? []).map((entry): LineupRow => ({ tag: 'BENCH', playerId: entry.playerId, battingOrder: null, fieldingPosition: null, positionRating: null })),
    ...(lineup?.bullpen ?? []).map((entry): LineupRow => ({ tag: 'BULLPEN', playerId: entry.playerId, battingOrder: null, fieldingPosition: null, positionRating: null })),
  ], [lineup]);

  // @spec LINEUI-005
  const defensiveRows = useMemo(() => [...starterRows].sort((left, right) => {
    const leftIndex = left.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(left.fieldingPosition) : DEFENSIVE_TAB_ORDER.length;
    const rightIndex = right.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(right.fieldingPosition) : DEFENSIVE_TAB_ORDER.length;
    return leftIndex - rightIndex;
  }), [starterRows]);

  const battingRows = useMemo(() => [...starterRows]
    .filter((row) => row.battingOrder != null)
    .sort((left, right) => left.battingOrder! - right.battingOrder!), [starterRows]);

  const startingPitcher = lineup?.starters.find((starter) => starter.playerId === lineup.startingPitcherId);

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 24px 48px' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Lineup</h1>
        <p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.86rem' }}>Active lineup</p>
      </header>
      {lineup && <>
        <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            role="tab"
            aria-selected={activeTab === 'DEFENSIVE'}
            data-testid="tab-defensive"
            onClick={() => setActiveTab('DEFENSIVE')}
            style={tabStyle(activeTab === 'DEFENSIVE')}
          >Defensive</button>
          <button
            role="tab"
            aria-selected={activeTab === 'BATTING'}
            data-testid="tab-batting"
            onClick={() => setActiveTab('BATTING')}
            style={tabStyle(activeTab === 'BATTING')}
          >Batting</button>
        </div>

        {activeTab === 'DEFENSIVE' && (
          <section data-testid="defensive-table" aria-label="Defensive lineup" style={panelStyle}>
            {defensiveRows.map((row) => {
              const isDh = row.fieldingPosition === null;
              return <div key={row.playerId} data-testid={`defensive-row-${row.playerId}`} style={rowStyle}>
                <span style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
                <span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition}</span>
                <span style={ratingStyle}>{isDh ? '' : row.positionRating ?? '—'}</span>
              </div>;
            })}
            {poolRows.map((row) => <PoolRow key={`${row.tag}-${row.playerId}`} row={row} players={players} gwId={gwId} variant="DEFENSIVE" />)}
          </section>
        )}

        {activeTab === 'BATTING' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 0.55fr)', gap: '18px', alignItems: 'start' }}>
            <section data-testid="batting-table" aria-label="Batting order" style={panelStyle}>
              {battingRows.map((row) => {
                const isDh = row.fieldingPosition === null;
                const order = row.battingOrder!;
                return <div key={row.playerId} data-testid={`batting-row-${order}`} style={{ ...rowStyle, background: isDh ? '#f5f1e7' : 'transparent' }}>
                  <strong style={{ color: '#555', width: '24px' }}>{order}</strong>
                  <span data-testid={isDh ? 'dh-row' : undefined} style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
                  <span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition}</span>
                </div>;
              })}
              {poolRows.map((row) => <PoolRow key={`${row.tag}-${row.playerId}`} row={row} players={players} gwId={gwId} variant="BATTING" />)}
            </section>
            {startingPitcher && <section data-testid="starting-pitcher" style={{ ...panelStyle, borderColor: '#71896e', background: '#f1f6ef' }}>
              <h2 style={headingStyle}>Starting pitcher</h2>
              <LineupPlayerLink playerId={startingPitcher.playerId} players={players} gwId={gwId} />
            </section>}
          </div>
        )}
      </>}
    </main>
  );
};

// @spec LINEUI-007
const PoolRow = ({ row, players, gwId, variant }: { row: LineupRow; players: Map<number, RosterPlayer>; gwId?: string; variant: 'DEFENSIVE' | 'BATTING' }) => (
  <div data-testid={`${row.tag.toLowerCase()}-row-${row.playerId}`} style={rowStyle}>
    <span style={tagStyle}>{row.tag}</span>
    <span style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
    <span style={positionStyle} aria-hidden="true" />
    {variant === 'DEFENSIVE' && <span style={ratingStyle} aria-hidden="true" />}
  </div>
);

const tabStyle = (active: boolean): React.CSSProperties => ({
  border: '1px solid #ddd', borderRadius: '6px', padding: '6px 14px', background: active ? '#222' : '#fff',
  color: active ? '#fff' : '#333', fontWeight: 650, fontSize: '0.84rem', cursor: 'pointer',
});
const panelStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: '6px', padding: '16px', background: '#fff' };
const headingStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px', padding: '5px 7px', borderBottom: '1px solid #eee', fontSize: '0.88rem' };
const positionStyle: React.CSSProperties = { minWidth: '72px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#555' };
const ratingStyle: React.CSSProperties = { minWidth: '32px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#71896e' };
const tagStyle: React.CSSProperties = { minWidth: '58px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: '#888' };

export { TeamLineupView };
