import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLoaderData, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { ActiveLineupEntry, PlayerPosition, RosterPlayer, TeamLineup } from '../../api/models';
import { Button, Card, ErrorText, PageContainer, SectionLabel } from '../components/ui';
import { useLineupDragSource } from '../hooks/use-lineup-drag-source';
import { formatUtcDate } from '../format-date';

type LineupTab = 'DEFENSIVE' | 'BATTING' | 'BULLPEN';
type DraftRole = ActiveLineupEntry['role'] | 'UNASSIGNED';
type DraftEntry = Omit<ActiveLineupEntry, 'role'> & { role: DraftRole; valid?: boolean };
type LineupRow = DraftEntry & { entryIndex: number };
type NextGameLineup = { game: { id: number; scheduledDate: string | null; status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'; opponentName: string }; lineup: TeamLineup };

const DEFENSIVE_TAB_ORDER: PlayerPosition[] = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];

// @spec LINEUI-014,GBULL-006 — never replace rendered lineup state with an incomplete save response.
const isTeamLineup = (value: unknown): value is TeamLineup => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<TeamLineup>;
  return Array.isArray(candidate.starters) && Array.isArray(candidate.bench) && Array.isArray(candidate.bullpen);
};

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

// @spec GBULL-006 — the game snapshot is a complete lineup replacement, not a partial bullpen patch.
const toGameEntries = (lineup: TeamLineup): ActiveLineupEntry[] => [
  ...lineup.starters.map((entry) => ({ playerId: entry.playerId, role: 'STARTER' as const, battingOrder: entry.battingOrder, fieldingPosition: entry.fieldingPosition })),
  ...lineup.bench.map((entry) => ({ playerId: entry.playerId, role: 'BENCH' as const, battingOrder: null, fieldingPosition: null })),
  ...lineup.bullpen.map((entry) => ({ playerId: entry.playerId, role: 'BULLPEN' as const, battingOrder: null, fieldingPosition: null })),
];

const playerName = (playerId: number, players: Map<number, RosterPlayer>) => {
  const player = players.get(playerId);
  return player ? `${player.givenName} ${player.familyName}` : `Player #${playerId}`;
};

const LineupPlayerLink = ({ playerId, players, gwId }: { playerId: number; players: Map<number, RosterPlayer>; gwId?: string }) => (
  <Link to={`/${gwId}/player/${playerId}`} style={{ color: '#222', fontWeight: 650, textUnderlineOffset: '3px' }}>{playerName(playerId, players)}</Link>
);

