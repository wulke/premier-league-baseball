// @spec PREGAME-001,PREGAME-002,PREGAME-003,PREGAME-004,PREGAME-005 (LLD: docs/llds/manager/pre-game-prep-ui.md)
import React, { useState } from 'react';
import { useLoaderData, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer, TeamLineup, TeamSeasonGame } from '../../api/models';
import { Button, Card, ErrorText, PageContainer, SectionLabel } from '../components/ui';
import { formatUtcDate } from '../format-date';
import { TeamLineupEditor } from './team-lineup';

type PrepData = { game: TeamSeasonGame | null; lineup: TeamLineup | null; roster: RosterPlayer[]; opponentRoster: RosterPlayer[]; standings: Array<{ teamId: number; won: number; lost: number; drawn: number }> };

// @spec PREGAME-001,PREGAME-002,PREGAME-003,PREGAME-004 — game context is loaded from the
// managed team's calendar, making direct URLs to another club's game unavailable by design.
const PreGamePrep = () => {
  const { gwId } = useParams();
  const gameWorld = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
  const { game, lineup, roster, opponentRoster, standings } = useLoaderData() as PrepData;
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<{ homeTeamResult: number; awayTeamResult: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const managedTeamId = gameWorld?.managedTeamId;
  const isManagedGame = game != null && managedTeamId != null && (game.homeTeamId === managedTeamId || game.awayTeamId === managedTeamId);
  const isScheduledManagedGame = isManagedGame && game.status === 'SCHEDULED';
  if (!isManagedGame) return <PageContainer as="main" style={{ padding: '24px' }}><h1>Game unavailable</h1><p>This pre-game screen is available only for your managed club's games.</p></PageContainer>;

  // @spec PREGAME-005 — mirrors the backend's simulate() guard exactly: a null scheduledDate
  // skips the currentDate check there (and here), while a set scheduledDate requires a
  // configured currentDate on or after it (the same non-strict boundary simulateToday's batch
  // loop uses).
  const currentDate = gameWorld?.currentDate;
  const isReadyToPrep = isScheduledManagedGame
    && (game.scheduledDate == null || (currentDate != null && game.scheduledDate.slice(0, 10) <= currentDate));

  const opponentId = game.homeTeamId === managedTeamId ? game.awayTeamId : game.homeTeamId;
  const opponentName = game.homeTeamId === managedTeamId ? game.awayTeamName : game.homeTeamName;
  const record = standings.find((row) => row.teamId === opponentId);
  const probablePitcher = opponentRoster.find((player) => player.primaryPosition === 'Pitcher');
  const readyToSim = async () => {
    setSimulating(true); setError(null);
    const response = await fetch(Endpoints.SimulateGame.replace(':gameId', String(game.gameId)), { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' } }).catch(() => null);
    if (!response?.ok) { const body = response ? await response.json().catch(() => ({})) : {}; setError(body?.error ?? 'Unable to simulate game'); setSimulating(false); return; }
    const completed = await response.json(); setResult(completed); setSimulating(false); revalidate();
  };

  return <PageContainer as="main" style={{ padding: '24px 24px 48px' }}>
    <header style={{ marginBottom: '20px' }}><SectionLabel>Pre-game prep</SectionLabel><h1 style={{ margin: '4px 0' }}>{game.homeTeamName} vs {game.awayTeamName}</h1><p style={{ margin: 0, color: '#666' }}>{game.scheduledDate ? (formatUtcDate(game.scheduledDate) ?? 'Date TBD') : 'Date TBD'} · {game.homeTeamId === managedTeamId ? 'Home' : 'Away'}</p></header>
    <Card as="section" aria-label="Opponent context" style={{ padding: '16px', marginBottom: '20px' }}><SectionLabel>Opponent</SectionLabel><strong>{opponentName}</strong><div style={{ marginTop: '8px', color: '#555' }}>Record: {record ? `${record.won}-${record.lost}${record.drawn ? `-${record.drawn}` : ''}` : '—'}</div><div style={{ marginTop: '4px', color: '#555' }}>Probable pitcher: {probablePitcher ? `${probablePitcher.givenName} ${probablePitcher.familyName}` : 'TBD'}</div></Card>
    {isReadyToPrep && <section aria-label="Game lineup"><SectionLabel>Your game lineup</SectionLabel><TeamLineupEditor gwId={gwId} teamId={String(managedTeamId)} isManagedTeam loaded={{ lineup, roster, nextGame: null }} revalidate={revalidate} gameId={game.gameId} embedded /></section>}
    <section style={{ marginTop: '24px' }}>{isReadyToPrep && <Button type="button" onClick={readyToSim} disabled={simulating}>{simulating ? 'Simulating…' : 'Ready to sim'}</Button>}{(result ?? (game.status === 'COMPLETED' ? { homeTeamResult: game.homeTeamResult, awayTeamResult: game.awayTeamResult } : null)) && <strong data-testid="pre-game-score" style={{ marginLeft: '12px' }}>{(result ?? game).homeTeamResult}–{(result ?? game).awayTeamResult}</strong>}{error && <ErrorText role="alert" style={{ marginLeft: '12px' }}>{error}</ErrorText>}</section>
  </PageContainer>;
};

export { PreGamePrep };
