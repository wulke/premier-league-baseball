import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { ActiveLineupEntry, PlayerPosition, RosterPlayer, TeamLineup } from '../../api/models';

type LineupTab = 'DEFENSIVE' | 'BATTING';
type DraftRole = ActiveLineupEntry['role'] | 'UNASSIGNED';
type DraftEntry = Omit<ActiveLineupEntry, 'role'> & { role: DraftRole };
type LineupRow = DraftEntry & { entryIndex: number };

const DEFENSIVE_TAB_ORDER: PlayerPosition[] = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];

// @spec LINEUI-009,LINEUI-010,LINEUI-013 — the UI draft includes every roster player; only assigned rows are serialized.
const toDraft = (lineup: TeamLineup, roster: RosterPlayer[]): DraftEntry[] => {
  const entries: DraftEntry[] = [
    ...lineup.starters.map((entry) => ({ ...entry, role: 'STARTER' as const })),
    ...lineup.bench.map((entry) => ({ ...entry, role: 'BENCH' as const, battingOrder: null, fieldingPosition: null })),
    ...lineup.bullpen.map((entry) => ({ ...entry, role: 'BULLPEN' as const, battingOrder: null, fieldingPosition: null })),
  ];
  const assigned = new Set(entries.map((entry) => entry.playerId));
  return [...entries, ...roster.filter((player) => !assigned.has(player.id)).map((player) => ({ playerId: player.id, role: 'UNASSIGNED' as const, battingOrder: null, fieldingPosition: null }))];
};

const playerName = (playerId: number, players: Map<number, RosterPlayer>) => {
  const player = players.get(playerId);
  return player ? `${player.givenName} ${player.familyName}` : `Player #${playerId}`;
};

