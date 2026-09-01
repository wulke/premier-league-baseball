import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { ActiveLineupEntry, PlayerPosition, RosterPlayer, TeamLineup } from '../../api/models';

type LineupState = TeamLineup | null;
type LineupTab = 'DEFENSIVE' | 'BATTING';
type RowTag = 'STARTER' | 'BENCH' | 'BULLPEN';

interface LineupRow {
  tag: RowTag;
  playerId: number;
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
  positionRating: number | null;
  entryIndex: number;
}

// Presentation-only ordering; deliberately not imported from src/db/domain/player.ts
// (the UI never imports across the domain-layer boundary — backend-standards.md §1).
const DEFENSIVE_TAB_ORDER: PlayerPosition[] = [
  'Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase',
  'Shortstop', 'LeftField', 'CenterField', 'RightField',
];

// @spec LINEUI-009,LINEUI-010
const toEntries = (lineup: TeamLineup): ActiveLineupEntry[] => [
  ...lineup.starters.map((starter) => ({ ...starter, role: 'STARTER' as const })),
  ...lineup.bench.map((entry) => ({ ...entry, role: 'BENCH' as const, battingOrder: null, fieldingPosition: null })),
  ...lineup.bullpen.map((entry) => ({ ...entry, role: 'BULLPEN' as const, battingOrder: null, fieldingPosition: null })),
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

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008,LINEUI-009,LINEUI-010,LINEUI-011
const TeamLineupView = () => {
  const { gwId, teamId } = useParams();
  // @spec LINEUI-009 — the loader's GameWorld is the UI-only managed-team scope.
  const gameWorld = useRouteLoaderData('gwId') as any;
  const isManagedTeam = gameWorld?.managedTeamId != null && String(gameWorld.managedTeamId) === teamId;
  const [lineup, setLineup] = useState<LineupState>(null);
  const [draft, setDraft] = useState<ActiveLineupEntry[] | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [activeTab, setActiveTab] = useState<LineupTab>('DEFENSIVE'); // @spec LINEUI-006
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !gwId) return;
    let mounted = true;
    setLineup(null);
    setDraft(null);
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
      const nextLineup = lineupData && !Array.isArray(lineupData) ? lineupData as TeamLineup : null;
      setLineup(nextLineup);
      setDraft(nextLineup ? toEntries(nextLineup) : null);
      setRoster(Array.isArray(rosterData) ? rosterData : []);
    });
    return () => { mounted = false; };
  }, [gwId, teamId]);

  const players = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);

  // @spec LINEUI-005,LINEUI-007,LINEUI-010
  const starterRows: LineupRow[] = useMemo(() => (draft ?? []).map((entry, entryIndex) => ({ entry, entryIndex }))
    .filter(({ entry }) => entry.role === 'STARTER').map(({ entry, entryIndex }) => ({
    tag: 'STARTER',
    playerId: entry.playerId,
    battingOrder: entry.battingOrder,
    fieldingPosition: entry.fieldingPosition,
    positionRating: entry.fieldingPosition ? players.get(entry.playerId)?.positions[entry.fieldingPosition] ?? null : null,
    entryIndex,
  })), [draft, players]);

  const poolRows: LineupRow[] = useMemo(() => (draft ?? []).map((entry, entryIndex) => ({ entry, entryIndex }))
    .filter(({ entry }) => entry.role !== 'STARTER').map(({ entry, entryIndex }): LineupRow => ({
      tag: entry.role, playerId: entry.playerId, battingOrder: null, fieldingPosition: null, positionRating: null, entryIndex,
    })), [draft]);

  // @spec LINEUI-005
  const defensiveRows = useMemo(() => [...starterRows].sort((left, right) => {
    const leftIndex = left.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(left.fieldingPosition) : DEFENSIVE_TAB_ORDER.length;
    const rightIndex = right.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(right.fieldingPosition) : DEFENSIVE_TAB_ORDER.length;
    return leftIndex - rightIndex;
  }), [starterRows]);

  const battingRows = useMemo(() => [...starterRows]
    .filter((row) => row.battingOrder != null)
    .sort((left, right) => left.battingOrder! - right.battingOrder!), [starterRows]);

  const startingPitcher = starterRows.find((starter) => starter.fieldingPosition === 'Pitcher');
  // @spec LINEUI-009 — only position-player starters and bench slots participate in #249.
  const editableEntries = useMemo(() => (draft ?? []).filter((entry) => entry.role === 'BENCH' || (entry.role === 'STARTER' && entry.fieldingPosition !== 'Pitcher')), [draft]);
  const isEditable = (row: LineupRow) => row.tag === 'BENCH' || (row.tag === 'STARTER' && row.fieldingPosition !== 'Pitcher');

  // @spec LINEUI-010 — swap slot occupants locally; validation belongs exclusively to Save.
  const selectPlayer = (targetIndex: number, playerId: number) => setDraft((current) => {
    if (!current) return current;
    const sourceIndex = current.findIndex((entry) => entry.playerId === playerId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return current;
    const next = current.map((entry) => ({ ...entry }));
    [next[targetIndex].playerId, next[sourceIndex].playerId] = [next[sourceIndex].playerId, next[targetIndex].playerId];
    return next;
  });

  // @spec LINEUI-009,LINEUI-011
  const saveLineup = async () => {
    if (!teamId || !draft) return;
    setSaveError(null);
    const response = await fetch(Endpoints.UpdateTeamLineup.replace(':teamId', teamId), {
      method: 'PATCH', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: draft }),
    }).catch(() => null);
    if (!response || !response.ok) {
      const body = response ? await response.json().catch(() => ({})) : {};
      setSaveError(body?.error ?? 'Unable to save lineup');
      return;
    }
    const saved = await response.json().catch(() => null);
    if (saved && !Array.isArray(saved)) {
      setLineup(saved as TeamLineup);
      setDraft(toEntries(saved as TeamLineup));
    }
  };

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 24px 48px' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Lineup</h1>
        <p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.86rem' }}>Active lineup</p>
      </header>
      {lineup && <>
        {isManagedTeam && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button type="button" onClick={saveLineup}>Save Lineup</button>
          {saveError && <span role="alert" style={{ color: '#a33', fontSize: '0.82rem' }}>{saveError}</span>}
        </div>}
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
              return <div key={row.entryIndex} data-testid={`defensive-row-${row.playerId}`} style={rowStyle}>
                <span style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
                <span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition}</span>
                <span style={ratingStyle}>{isDh ? '' : row.positionRating ?? '—'}</span>
                {isManagedTeam && isEditable(row) && <SlotPicker row={row} entries={editableEntries} players={players} onSelect={selectPlayer} />}
              </div>;
            })}
            {poolRows.map((row) => <PoolRow key={row.entryIndex} row={row} players={players} gwId={gwId} variant="DEFENSIVE" editable={isManagedTeam && isEditable(row)} entries={editableEntries} onSelect={selectPlayer} />)}
          </section>
        )}

        {activeTab === 'BATTING' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 0.55fr)', gap: '18px', alignItems: 'start' }}>
            <section data-testid="batting-table" aria-label="Batting order" style={panelStyle}>
              {battingRows.map((row) => {
                const isDh = row.fieldingPosition === null;
                const order = row.battingOrder!;
                return <div key={row.entryIndex} data-testid={`batting-row-${order}`} style={{ ...rowStyle, background: isDh ? '#f5f1e7' : 'transparent' }}>
                  <strong style={{ color: '#555', width: '24px' }}>{order}</strong>
                  <span data-testid={isDh ? 'dh-row' : undefined} style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
                  <span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition}</span>
                  {isManagedTeam && isEditable(row) && <SlotPicker row={row} entries={editableEntries} players={players} onSelect={selectPlayer} />}
                </div>;
              })}
              {poolRows.map((row) => <PoolRow key={row.entryIndex} row={row} players={players} gwId={gwId} variant="BATTING" editable={isManagedTeam && isEditable(row)} entries={editableEntries} onSelect={selectPlayer} />)}
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

