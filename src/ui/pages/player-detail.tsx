import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { PlayerDetail as PlayerDetailRecord, PlayerPosition } from '../../api/models';

type Tab = 'overview' | 'positions' | 'pitches';
type PositionView = 'field' | 'bars' | 'pills';

const ratings: Array<{ key: keyof Pick<PlayerDetailRecord, 'contact' | 'power' | 'armStrength' | 'accuracy' | 'reaction' | 'vision' | 'discipline'>; label: string }> = [
  { key: 'contact', label: 'CON' }, { key: 'power', label: 'POW' }, { key: 'armStrength', label: 'ARM' },
  { key: 'accuracy', label: 'ACC' }, { key: 'reaction', label: 'REA' }, { key: 'vision', label: 'VIS' }, { key: 'discipline', label: 'DIS' },
];

const positionLabels: Record<PlayerPosition, string> = {
  Pitcher: 'P', Catcher: 'C', FirstBase: '1B', SecondBase: '2B', ThirdBase: '3B', Shortstop: 'SS', LeftField: 'LF', CenterField: 'CF', RightField: 'RF',
};

const fieldPositions: Record<PlayerPosition, React.CSSProperties> = {
  Pitcher: { left: '50%', top: '61%' }, Catcher: { left: '50%', top: '83%' }, FirstBase: { left: '72%', top: '59%' }, SecondBase: { left: '61%', top: '44%' },
  ThirdBase: { left: '28%', top: '59%' }, Shortstop: { left: '39%', top: '44%' }, LeftField: { left: '21%', top: '20%' }, CenterField: { left: '50%', top: '12%' }, RightField: { left: '79%', top: '20%' },
};

const ratingTint = (rating: number) => `hsl(${Math.round(Math.max(0, Math.min(100, rating)) * 1.2)} 62% 91%)`;
const displayName = (player: PlayerDetailRecord) => `${player.givenName} ${player.familyName}`;
const countryFlag = (countryCode: string) => String.fromCodePoint(...countryCode.toUpperCase().split('').map((letter) => 127397 + letter.charCodeAt(0)));

const Panel = ({ children }: { children: React.ReactNode }) => <section style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '16px', background: '#fff' }}>{children}</section>;

const Overview = ({ player }: { player: PlayerDetailRecord }) => {
  const [showOvr, setShowOvr] = useState(false);
  const ovr = Math.round(ratings.reduce((total, rating) => total + player[rating.key], 0) / ratings.length);
  return <div style={{ display: 'grid', gap: '16px' }}>
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}><h2 style={{ margin: 0, fontSize: '1rem' }}>Ratings</h2><button type="button" onClick={() => setShowOvr((shown) => !shown)}>{showOvr ? 'Hide display OVR' : 'Display OVR'}</button></div>
      {showOvr && <output data-testid="display-ovr" style={{ fontWeight: 700, marginBottom: '10px', display: 'block' }}>OVR {ovr}</output>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(48px, 1fr))', gap: '6px' }}>{ratings.map(({ key, label }) => <div key={key} data-testid={`player-rating-${key}`} style={{ padding: '9px 5px', textAlign: 'center', fontWeight: 700, background: ratingTint(player[key]), borderRadius: '3px' }}><small style={{ display: 'block', color: '#555' }}>{label}</small>{player[key]}</div>)}</div>
    </Panel>
    <Panel><h2 style={{ marginTop: 0, fontSize: '1rem' }}>Contract</h2>{player.contract ? <div data-testid="contract-block"><strong>{player.contract.team.name}</strong>{' '}<span>{player.contract.startDate} – {player.contract.endDate}</span></div> : <span data-testid="contract-free-agent" style={chipStyle}>Free Agent</span>}</Panel>
    <Panel><h2 style={{ marginTop: 0, fontSize: '1rem' }}>Career &amp; accomplishments</h2><p data-testid="career-deferred" style={{ marginBottom: 0, color: '#666' }}>Stats, contract history, and awards will graduate here as those records become available.</p></Panel>
  </div>;
};