// @spec LINEUI-015 — active-template slots that can exchange occupants through picker or drag.
const isSwappableSlot = (entry: DraftEntry) => entry.role === 'BENCH' || (entry.role === 'STARTER' && entry.fieldingPosition !== 'Pitcher');

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,LINEUI-005,LINEUI-006,LINEUI-007,LINEUI-008,LINEUI-009,LINEUI-010,LINEUI-011,LINEUI-012,LINEUI-013,LINEUI-014,LINEUI-015
const TeamLineupView = () => {
  const { gwId, teamId } = useParams();
  const gameWorld = useRouteLoaderData('gwId') as any;
  // @spec NAVLOAD-001,NAVLOAD-004,NAVLOAD-005,NAVLOAD-009
  const loaded = useLoaderData() as { lineup: TeamLineup | null; roster: RosterPlayer[]; nextGame: NextGameLineup | null };
  const { revalidate } = useRevalidator();
  const previousTeamId = useRef(teamId);
  const isManagedTeam = gameWorld?.managedTeamId != null && String(gameWorld.managedTeamId) === teamId;
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [draft, setDraft] = useState<DraftEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<LineupTab>('DEFENSIVE');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nextGame, setNextGame] = useState<NextGameLineup | null>(null);
  const [gameDraft, setGameDraft] = useState<ActiveLineupEntry[]>([]);
  const [gameSaveError, setGameSaveError] = useState<string | null>(null);
  const lineupDrag = useLineupDragSource('application/x-lineup-entry-index');

  useEffect(() => {
    const teamChanged = previousTeamId.current !== teamId;
    previousTeamId.current = teamId;
    const safeRoster = Array.isArray(loaded.roster) ? loaded.roster : [];
    const safeLineup = isTeamLineup(loaded.lineup) ? loaded.lineup : null;
    const safeNextGame = loaded.nextGame && isTeamLineup(loaded.nextGame.lineup) ? loaded.nextGame : null;
    setRoster(safeRoster); setLineup(safeLineup); setNextGame(safeNextGame);
    // @spec NAVLOAD-009
    if (teamChanged) { setEditing(false); setSaveError(null); setGameSaveError(null); }
    if (!editing || teamChanged) { setDraft(safeLineup ? toDraft(safeLineup, safeRoster) : []); setGameDraft(safeNextGame ? toGameEntries(safeNextGame.lineup) : []); }
  }, [loaded, teamId]);

  const players = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  // The read card is canonical and therefore carries the effective DH shape used by the server.
  const dhEnabled = Boolean(lineup?.starters.some((entry) => entry.fieldingPosition == null));
  const rows = useMemo(() => draft.map((entry, entryIndex) => ({ ...entry, entryIndex })), [draft]);
  const starters = rows.filter((row) => row.role === 'STARTER');
  const reserves = rows.filter((row) => row.role === 'BENCH' || row.role === 'BULLPEN');
  const unassigned = rows.filter((row) => row.role === 'UNASSIGNED');
  const swappableRows = rows.filter(isSwappableSlot);
  const defensiveRows = [...starters].sort((a, b) => (a.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(a.fieldingPosition) : DEFENSIVE_TAB_ORDER.length) - (b.fieldingPosition ? DEFENSIVE_TAB_ORDER.indexOf(b.fieldingPosition) : DEFENSIVE_TAB_ORDER.length));
  const battingRows = [...starters].filter((row) => row.battingOrder != null).sort((a, b) => a.battingOrder! - b.battingOrder!);
  const startingPitcher = starters.find((row) => row.fieldingPosition === 'Pitcher');

  // @spec LINEUI-009,LINEUI-013
  const enterEdit = () => { if (lineup) { lineupDrag.clearDragState(); setDraft(toDraft(lineup, roster)); setSaveError(null); setEditing(true); } };
  // @spec LINEUI-014
  const cancelEdit = () => { lineupDrag.clearDragState(); setDraft([]); setSaveError(null); setEditing(false); };
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
  // @spec LINEUI-015 — picker selection and a row drop both exchange fixed-slot occupants in this one draft.
  const swapDraftSlots = (sourceIndex: number, targetIndex: number) => setDraft((current) => {
    const source = current[sourceIndex];
    const target = current[targetIndex];
    if (!source || !target || sourceIndex === targetIndex || !isSwappableSlot(source) || !isSwappableSlot(target)) return current;
    const next = current.map((entry) => ({ ...entry }));
    [next[sourceIndex].playerId, next[targetIndex].playerId] = [next[targetIndex].playerId, next[sourceIndex].playerId];
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
    if (!isTeamLineup(saved)) { setSaveError('Unable to save lineup'); return; }
    lineupDrag.clearDragState(); setLineup(saved); setDraft([]); setEditing(false);
    // @spec NAVLOAD-006,NAVLOAD-009
    revalidate();
  };
  // @spec GBULL-006 — a chosen player swaps with their current snapshot slot, preserving a
  // complete unique entry set whenever both players are already represented in the snapshot.
  const updateGameSlot = (entryIndex: number, playerId: number) => setGameDraft((current) => {
    const next = current.map((entry) => ({ ...entry }));
    const target = next[entryIndex];
    if (!target || target.playerId === playerId) return current;
    const source = next.find((entry, index) => index !== entryIndex && entry.playerId === playerId);
    if (source) source.playerId = target.playerId;
    target.playerId = playerId;
    return next;
  });
  // @spec GBULL-006 — drag/drop preserves the selectors' pitcher-slot versus bench-slot boundary.
  const swapGameSlots = (sourceIndex: number, targetIndex: number) => setGameDraft((current) => {
    const source = current[sourceIndex];
    const target = current[targetIndex];
    const isPitcherSlot = (entry: ActiveLineupEntry) => entry.role === 'BULLPEN' || (entry.role === 'STARTER' && entry.fieldingPosition === 'Pitcher');
    const sameSlotType = source && target && (isPitcherSlot(source) === isPitcherSlot(target)) && ((source.role === 'BENCH') === (target.role === 'BENCH'));
    if (!source || !target || sourceIndex === targetIndex || !sameSlotType) return current;
    const next = current.map((entry) => ({ ...entry }));
    [next[sourceIndex].playerId, next[targetIndex].playerId] = [next[targetIndex].playerId, next[sourceIndex].playerId];
    return next;
  });
  // @spec GBULL-006
  const saveGameLineup = async () => {
    if (!teamId || !nextGame) return;
    setGameSaveError(null);
    const response = await fetch(Endpoints.SaveTeamGameLineup.replace(':teamId', teamId).replace(':gameId', String(nextGame.game.id)), { method: 'PATCH', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: gameDraft }) }).catch(() => null);
    if (!response || !response.ok) { const body = response ? await response.json().catch(() => ({})) : {}; setGameSaveError(body?.error ?? 'Unable to save game lineup'); return; }
    const saved = await response.json().catch(() => null);
    if (!isTeamLineup(saved)) { setGameSaveError('Unable to save game lineup'); return; }
    const updated = { ...nextGame, lineup: saved }; setNextGame(updated); setGameDraft(toGameEntries(updated.lineup));
    // @spec NAVLOAD-006,NAVLOAD-009
    revalidate();
  };
  const occupiedPositions = (self: number) => new Set(starters.filter((row) => row.entryIndex !== self).map((row) => row.fieldingPosition));

  const renderRow = (row: LineupRow, tab: LineupTab) => {
    const isDh = row.fieldingPosition === null && row.role === 'STARTER';
    const rating = row.fieldingPosition ? players.get(row.playerId)?.positions[row.fieldingPosition] ?? '—' : '';
    const testId = row.role === 'STARTER' ? `${tab.toLowerCase()}-row-${tab === 'BATTING' ? row.battingOrder : row.playerId}` : `${row.role.toLowerCase()}-row-${row.playerId}`;
    const editableSlot = isManagedTeam && editing && isSwappableSlot(row);
    const replacesPositionLabel = editing && tab === 'DEFENSIVE' && row.role === 'STARTER';
    const replacesPlayerName = editableSlot && !replacesPositionLabel;
    const dragProps = lineupDrag.dragProps(row.entryIndex, editableSlot, swapDraftSlots);
    // @spec BLUX-001,BLUX-002 — only eligible active-lineup rows can surface transient drag feedback.
    const isDragSource = editableSlot && lineupDrag.sourceIndex === row.entryIndex;
    const isDragTarget = editableSlot && lineupDrag.targetIndex === row.entryIndex;
    return <div key={row.entryIndex} data-testid={testId} data-slot-index={row.entryIndex} data-drag-source={isDragSource || undefined} data-drag-target={isDragTarget || undefined} {...dragProps} style={{ ...(row.valid === false ? { ...rowStyle, background: '#fff0f0', color: '#a11' } : rowStyle), ...(editableSlot ? { cursor: 'grab' } : {}), ...(isDragSource ? dragSourceStyle : {}), ...(isDragTarget ? dragTargetStyle : {}) }}>
      {!editing && row.valid === false && <span aria-label="Invalid lineup entry" style={{ color: '#b11', fontWeight: 800 }}>✕ Invalid</span>}
      {tab === 'DEFENSIVE' && row.role === 'STARTER' && (replacesPositionLabel ? <FieldingPositionPicker row={row} dhEnabled={dhEnabled} occupied={occupiedPositions(row.entryIndex)} onChange={updateDraft} /> : <span style={slotLabelStyle}>{isDh ? 'DH' : row.fieldingPosition}</span>)}
      {row.role !== 'STARTER' && <span style={tagStyle}>{row.role}</span>}
      {tab === 'BATTING' && row.role === 'STARTER' && <strong style={{ color: '#555', width: '24px' }}>{row.battingOrder ?? '—'}</strong>}
      <span data-testid={isDh ? 'dh-row' : undefined} style={{ flex: 1 }}>{replacesPlayerName ? <LineupSlotPicker row={row} entries={swappableRows} players={players} onSwap={swapDraftSlots} /> : <LineupPlayerLink playerId={row.playerId} players={players} gwId={gwId} />}</span>
      {!editing && <><span style={positionStyle}>{isDh ? 'DH' : row.fieldingPosition ?? ''}</span>{tab === 'DEFENSIVE' && <span style={ratingStyle}>{rating}</span>}</>}
      {editing && <>{tab === 'DEFENSIVE' && <DraftControls row={row} dhEnabled={dhEnabled} occupied={occupiedPositions(row.entryIndex)} onChange={updateDraft} showPosition={!replacesPositionLabel} />}</>}
    </div>;
  };

  return <PageContainer as="main" style={{ padding: '24px 24px 48px' }}>
    <header style={{ marginBottom: '20px' }}><h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Lineup</h1><p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.86rem' }}>Active lineup</p></header>
    {lineup && <>
      {isManagedTeam && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        {!editing ? <Button type="button" size="sm" onClick={enterEdit}>Edit Lineup</Button> : <><Button type="button" size="sm" onClick={saveLineup}>Save Lineup</Button><Button type="button" size="sm" onClick={cancelEdit}>Cancel</Button></>}
        {saveError && <ErrorText role="alert" style={{ fontSize: '0.82rem' }}>{saveError}</ErrorText>}
      </div>}
      <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>{(['DEFENSIVE', 'BATTING', 'BULLPEN'] as LineupTab[]).map((tab) => <Button key={tab} intent={activeTab === tab ? 'primary' : 'secondary'} role="tab" aria-selected={activeTab === tab} data-testid={`tab-${tab.toLowerCase()}`} onClick={() => setActiveTab(tab)} style={{ borderColor: '#ddd', fontWeight: 650, fontSize: '0.84rem' }}>{tab === 'DEFENSIVE' ? 'Defensive' : tab === 'BATTING' ? 'Batting' : 'Bullpen'}</Button>)}</div>
      {activeTab === 'DEFENSIVE' && <Card as="section" data-testid="defensive-table" aria-label="Defensive lineup" style={panelStyle}>{defensiveRows.map((row) => renderRow(row, 'DEFENSIVE'))}{reserves.map((row) => renderRow(row, 'DEFENSIVE'))}{editing && <UnassignedBucket rows={unassigned} renderRow={renderRow} />}</Card>}
      {activeTab === 'BATTING' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 0.55fr)', gap: '18px', alignItems: 'start' }}><Card as="section" data-testid="batting-table" aria-label="Batting order" style={panelStyle}>{battingRows.map((row) => renderRow(row, 'BATTING'))}{reserves.map((row) => renderRow(row, 'BATTING'))}{editing && <UnassignedBucket rows={unassigned} renderRow={renderRow} />}</Card>{startingPitcher && <Card as="section" data-testid="starting-pitcher" style={{ ...panelStyle, borderColor: '#71896e', background: '#f1f6ef' }}><SectionLabel>Starting pitcher</SectionLabel><LineupPlayerLink playerId={startingPitcher.playerId} players={players} gwId={gwId} /></Card>}</div>}
      {activeTab === 'BULLPEN' && <GameBullpenPanel game={nextGame} entries={gameDraft} players={players} roster={roster} gwId={gwId} editable={isManagedTeam && nextGame?.game.status === 'SCHEDULED'} error={gameSaveError} onChange={updateGameSlot} onSwap={swapGameSlots} onSave={saveGameLineup} />}
    </>}
  </PageContainer>;
};