// @spec LINEUI-007,LINEUI-009
const PoolRow = ({ row, players, gwId, variant, editable, entries, onSelect }: { row: LineupRow; players: Map<number, RosterPlayer>; gwId?: string; variant: 'DEFENSIVE' | 'BATTING'; editable: boolean; entries: ActiveLineupEntry[]; onSelect: (entryIndex: number, playerId: number) => void }) => (
  <div data-testid={`${row.tag.toLowerCase()}-row-${row.playerId}`} style={rowStyle}>
    <span style={tagStyle}>{row.tag}</span>
    <span style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
    <span style={positionStyle} aria-hidden="true" />
    {variant === 'DEFENSIVE' && <span style={ratingStyle} aria-hidden="true" />}
    {editable && <SlotPicker row={row} entries={entries} players={players} onSelect={onSelect} />}
  </div>
);

// @spec LINEUI-009,LINEUI-010
const SlotPicker = ({ row, entries, players, onSelect }: { row: LineupRow; entries: ActiveLineupEntry[]; players: Map<number, RosterPlayer>; onSelect: (entryIndex: number, playerId: number) => void }) => (
  <select data-testid={row.fieldingPosition ? `lineup-picker-${row.fieldingPosition}` : `lineup-picker-bench-${row.entryIndex}`} value={row.playerId} onChange={(event) => onSelect(row.entryIndex, Number(event.target.value))}>
    {entries.map((entry) => <option key={entry.playerId} value={entry.playerId}>{playerName(entry.playerId, players)}</option>)}
  </select>
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
