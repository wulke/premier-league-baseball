import React, { useState } from 'react';
import { Link, useLoaderData, useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { PlayerDetail as PlayerDetailRecord, PlayerPosition } from '../../api/models';
import { Card, PageContainer } from '../components/ui';

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
  Pitcher: { left: '50%', top: '64%' }, Catcher: { left: '50%', top: '84%' }, FirstBase: { left: '72%', top: '62%' }, SecondBase: { left: '60%', top: '48%' },
  ThirdBase: { left: '28%', top: '62%' }, Shortstop: { left: '40%', top: '51%' }, LeftField: { left: '26%', top: '30%' }, CenterField: { left: '50%', top: '16%' }, RightField: { left: '74%', top: '30%' },
};

const ratingTint = (rating: number) => `hsl(${Math.round(Math.max(0, Math.min(100, rating)) * 1.2)} 62% 91%)`;
// @spec PDETUI-007
const affinityTint = (rating: number) => {
  const bounded = Math.max(0, Math.min(100, rating));
  return `hsl(${Math.round(bounded * 1.2)} 72% ${Math.round(88 - bounded / 3)}%)`;
};
const displayName = (player: PlayerDetailRecord) => `${player.givenName} ${player.familyName}`;
const countryFlag = (countryCode: string) => String.fromCodePoint(...countryCode.toUpperCase().split('').map((letter) => 127397 + letter.charCodeAt(0)));

const Panel = ({ children }: { children: React.ReactNode }) => <Card as="section" style={{ borderColor: '#ddd', padding: '16px', background: '#fff' }}>{children}</Card>;

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