const LineupPlayerLink = ({ playerId, players, gwId }: { playerId: number; players: Map<number, RosterPlayer>; gwId?: string }) => (
  <Link to={`/${gwId}/player/${playerId}`} style={{ color: '#222', fontWeight: 650, textUnderlineOffset: '3px' }}>{playerName(playerId, players)}</Link>
);

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008,LINEUI-009,LINEUI-010,LINEUI-011,LINEUI-013,LINEUI-014
const TeamLineupView = () => {
  const { gwId, teamId } = useParams();
  const gameWorld = useRouteLoaderData('gwId') as any;
  const isManagedTeam = gameWorld?.managedTeamId != null && String(gameWorld.managedTeamId) === teamId;
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [draft, setDraft] = useState<DraftEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<LineupTab>('DEFENSIVE');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !gwId) return;
    let mounted = true;
    setLineup(null); setDraft([]); setRoster([]); setEditing(false); setSaveError(null);
    Promise.all([
      fetch(`${Endpoints.GetTeamLineup.replace(':teamId', teamId)}?gwId=${encodeURIComponent(gwId)}`, { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(Endpoints.GetTeamRoster.replace(':teamId', teamId), { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } }).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([nextLineup, nextRoster]) => {
      if (!mounted) return;
      const safeRoster = Array.isArray(nextRoster) ? nextRoster as RosterPlayer[] : [];
      setRoster(safeRoster);
      const safeLineup = nextLineup && !Array.isArray(nextLineup) ? nextLineup as TeamLineup : null;
      setLineup(safeLineup);
      setDraft(safeLineup ? toDraft(safeLineup, safeRoster) : []);
    });
    return () => { mounted = false; };
  }, [gwId, teamId]);

  const players = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  // The read card is canonical and therefore carries the effective DH shape used by the server.
  const dhEnabled = Boolean(lineup?.starters.some((entry) => entry.fieldingPosition == null));
  const rows = useMemo(() => draft.map((entry, entryIndex) => ({ ...entry, entryIndex })), [draft]);
  const starters = rows.filter((row) => row.role === 'STARTER');
  const reserves = rows.filter((row) => row.role === 'BENCH' || row.role === 'BULLPEN');
  const unassigned = rows.filter((row) => row.role === 'UNASSIGNED');
  const defensiveRows = [...starters].sort((a, b) => (a.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(a.fieldingPosition) : DEFENSIVE_TAB_ORDER.length) - (b.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(b.fieldingPosition) : DEFENSIVE_TAB_ORDER.length));
  const battingRows = [...starters].filter((row) => row.battingOrder != null).sort((a, b) => a.battingOrder! - b.battingOrder!);
  const startingPitcher = starters.find((row) => row.fieldingPosition === 'Pitcher');

  // @spec LINEUI-009,LINEUI-013
  const enterEdit = () => { if (lineup) { setDraft(toDraft(lineup, roster)); setSaveError(null); setEditing(true); } };
  // @spec LINEUI-014
  const cancelEdit = () => { setDraft([]); setSaveError(null); setEditing(false); };
  // @spec LINEUI-010,LINEUI-011,LINEUI-013 — occupied defensive slots are unavailable locally; server validates the full shape.
  const updateDraft = (entryIndex: number, patch: Partial<DraftEntry>) => setDraft((current) => {
    const next = current.map((entry) => ({ ...entry }));
    const entry = next[entryIndex];
    if (!entry) return current;
    const wasStarter = entry.role === 'STARTER';
    Object.assign(entry, patch);
    if (patch.role && patch.role !== 'STARTER') {
      entry.battingOrder = null;
      entry.fieldingPosition = null;
      return next;
    }
    if (patch.role === 'STARTER' && !wasStarter) {
      entry.fieldingPosition = null;
      entry.battingOrder = null;
    }
    if (entry.role !== 'STARTER') return next;
    if (entry.fieldingPosition === 'Pitcher') {
      entry.battingOrder = dhEnabled ? null : 9;
      return next;
    }
    // @spec LINEUI-011 — a new non-pitcher starter inherits an open batting slot;
    // batting order is intentionally displayed as a derived, disabled control.
    const selectedNonPitcherPosition = patch.fieldingPosition === null || (typeof patch.fieldingPosition === 'string' && patch.fieldingPosition.length > 0);
    if (selectedNonPitcherPosition && entry.battingOrder == null) {
      const occupiedOrders = new Set(next.filter((candidate, index) => index !== entryIndex && candidate.role === 'STARTER').map((candidate) => candidate.battingOrder));
      entry.battingOrder = [...Array(9)].map((_, index) => index + 1).find((order) => !occupiedOrders.has(order)) ?? null;
    }
    return next;
  });
  // @spec LINEUI-014 — submit only the assigned entries to #254's wholesale PUT endpoint.
  const saveLineup = async () => {
    if (!teamId) return;
    setSaveError(null);
    const entries: ActiveLineupEntry[] = draft.filter((entry): entry is ActiveLineupEntry => entry.role !== 'UNASSIGNED').map(({ playerId, role, battingOrder, fieldingPosition }) => ({ playerId, role, battingOrder, fieldingPosition }));
    const response = await fetch(Endpoints.SaveTeamLineup.replace(':teamId', teamId), { method: 'PUT', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) }).catch(() => null);
    if (!response || !response.ok) { const body = response ? await response.json().catch(() => ({})) : {}; setSaveError(body?.error ?? 'Unable to save lineup'); return; }
    const saved = await response.json().catch(() => null);
    if (saved && !Array.isArray(saved)) { setLineup(saved as TeamLineup); setDraft([]); setEditing(false); }
  };
  const occupiedPositions = (self: number) => new Set(starters.filter((row) => row.entryIndex !== self).map((row) => row.fieldingPosition));

  const renderRow = (row: LineupRow, tab: LineupTab) => {
    const isDh = row.fieldingPosition === null && row.role === 'STARTER';
    const rating = row.fieldingPosition ? players.get(row.playerId)?.positions[row.fieldingPosition] ?? '—' : '';
    const testId = row.role === 'STARTER' ? `${tab.toLowerCase()}-row-${tab === 'BATTING' ? row.battingOrder : row.playerId}` : `${row.role.toLowerCase()}-row-${row.playerId}`;
    return <div key={row.entryIndex} data-testid={testId} style={rowStyle}>
      {row.role !== 'STARTER' && <span style={tagStyle}>{row.role}</span>}
      {tab === 'BATTING' && row.role === 'STARTER' && <strong style={{ color: '#555', width: '24px' }}>{row.battingOrder ?? '—'}</strong>}
      <span data-testid={isDh ? 'dh-row' : undefined} style={{ flex: 1 }}><LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} /></span>
      {!editing && <><span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition ?? ''}</span>{tab === 'DEFENSIVE' && <span style={ratingStyle}>{rating}</span>}</>}
      {editing && <DraftControls row={row} dhEnabled={dhEnabled} occupied={occupiedPositions(row.entryIndex)} onChange={updateDraft} />}
    </div>;
  };

  return <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 24px 48px' }}>
    <header style={{ marginBottom: '20px' }}><h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Lineup</h1><p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.86rem' }}>Active lineup</p></header>
    {lineup && <>
      {isManagedTeam && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        {!editing ? <button type="button" onClick={enterEdit}>Edit Lineup</button> : <><button type="button" onClick={saveLineup}>Save Lineup</button><button type="button" onClick={cancelEdit}>Cancel</button></>}
        {saveError && <span role="alert" style={{ color: '#a33', fontSize: '0.82rem' }}>{saveError}</span>}
      </div>}
      <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>{(['DEFENSIVE', 'BATTING'] as LineupTab[]).map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} data-testid={`tab-${tab.toLowerCase()}`} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>{tab === 'DEFENSIVE' ? 'Defensive' : 'Batting'}</button>)}</div>
      {activeTab === 'DEFENSIVE' && <section data-testid="defensive-table" aria-label="Defensive lineup" style={panelStyle}>{defensiveRows.map((row) => renderRow(row, 'DEFENSIVE'))}{reserves.map((row) => renderRow(row, 'DEFENSIVE'))}{editing && <UnassignedBucket rows={unassigned} renderRow={renderRow} />}</section>}
      {activeTab === 'BATTING' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 0.55fr)', gap: '18px', alignItems: 'start' }}><section data-testid="batting-table" aria-label="Batting order" style={panelStyle}>{battingRows.map((row) => renderRow(row, 'BATTING'))}{reserves.map((row) => renderRow(row, 'BATTING'))}{editing && <UnassignedBucket rows={unassigned} renderRow={renderRow} />}</section>{startingPitcher && <section data-testid="starting-pitcher" style={{ ...panelStyle, borderColor: '#71896e', background: '#f1f6ef' }}><h2 style={headingStyle}>Starting pitcher</h2><LineupPlayerLink playerId={startingPitcher.playerId} players={players} gwId={gwId} /></section>}</div>}
    </>}
  </main>;
};