// @spec GBULL-006
const GameBullpenPanel = ({ game, entries, players, roster, gwId, editable, error, onChange, onSwap, onSave }: { game: NextGameLineup | null; entries: ActiveLineupEntry[]; players: Map<number, RosterPlayer>; roster: RosterPlayer[]; gwId?: string; editable: boolean; error: string | null; onChange: (index: number, playerId: number) => void; onSwap: (sourceIndex: number, targetIndex: number) => void; onSave: () => void }) => {
  const gameLineupDrag = useLineupDragSource('application/x-game-lineup-entry-index');
  if (!game) return <Card as="section" data-testid="bullpen-empty" style={panelStyle}>No next scheduled game.</Card>;
  const slotRows = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.role === 'BENCH' || entry.role === 'BULLPEN' || (entry.role === 'STARTER' && entry.fieldingPosition === 'Pitcher'));
  const benchPlayerIds = new Set(entries.filter((entry) => entry.role === 'BENCH').map((entry) => entry.playerId));
  const defensiveStarterIds = new Set(entries.filter((entry) => entry.role === 'STARTER' && entry.fieldingPosition !== 'Pitcher').map((entry) => entry.playerId));
  return <Card as="section" data-testid="bullpen-game-lineup" style={panelStyle}><SectionLabel>Next game: vs {game.game.opponentName} · {game.game.scheduledDate ? (formatUtcDate(game.game.scheduledDate) ?? 'Date TBD') : 'Date TBD'}</SectionLabel>
    {slotRows.map(({ entry, index }) => {
      // @spec GBULL-006 — only pitchers can occupy the designated starter/active-reliever
      // slots. Keep an existing legacy occupant visible even if its current roster profile is bad.
      const pitcherSlot = entry.role === 'STARTER' || entry.role === 'BULLPEN';
      const eligiblePlayers = roster.filter((player) => player.id === entry.playerId || (pitcherSlot
        ? player.primaryPosition === 'Pitcher' && !defensiveStarterIds.has(player.id)
        : player.primaryPosition !== 'Pitcher' && benchPlayerIds.has(player.id)));
      const dragProps = gameLineupDrag.dragProps(index, editable, onSwap);
      return <div key={index} data-testid={`game-lineup-row-${entry.playerId}`} data-game-slot-index={index} {...dragProps} style={{ ...rowStyle, ...(editable ? { cursor: 'grab' } : {}) }}>{editable && <select aria-label={`${entry.role === 'STARTER' ? 'Starting pitcher' : entry.role.toLowerCase()} slot ${index + 1}`} value={entry.playerId} onChange={(event) => onChange(index, Number(event.target.value))}>{eligiblePlayers.map((player) => <option key={player.id} value={player.id}>{player.givenName} {player.familyName}</option>)}</select>}<span style={tagStyle}>{entry.role === 'STARTER' ? 'SP' : entry.role}</span><span style={{ flex: 1 }}><LineupPlayerLink playerId={entry.playerId} players={players} gwId={gwId} /></span></div>;
    })}
    {editable && <Button type="button" size="sm" onClick={onSave}>Save game lineup</Button>}{error && <ErrorText role="alert" style={{ marginLeft: '10px' }}>{error}</ErrorText>}
  </Card>;
};