// @spec PDETUI-007
const Positions = ({ player }: { player: PlayerDetailRecord }) => {
  const [view, setView] = useState<PositionView>('field');
  const primary = player.primaryPosition;
  const positions = Object.entries(player.positions) as Array<[PlayerPosition, number]>;
  return <div style={{ display: 'grid', gap: '16px' }}>
    <div role="group" aria-label="Position view" style={{ display: 'inline-flex', justifySelf: 'start', padding: '3px', gap: '2px', border: '1px solid #a8b4a5', borderRadius: '7px', background: '#eef3ed' }}>{([['field', 'Field diagram'], ['bars', 'Bar grid'], ['pills', 'Coverage pills']] as Array<[PositionView, string]>).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} style={{ padding: '7px 11px', border: 0, borderRadius: '4px', background: view === key ? '#244d2d' : 'transparent', color: view === key ? '#fff' : '#26352a', fontWeight: view === key ? 700 : 500, cursor: 'pointer' }}>{label}</button>)}</div>
    {view === 'field' && <div style={{ display: 'grid', gap: '10px' }}><div data-testid="position-field-diagram" aria-label="Baseball field position affinities" style={{ position: 'relative', height: '460px', maxWidth: '620px', margin: '0 auto', width: '100%', overflow: 'hidden', borderRadius: '12px', border: '3px solid #315a36', background: 'repeating-linear-gradient(90deg, #4e9852 0 34px, #438b47 34px 68px)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,.08), transparent 58%)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, clipPath: 'inset(0 0 49.3% 0)' }}><div style={{ position: 'absolute', width: '67.3%', height: '93.4%', left: '16.4%', top: '4%', borderRadius: '50% 50% 0 0', border: '2px solid rgba(238, 241, 212, .7)' }} /></div>
      <div aria-hidden="true" data-testid="position-field-dirt" style={{ position: 'absolute', width: '43%', aspectRatio: '1', left: '28.5%', bottom: '6%', transform: 'rotate(45deg)', background: '#c99562', border: '2px solid #a77649', boxShadow: '0 0 0 14px rgba(201,149,98,.25)' }} />
      <div aria-hidden="true" style={{ position: 'absolute', width: '25%', aspectRatio: '1', left: '37.5%', bottom: '15%', transform: 'rotate(45deg)', background: '#559a53', border: '2px solid #35743b' }} />
      <div aria-hidden="true" data-testid="position-field-mound" style={{ position: 'absolute', left: '50%', top: '65%', transform: 'translate(-50%, -50%)', width: '34px', height: '20px', borderRadius: '50%', background: '#b9814d', border: '1px solid #8e623a' }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '7%', transform: 'translateX(-50%) rotate(45deg)', width: '15px', height: '15px', background: '#f8f4e7', border: '1px solid #aa9d85', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)' }} />
      {[['32%', '62%'], ['50%', '48%'], ['68%', '62%']] .map(([left, top], index) => <div key={index} aria-hidden="true" style={{ position: 'absolute', left, top, transform: 'translate(-50%, -50%) rotate(45deg)', width: '13px', height: '13px', background: '#f8f4e7', border: '1px solid #aa9d85' }} />)}
      <div aria-hidden="true" style={{ position: 'absolute', height: '2px', width: '46%', right: '50%', bottom: '7%', background: '#f5f1d9', transformOrigin: 'right center', transform: 'rotate(43deg)' }} /><div aria-hidden="true" style={{ position: 'absolute', height: '2px', width: '46%', left: '50%', bottom: '7%', background: '#f5f1d9', transformOrigin: 'left center', transform: 'rotate(-43deg)' }} />
      {positions.map(([position, affinity]) => <div key={position} data-testid={`field-position-${position}`} style={{ ...fieldPositions[position], position: 'absolute', transform: 'translate(-50%, -50%)', minWidth: '48px', padding: '5px 5px 4px', display: 'grid', justifyItems: 'center', borderRadius: '18px', background: affinityTint(affinity), border: position === primary ? '3px solid #172b1b' : '1px solid #244d2d', boxShadow: '0 1px 3px rgba(0,0,0,.28)', fontWeight: 800, fontSize: '0.73rem', lineHeight: 1.05 }}><span>{positionLabels[position]}</span><span data-testid={`field-position-affinity-${position}`} style={{ fontSize: '0.68rem', fontWeight: 700 }}>{affinity}</span>{position === primary && <span data-testid={`field-position-primary-${position}`} style={{ marginTop: '2px', fontSize: '0.58rem', whiteSpace: 'nowrap' }}>★ Primary</span>}</div>)}
    </div><div data-testid="position-affinity-legend" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#3d4a3e' }}><span>Low affinity</span><span aria-hidden="true" style={{ width: '132px', height: '10px', borderRadius: '999px', background: 'linear-gradient(90deg, hsl(0 72% 88%), hsl(60 72% 71%), hsl(120 72% 55%))', border: '1px solid #8ca08d' }} /><span>High affinity</span></div></div>}
    {view === 'bars' && <div data-testid="position-bar-grid" style={{ display: 'grid', gap: '8px' }}>{positions.map(([position, affinity]) => <div key={position} data-testid={`bar-position-${position}`} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 48px', alignItems: 'center', gap: '8px' }}><strong>{positionLabels[position]} {position === primary && <small>★ Primary</small>}</strong><div style={{ height: '16px', background: '#e4e8e2', borderRadius: '999px', overflow: 'hidden' }}><div style={{ width: `${affinity}%`, height: '100%', background: affinityTint(affinity) }} /></div><span>{affinity}</span></div>)}</div>}
    {view === 'pills' && <div data-testid="position-coverage-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{positions.map(([position, affinity]) => <span key={position} data-testid={`pill-position-${position}`} style={{ ...chipStyle, background: affinityTint(affinity), border: position === primary ? '2px solid #172b1b' : '1px solid #78917c' }}>{positionLabels[position]} {affinity}{position === primary && ' · ★ Primary'}</span>)}</div>}
  </div>;
};

const Pitches = ({ player }: { player: PlayerDetailRecord }) => <div data-testid="pitch-repertoire" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>{player.pitches.map((pitch) => <Panel key={pitch.type}><div data-testid={`pitch-card-${pitch.type}`}><h2 style={{ marginTop: 0, fontSize: '1rem' }}>{pitch.type}</h2>{([['VEL', pitch.velocity], ['CTL', pitch.control], ['SPN', pitch.spin]] as Array<[string, number]>).map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '4px', background: ratingTint(value) }}><strong>{label}</strong><span>{value}</span></div>)}</div></Panel>)}</div>;

const chipStyle: React.CSSProperties = { display: 'inline-block', padding: '3px 8px', border: '1px solid #aaa', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, background: '#f6f6f6' };

// @spec PDETUI-001,PDETUI-002,PDETUI-003,PDETUI-004,PDETUI-005,PDETUI-006,PDETUI-007,PDETUI-008,PDETUI-009
const PlayerDetail = () => {
  const { playerId, gwId } = useParams();
  // @spec NAVLOAD-001,NAVLOAD-003,NAVLOAD-005
  const player = useLoaderData() as PlayerDetailRecord | null;
  const [tab, setTab] = useState<Tab>('overview');
  if (!player) return <main data-testid="player-not-found" style={{ padding: '24px' }}><h1>Player not found</h1><p>This player is unavailable in this game world.</p></main>;
  const pitchable = player.primaryPosition === 'Pitcher';
  const tabs: Array<[Tab, string]> = [['overview', 'Overview'], ['positions', 'Positions'], ...(pitchable ? [['pitches', 'Pitch repertoire'] as [Tab, string]] : [])];
  return <PageContainer as="main" style={{ maxWidth: '1000px', padding: '24px 24px 48px' }}>
    <header data-testid="player-masthead" style={{ borderBottom: '1px solid #ddd', paddingBottom: '16px', marginBottom: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, fontSize: '1.65rem' }}>{displayName(player)}</h1><span data-testid="primary-position-badge" style={{ ...chipStyle, background: affinityTint(player.positions[player.primaryPosition]), borderColor: '#466c4b', color: '#132717' }}>{positionLabels[player.primaryPosition]}</span>{player.contract ? <Link to={`/${gwId}/team/${player.contract.team.id}`}>{player.contract.team.name}</Link> : <span data-testid="free-agent-chip" style={chipStyle}>Free Agent</span>}</div><p style={{ margin: '8px 0 0', color: '#666' }}>{countryFlag(player.countryCode)} {player.countryCode} · Bats {player.bats} / Throws {player.throws} · Age {player.age} ({player.birthDate})</p></header>
    <nav aria-label="Player detail tabs" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} style={{ padding: '9px 13px', border: 'none', borderBottom: tab === key ? '3px solid #222' : '3px solid transparent', background: 'none', cursor: 'pointer', fontWeight: tab === key ? 700 : 400 }}>{label}</button>)}</nav>
    {tab === 'overview' && <Overview player={player} />}{tab === 'positions' && <Positions player={player} />}{tab === 'pitches' && pitchable && <Pitches player={player} />}
  </PageContainer>;
};

export { PlayerDetail };