// @spec LINEUI-010,LINEUI-011,LINEUI-013
const DraftControls = ({ row, dhEnabled, occupied, onChange }: { row: LineupRow; dhEnabled: boolean; occupied: Set<PlayerPosition | null>; onChange: (index: number, patch: Partial<DraftEntry>) => void }) => <>
  <select aria-label={`Role for player ${row.playerId}`} data-testid={`role-picker-${row.playerId}`} value={row.role} onChange={(e) => onChange(row.entryIndex, { role: e.target.value as DraftRole })}>{(['STARTER', 'BENCH', 'BULLPEN', 'UNASSIGNED'] as DraftRole[]).map((role) => <option key={role} value={role}>{role}</option>)}</select>
  {row.role === 'STARTER' && <><select aria-label={`Fielding position for player ${row.playerId}`} data-testid={`position-picker-${row.playerId}`} value={row.fieldingPosition ?? (row.battingOrder != null ? 'DH' : '')} onChange={(e) => onChange(row.entryIndex, { fieldingPosition: e.target.value === 'DH' ? null : e.target.value as PlayerPosition })}><option value="">Choose position</option>{DEFENSIVE_TAB_ORDER.map((position) => <option key={position} value={position} disabled={occupied.has(position)}>{position}</option>)}{dhEnabled && <option value="DH" disabled={occupied.has(null)}>DH</option>}</select><select aria-label={`Batting slot for player ${row.playerId}`} data-testid={`batting-picker-${row.playerId}`} value={row.battingOrder ?? ''} disabled><option value="">—</option>{row.battingOrder != null && <option value={row.battingOrder}>{row.battingOrder}</option>}</select></>}
</>;

// @spec LINEUI-013
const UnassignedBucket = ({ rows, renderRow }: { rows: LineupRow[]; renderRow: (row: LineupRow, tab: LineupTab) => React.ReactNode }) => <section data-testid="unassigned-bucket" aria-label="Unassigned" style={{ marginTop: '14px', borderTop: '1px solid #ddd' }}><h2 style={headingStyle}>Unassigned</h2>{rows.map((row) => renderRow(row, 'DEFENSIVE'))}</section>;

const tabStyle = (active: boolean): React.CSSProperties => ({ border: '1px solid #ddd', borderRadius: '6px', padding: '6px 14px', background: active ? '#222' : '#fff', color: active ? '#fff' : '#333', fontWeight: 650, fontSize: '0.84rem', cursor: 'pointer' });
const panelStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: '6px', padding: '16px', background: '#fff' };
const headingStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px', padding: '5px 7px', borderBottom: '1px solid #eee', fontSize: '0.88rem' };
const positionStyle: React.CSSProperties = { minWidth: '72px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#555' };
const ratingStyle: React.CSSProperties = { minWidth: '32px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#71896e' };
const tagStyle: React.CSSProperties = { minWidth: '58px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: '#888' };

export { TeamLineupView };