const Positions = ({ player }: { player: PlayerDetailRecord }) => {
  const [view, setView] = useState<PositionView>('field');
  const primary = (Object.entries(player.positions) as Array<[PlayerPosition, number]>).reduce((best, current) => current[1] > best[1] ? current : best)[0];
  return <div style={{ display: 'grid', gap: '16px' }}>
    <div role="group" aria-label="Position view" style={{ display: 'flex', gap: '8px' }}>{([['field', 'Field diagram'], ['bars', 'Bar grid'], ['pills', 'Coverage pills']] as Array<[PositionView, string]>).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>
    {view === 'field' && <div data-testid="position-field-diagram" aria-label="Baseball field position affinities" style={{ position: 'relative', height: '360px', maxWidth: '560px', margin: '0 auto', width: '100%', background: 'linear-gradient(#dff1d9 0 46%, #d4b288 46% 100%)', clipPath: 'polygon(50% 0, 100% 49%, 84% 100%, 16% 100%, 0 49%)', border: '1px solid #99b58d' }}>{(Object.entries(player.positions) as Array<[PlayerPosition, number]>).map(([position, affinity]) => <div key={position} title={`${position}: ${affinity}`} style={{ ...fieldPositions[position], position: 'absolute', transform: 'translate(-50%, -50%)', width: '44px', height: '44px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: ratingTint(affinity), border: position === primary ? '3px solid #222' : '1px solid #777', fontWeight: 700, fontSize: '0.75rem' }}>{positionLabels[position]}</div>)}</div>}
    {view === 'bars' && <div data-testid="position-bar-grid" style={{ display: 'grid', gap: '8px' }}>{(Object.entries(player.positions) as Array<[PlayerPosition, number]>).map(([position, affinity]) => <div key={position} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 35px', alignItems: 'center', gap: '8px' }}><strong>{positionLabels[position]}</strong><div style={{ height: '14px', background: '#eee' }}><div style={{ width: `${affinity}%`, height: '100%', background: ratingTint(affinity), borderRight: position === primary ? '3px solid #222' : undefined }} /></div><span>{affinity}</span></div>)}</div>}
    {view === 'pills' && <div data-testid="position-coverage-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{(Object.entries(player.positions) as Array<[PlayerPosition, number]>).map(([position, affinity]) => <span key={position} style={{ ...chipStyle, background: ratingTint(affinity), border: position === primary ? '2px solid #222' : '1px solid #bbb' }}>{positionLabels[position]} {affinity}</span>)}</div>}
  </div>;
};

const Pitches = ({ player }: { player: PlayerDetailRecord }) => <div data-testid="pitch-repertoire" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>{player.pitches.map((pitch) => <Panel key={pitch.type}><div data-testid={`pitch-card-${pitch.type}`}><h2 style={{ marginTop: 0, fontSize: '1rem' }}>{pitch.type}</h2>{([['VEL', pitch.velocity], ['CTL', pitch.control], ['SPN', pitch.spin]] as Array<[string, number]>).map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '4px', background: ratingTint(value) }}><strong>{label}</strong><span>{value}</span></div>)}</div></Panel>)}</div>;

const chipStyle: React.CSSProperties = { display: 'inline-block', padding: '3px 8px', border: '1px solid #aaa', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, background: '#f6f6f6' };

// @spec PDETUI-001,PDETUI-002,PDETUI-003,PDETUI-004,PDETUI-005,PDETUI-006,PDETUI-007,PDETUI-008,PDETUI-009
const PlayerDetail = () => {
  const { playerId, gwId } = useParams();
  const [player, setPlayer] = useState<PlayerDetailRecord | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!playerId) { setPlayer(null); return; }
    let mounted = true;
    setPlayer(undefined);
    fetch(Endpoints.GetPlayerDetail.replace(':playerId', playerId), { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (mounted) setPlayer(data && !Array.isArray(data) ? data : null); })
      .catch(() => { if (mounted) setPlayer(null); });
    return () => { mounted = false; };
  }, [playerId]);

  if (player === undefined) return <main style={{ padding: '24px' }} aria-busy="true">Loading player…</main>;
  if (!player) return <main data-testid="player-not-found" style={{ padding: '24px' }}><h1>Player not found</h1><p>This player is unavailable in this game world.</p></main>;
  const pitchable = player.primaryPosition === 'Pitcher';
  const tabs: Array<[Tab, string]> = [['overview', 'Overview'], ['positions', 'Positions'], ...(pitchable ? [['pitches', 'Pitch repertoire'] as [Tab, string]] : [])];
  return <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 24px 48px' }}>
    <header data-testid="player-masthead" style={{ borderBottom: '1px solid #ddd', paddingBottom: '16px', marginBottom: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, fontSize: '1.65rem' }}>{displayName(player)}</h1><span style={chipStyle}>{positionLabels[player.primaryPosition]}</span>{player.contract ? <Link to={`/${gwId}/team/${player.contract.team.id}`}>{player.contract.team.name}</Link> : <span data-testid="free-agent-chip" style={chipStyle}>Free Agent</span>}</div><p style={{ margin: '8px 0 0', color: '#666' }}>{countryFlag(player.countryCode)} {player.countryCode} · Bats {player.bats} / Throws {player.throws} · Age {player.age} ({player.birthDate})</p></header>
    <nav aria-label="Player detail tabs" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} style={{ padding: '9px 13px', border: 'none', borderBottom: tab === key ? '3px solid #222' : '3px solid transparent', background: 'none', cursor: 'pointer', fontWeight: tab === key ? 700 : 400 }}>{label}</button>)}</nav>
    {tab === 'overview' && <Overview player={player} />}{tab === 'positions' && <Positions player={player} />}{tab === 'pitches' && pitchable && <Pitches player={player} />}
  </main>;
};

export { PlayerDetail };
