// @spec BOXSUI-001,BOXSUI-002
import React from 'react';
import { useLoaderData, useParams } from 'react-router';
import { Card, PageContainer } from '../components/ui';
import { TeamLink } from '../components/team-link';

type BoxScorePlayer = { id: number; givenName: string; familyName: string; battingOrder: number | null; fieldingPosition: string | null; role: string; AB: number; H: number; R: number; RBI: number; '2B': number; '3B': number; HR: number; BB: number; SO: number; IP: number; pitchingH: number; pitchingBB: number; pitchingSO: number; ER: number };
type BoxScoreSide = { teamId: number; teamName: string; score: number | null; players: BoxScorePlayer[] };
type BoxScore = { id: number; home: BoxScoreSide; away: BoxScoreSide };

// @spec BOXSUI-001,BOXSUI-002,TEAMLINK-004
const TeamBoxScore = ({ side, kind, gwId }: { side: BoxScoreSide; kind: 'home' | 'away'; gwId: string | undefined }) => <Card as="section" style={{ padding: '16px', overflowX: 'auto' }}>
  <h2 style={{ marginTop: 0 }}><TeamLink gwId={gwId} teamId={side.teamId}>{side.teamName}</TeamLink> <output>{side.score}</output></h2>
  {side.players.length === 0 ? <p data-testid={`${kind}-box-score-empty`}>No stats recorded</p> : <table aria-label={`${side.teamName} box score`} style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead><tr>{['Player', 'Pos', 'Role', 'AB', 'H', 'R', 'RBI', '2B', '3B', 'HR', 'BB', 'SO', 'IP', 'P-H', 'P-BB', 'P-SO', 'ER'].map((label, index) => <th key={`${label}-${index}`} style={{ textAlign: index < 3 ? 'left' : 'right', padding: '5px' }}>{label}</th>)}</tr></thead>
    <tbody>{side.players.map((player) => <tr key={player.id}><td style={{ padding: '5px' }}>{player.battingOrder != null ? `${player.battingOrder}. ` : ''}{player.givenName} {player.familyName}</td><td>{player.fieldingPosition ?? '—'}</td><td>{player.role}</td>{[player.AB, player.H, player.R, player.RBI, player['2B'], player['3B'], player.HR, player.BB, player.SO, player.IP, player.pitchingH, player.pitchingBB, player.pitchingSO, player.ER].map((stat, index) => <td key={index} style={{ textAlign: 'right' }}>{stat}</td>)}</tr>)}</tbody>
  </table>}
</Card>;

// @spec BOXSUI-001,BOXSUI-002
const GameBoxScore = () => {
  const { gwId } = useParams();
  const boxScore = useLoaderData() as BoxScore | null;
  if (!boxScore) return <main data-testid="game-box-score-unavailable"><h1>Box score unavailable</h1></main>;
  return <PageContainer as="main" data-testid="game-box-score" style={{ maxWidth: '1200px', padding: '24px', display: 'grid', gap: '16px' }}>
    <header style={{ textAlign: 'center' }}><h1 style={{ margin: 0 }}>Final: {boxScore.away.teamName} {boxScore.away.score} – {boxScore.home.teamName} {boxScore.home.score}</h1></header>
    <TeamBoxScore side={boxScore.away} kind="away" gwId={gwId} />
    <TeamBoxScore side={boxScore.home} kind="home" gwId={gwId} />
  </PageContainer>;
};

export { GameBoxScore };