// @spec LINEUI-010,LINEUI-011,LINEUI-013
const FieldingPositionPicker = ({ row, dhEnabled, occupied, onChange }: { row: LineupRow; dhEnabled: boolean; occupied: Set<PlayerPosition | null>; onChange: (index: number, patch: Partial<DraftEntry>) => void }) =>
  <select aria-label={`Fielding position for player ${row.playerId}`} data-testid={`position-picker-${row.playerId}`} value={row.fieldingPosition ?? (row.battingOrder != null ? 'DH' : '')} onChange={(e) => onChange(row.entryIndex, { fieldingPosition: e.target.value === 'DH' ? null : e.target.value as PlayerPosition })}><option value="">Choose position</option>{DEFENSIVE_TAB_ORDER.map((position) => <option key={position} value={position} disabled={occupied.has(position)}>{position}</option>)}{dhEnabled && <option value="DH" disabled={occupied.has(null)}>DH</option>}</select>;

// @spec LINEUI-010,LINEUI-011,LINEUI-013 — the position picker is rendered in the position column.
const DraftControls = ({ row, dhEnabled, occupied, onChange, showPosition }: { row: LineupRow; dhEnabled: boolean; occupied: Set<PlayerPosition | null>; onChange: (index: number, patch: Partial<DraftEntry>) => void; showPosition: boolean }) => <>
  <select aria-label={`Role for player ${row.playerId}`} data-testid={`role-picker-${row.playerId}`} value={row.role} onChange={(e) => onChange(row.entryIndex, { role: e.target.value as DraftRole })}>{(['STARTER', 'BENCH', 'BULLPEN', 'UNASSIGNED'] as DraftRole[]).map((role) => <option key={role} value={role}>{role}</option>)}</select>
  {row.role === 'STARTER' && <>{showPosition && <FieldingPositionPicker row={row} dhEnabled={dhEnabled} occupied={occupied} onChange={onChange} />}<select aria-label={`Batting slot for player ${row.playerId}`} data-testid={`batting-picker-${row.playerId}`} value={row.battingOrder ?? ''} disabled><option value="">—</option>{row.battingOrder != null && <option value={row.battingOrder}>{row.battingOrder}</option>}</select></>}
