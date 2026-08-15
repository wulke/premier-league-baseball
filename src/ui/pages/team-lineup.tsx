import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer, TeamLineup } from '../../api/models';

type LineupState = TeamLineup | null;

// @spec LINEUI-002,LINEUI-003,LINEUI-004
const playerName = (playerId: number, players: Map<number, RosterPlayer>) => {
  const player = players.get(playerId);
  return player ? `${player.givenName} ${player.familyName}` : `Player #${playerId}`;
};

// @spec LINEUI-002,LINEUI-003,LINEUI-004
const LineupPlayerLink = ({ playerId, players, gwId }: { playerId: number; players: Map<number, RosterPlayer>; gwId?: string }) => (
  <Link to={`/${gwId}/player/${playerId}`} style={{ color: '#222', fontWeight: 650, textUnderlineOffset: '3px' }}>
    {playerName(playerId, players)}
  </Link>
);

// @spec LINEUI-002,LINEUI-003,LINEUI-004
const TeamLineupView = () => {
  const { gwId, teamId } = useParams();
  const [lineup, setLineup] = useState<LineupState>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);

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
  const battingOrder = useMemo(() => (lineup?.starters ?? [])
    .filter((starter) => starter.battingOrder != null)
    .sort((left, right) => left.battingOrder! - right.battingOrder!), [lineup]);
  const startingPitcher = lineup?.starters.find((starter) => starter.playerId === lineup.startingPitcherId);

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 24px 48px' }}>
      <header style={{ marginBottom: '20px' }}><h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Lineup</h1><p style={{ margin: '6px 0 0', color: '#666', fontSize: '0.86rem' }}>Active lineup</p></header>
      {lineup && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(230px, 0.55fr)', gap: '18px', alignItems: 'start' }}>
        <section data-testid="batting-order-card" aria-label="Batting order" style={panelStyle}>
          <h2 style={headingStyle}>Batting order</h2>
          {battingOrder.map((starter) => {
            const isDh = starter.fieldingPosition === null;
            const order = starter.battingOrder!;
            return <div key={starter.playerId} data-testid={`batting-order-row-${order}`} style={{ ...rowStyle, background: isDh ? '#f5f1e7' : 'transparent' }}>
              <strong style={{ color: '#555', width: '24px' }}>{order}</strong>
              <span data-testid={isDh ? 'dh-row' : undefined} style={{ flex: 1 }}><LineupPlayerLink playerId={starter.playerId} players={players} gwId={gwId} /></span>
              <span style={positionStyle}>{isDh ? 'DH' : starter.fieldingPosition}</span>
            </div>;
          })}
        </section>
        <div style={{ display: 'grid', gap: '18px' }}>
          {startingPitcher && <section data-testid="starting-pitcher" style={{ ...panelStyle, borderColor: '#71896e', background: '#f1f6ef' }}>
            <h2 style={headingStyle}>Starting pitcher</h2>
            <LineupPlayerLink playerId={startingPitcher.playerId} players={players} gwId={gwId} />
          </section>}
          <section data-testid="bench-pool" style={panelStyle}>
            <h2 style={headingStyle}>Bench</h2>
            <Pool players={players} playerIds={lineup.bench.map((entry) => entry.playerId)} gwId={gwId} />
          </section>
          <section data-testid="bullpen-pool" style={panelStyle}>
            <h2 style={headingStyle}>Bullpen</h2>
            <Pool players={players} playerIds={lineup.bullpen.map((entry) => entry.playerId)} gwId={gwId} />
          </section>
        </div>
      </div>}
    </main>
  );
};

// @spec LINEUI-004
const Pool = ({ playerIds, players, gwId }: { playerIds: number[]; players: Map<number, RosterPlayer>; gwId?: string }) => (
  <div style={{ display: 'grid', gap: '7px' }}>
    {playerIds.map((playerId) => <div key={playerId}><LineupPlayerLink playerId={playerId} players={players} gwId={gwId} /></div>)}
  </div>
);

const panelStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: '6px', padding: '16px', background: '#fff' };
const headingStyle: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px', padding: '5px 7px', borderBottom: '1px solid #eee', fontSize: '0.88rem' };
const positionStyle: React.CSSProperties = { minWidth: '72px', textAlign: 'right', fontSize: '0.77rem', fontWeight: 700, color: '#555' };

export { TeamLineupView };
