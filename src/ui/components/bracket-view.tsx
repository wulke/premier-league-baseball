import React, { useState } from 'react';
import { BracketRound, BracketTie } from '../../api/models';
import { styled } from '../styles/stitches.config';
import { Badge, Button, Card, SectionLabel } from './ui';
import { TeamCrest } from './team-crest';

const NODE_HEIGHT = 82;

const Tree = styled('div', {
  overflowX: 'auto',
  paddingBottom: '$sm',
});

const TreeColumns = styled('div', {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '$xl',
  minWidth: 'max-content',
});

const RoundColumn = styled('section', {
  display: 'grid',
  gap: '$sm',
  flex: '0 0 248px',
  width: '248px',
});

const TieNode = styled('div', {
  position: 'relative',
  minHeight: `${NODE_HEIGHT}px`,
  '&[data-connects-to]::after': {
    content: '',
    position: 'absolute',
    top: `${NODE_HEIGHT / 2}px`,
    left: '100%',
    width: '$xl',
    borderTop: '1px solid $borderMedium',
  },
  '&[data-connects-to]::before': {
    content: '',
    position: 'absolute',
    top: `${NODE_HEIGHT / 2}px`,
    left: 'calc(100% + 23px)',
    height: `${NODE_HEIGHT / 2}px`,
    borderRight: '1px solid $borderMedium',
  },
});

const NodeShell = styled(Card, {
  height: `${NODE_HEIGHT}px`,
  boxSizing: 'border-box',
  overflow: 'hidden',
  background: '$white',
});

const TeamRow = styled('span', {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '$sm',
  padding: '5px $sm',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '$base',
  '&[data-bracket-result="winner"]': { fontWeight: 700, color: '$black' },
  '&[data-bracket-result="loser"]': { color: '$textFaint' },
});

const isPendingRound = (round: BracketRound) =>
  round.status === 'PENDING' && round.ties.every((tie) => tie.games.length === 0);

// @spec BRKT-004
const getSeriesScoreText = (tie: Extract<BracketTie, { kind: 'SERIES' }>) =>
  tie.games.map((game) => {
    const teamAScore = game.homeTeamId === tie.teamA.teamId ? game.homeTeamResult : game.awayTeamResult;
    const teamBScore = game.homeTeamId === tie.teamB.teamId ? game.homeTeamResult : game.awayTeamResult;
    return `${teamAScore ?? '–'}–${teamBScore ?? '–'}`;
  }).join(', ');

// @spec BRKT-004
const getSeriesWins = (tie: Extract<BracketTie, { kind: 'SERIES' }>) => {
  let teamAWins = 0;
  let teamBWins = 0;
  for (const game of tie.games) {
    if (game.homeTeamResult == null || game.awayTeamResult == null || game.homeTeamResult === game.awayTeamResult) continue;
    const winnerId = game.homeTeamResult > game.awayTeamResult ? game.homeTeamId : game.awayTeamId;
    if (winnerId === tie.teamA.teamId) teamAWins += 1;
    if (winnerId === tie.teamB.teamId) teamBWins += 1;
  }
  return `${teamAWins}–${teamBWins}`;
};

// @spec BRKT-004
const getSeriesSummary = (tie: Extract<BracketTie, { kind: 'SERIES' }>) => {
  const winnerName = tie.winnerTeamId === tie.teamA.teamId ? tie.teamA.teamName : tie.winnerTeamId === tie.teamB.teamId ? tie.teamB.teamName : null;
  return `${tie.teamA.teamName ?? 'TBD'} [${getSeriesScoreText(tie)}] ${tie.teamB.teamName ?? 'TBD'}${winnerName ? ` ✓ ${winnerName} (${getSeriesWins(tie)})` : ''}`;
};

// @spec BRKT-004
const getGameSummary = (tie: Extract<BracketTie, { kind: 'SERIES' }>, gameIndex: number) => {
  const game = tie.games[gameIndex];
  return `Game ${gameIndex + 1}: ${game.homeTeamName} ${game.homeTeamResult ?? '–'}–${game.awayTeamResult ?? '–'} ${game.awayTeamName ?? 'TBD'}`;
};

const BracketTeamRoster = ({ teams, onTeamClick }: { teams: any[]; onTeamClick: (teamId: number) => void }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', padding: '4px 0' }}>
    {teams.map((team) => (
      <Button key={team.id} intent="secondary" aria-label={team.config?.name ?? `Team ${team.id}`} onClick={() => onTeamClick(team.id)} style={{ justifyContent: 'space-between' }}>
        {team.config?.name ?? `Team ${team.id}`} <span>→</span>
      </Button>
    ))}
  </div>
);

const resultFor = (teamId: number | null, winnerTeamId: number | undefined) =>
  !winnerTeamId || !teamId ? 'neutral' : teamId === winnerTeamId ? 'winner' : 'loser';