</>;

// @spec LINEUI-015 — the leading picker delegates to the same slot-swap mutation as whole-row drag/drop.
const LineupSlotPicker = ({ row, entries, players, onSwap }: { row: LineupRow; entries: LineupRow[]; players: Map<number, RosterPlayer>; onSwap: (sourceIndex: number, targetIndex: number) => void }) =>
  <select aria-label={`Lineup slot picker for player ${row.playerId}`} data-testid={`lineup-picker-${row.fieldingPosition ?? `bench-${row.entryIndex}`}`} value={row.playerId} onChange={(event) => {
    const sourceIndex = entries.find((entry) => entry.playerId === Number(event.target.value))?.entryIndex;
    if (sourceIndex != null) onSwap(sourceIndex, row.entryIndex);
  }}>{entries.map((entry) => <option key={entry.playerId} value={entry.playerId}>{playerName(entry.playerId, players)}</option>)}</select>;

// @spec LINEUI-013
const UnassignedBucket = ({ rows, renderRow }: { rows: LineupRow[]; renderRow: (row: LineupRow, tab: LineupTab) => React.ReactNode }) => <section data-testid="unassigned-bucket" aria-label="Unassigned" style={{ marginTop: '14px', borderTop: '1px solid #ddd' }}><SectionLabel style={{ marginBottom: '10px' }}>Unassigned</SectionLabel>{rows.map((row) => renderRow(row, 'DEFENSIVE'))}</section>;

const panelStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: '6px', padding: '16px', background: '#fff' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px', padding: '5px 7px', borderBottom: '1px solid #eee', fontSize: '0.88rem' };
// @spec BLUX-001 — preserve the source row's geometry while making its temporary vacancy unmistakable.
const dragSourceStyle: React.CSSProperties = { background: '#eeeeee', color: '#888', opacity: 0.52, filter: 'grayscale(1)' };
// @spec BLUX-002 — distinguish the valid prospective swap destination without changing the slot's data.
const dragTargetStyle: React.CSSProperties = { background: '#edf5eb', outline: '2px solid #71896e', outlineOffset: '-2px' };
const positionStyle: React.CSSProperties = { minWidth: '72px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#555' };
const ratingStyle: React.CSSProperties = { minWidth: '32px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#71896e' };
const tagStyle: React.CSSProperties = { minWidth: '58px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: '#888' };
const slotLabelStyle: React.CSSProperties = { minWidth: '78px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: '#555' };

export { TeamLineupView };