// @spec BRKT-001,BRKT-002,BRKT-003,BRKT-004,BRKT-005,BRKT-006,BRKT-007,BRKT-008
const BracketView = ({ rounds, teams, onTeamClick }: { rounds: BracketRound[]; teams: any[]; onTeamClick: (teamId: number) => void }) => {
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  if (rounds.length === 0) {
    return <><p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>No bracket yet — season not started.</p><BracketTeamRoster teams={teams} onTeamClick={onTeamClick} /></>;
  }

  const pendingRoundIndex = rounds.findIndex(isPendingRound);
  const visibleRounds = pendingRoundIndex === -1 ? rounds : rounds.slice(0, pendingRoundIndex);
  const pendingRound = pendingRoundIndex === -1 ? null : rounds[pendingRoundIndex];

  return (
    <Tree data-testid="bracket-tree" style={{ overflowX: 'auto' }}>
      <TreeColumns>
        {visibleRounds.map((round, roundIndex) => (
          <RoundColumn key={`${round.round}-${round.label}`} data-testid={`bracket-round-${round.round}`}>
            <SectionLabel style={{ color: '#666' }}>{round.label}</SectionLabel>
            {round.ties.map((tie, tieIndex) => {
              const key = `${round.round}-${tieIndex}`;
              const isSeries = tie.kind === 'SERIES';
              const expanded = expandedSeries[key] ?? false;
              const nextRound = visibleRounds[roundIndex + 1];
              const connectsTo = nextRound ? `${nextRound.round}-${Math.floor(tieIndex / 2)}` : undefined;
              const toggle = () => isSeries && setExpandedSeries((current) => ({ ...current, [key]: !expanded }));
              const teamAResult = resultFor(tie.teamA.teamId, tie.winnerTeamId);
              const teamBResult = tie.kind === 'BYE' ? 'neutral' : resultFor(tie.teamB.teamId, tie.winnerTeamId);
              return (
                <TieNode key={key} data-testid={`bracket-node-${round.round}-${tieIndex}`} data-connects-to={connectsTo} onClick={toggle} role={isSeries ? 'button' : undefined} tabIndex={isSeries ? 0 : undefined} onKeyDown={(event) => { if (isSeries && (event.key === 'Enter' || event.key === ' ')) toggle(); }}>
                  <NodeShell data-testid={`bracket-node-shell-${round.round}-${tieIndex}`} data-bracket-coordinate={`${round.round}-${tieIndex}`}>
                    <TeamRow role="link" tabIndex={tie.teamA.teamId == null ? undefined : 0} data-testid={`bracket-team-${round.round}-${tieIndex}-${tie.teamA.teamId ?? 'tbd'}`} data-bracket-result={teamAResult} onClick={(event) => { event.stopPropagation(); if (tie.teamA.teamId != null) onTeamClick(tie.teamA.teamId); }}>
                      <TeamCrest name={tie.teamA.teamName ?? 'TBD'} size={18} /> {tie.teamA.teamName ?? 'TBD'}
                    </TeamRow>
                    <TeamRow role={tie.kind === 'BYE' ? undefined : 'link'} tabIndex={tie.kind === 'SERIES' && tie.teamB.teamId != null ? 0 : undefined} data-testid={`bracket-team-${round.round}-${tieIndex}-${tie.kind === 'BYE' ? 'bye' : tie.teamB.teamId ?? 'tbd'}`} data-bracket-result={teamBResult} onClick={(event) => { event.stopPropagation(); if (tie.kind === 'SERIES' && tie.teamB.teamId != null) onTeamClick(tie.teamB.teamId); }}>
                      {tie.kind === 'BYE' ? 'Bye' : <><TeamCrest name={tie.teamB.teamName ?? 'TBD'} size={18} /> {tie.teamB.teamName ?? 'TBD'}</>}
                    </TeamRow>
                    {tie.kind === 'BYE' ? <div style={{ padding: '0 8px', fontSize: '0.7rem', color: '#666' }}><span>{tie.teamA.teamName ?? 'TBD'} vs Bye</span> · Auto-advanced: {tie.teamA.teamName ?? 'TBD'}</div> : <div style={{ padding: '0 8px', fontSize: '0.68rem', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSeriesSummary(tie)} <Badge>{expanded ? 'Hide games' : 'Show games'}</Badge></div>}
                  </NodeShell>
                  {isSeries && expanded && <Card style={{ borderTop: 'none', borderRadius: '0 0 4px 4px', padding: '8px 12px', display: 'grid', gap: '8px', background: '#fcfcfc' }}>{tie.games.map((game, gameIndex) => <div key={game.gameId} style={{ fontSize: '0.84rem', color: '#333' }}>{getGameSummary(tie, gameIndex)}</div>)}</Card>}
                </TieNode>
              );
            })}
          </RoundColumn>
        ))}
        {pendingRound && <Card dashed data-testid="bracket-pending-round" style={{ flex: '0 0 248px', padding: '10px 12px', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'left', marginTop: '28px' }}>Next: {pendingRound.label} — games pending</Card>}
      </TreeColumns>
    </Tree>
  );
};

export { BracketView };
