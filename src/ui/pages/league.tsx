import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { BracketRound, BracketTie, DivisionStandings, LeagueDivisionBracket, TeamStanding } from '../../api/models';
import { useNavigate, useParams } from 'react-router';
import { Collapsible } from 'radix-ui';
import { formatLeagueChampionBanner, getChampionBracket, getChampionTeamName } from '../champion';
import { Badge, Button, Card, PageContainer, SectionLabel, Table, Td, Th, Tr } from '../components/ui';

const StandingsTable = ({
  standings,
  onTeamClick,
}: {
  standings: TeamStanding[];
  onTeamClick: (teamId: number) => void;
}) => (
  <Table>
    <thead>
      <tr style={{ borderBottom: '2px solid #000' }}>
        {['Pos', 'Team', 'P', 'W', 'D', 'L', 'RF', 'RA', 'RD', 'Pts'].map((h) => (
          <Th key={h} style={{ textAlign: h === 'Team' ? 'left' : 'center' }}>
            {h}
          </Th>
        ))}
      </tr>
    </thead>
    <tbody>
      {standings.map((row, i) => (
        <Tr key={row.teamId}>
          <Td style={{ color: '#888', fontSize: '0.8rem' }}>{i + 1}</Td>
          <Td align="left">
            <Button
              intent="ghost"
              onClick={() => onTeamClick(row.teamId)}
              style={{
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'underline',
                textDecorationColor: '#ccc',
                textUnderlineOffset: '3px',
              }}
            >
              {row.teamName}
            </Button>
          </Td>
          <Td>{row.played}</Td>
          <Td>{row.won}</Td>
          <Td>{row.drawn}</Td>
          <Td>{row.lost}</Td>
          <Td>{row.runsFor}</Td>
          <Td>{row.runsAgainst}</Td>
          <Td>{row.runDifference}</Td>
          <Td style={{ fontWeight: 700 }}>{row.points}</Td>
        </Tr>
      ))}
    </tbody>
  </Table>
);

const TeamRoster = ({
  teams,
  onTeamClick,
}: {
  teams: any[];
  onTeamClick: (teamId: number) => void;
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', padding: '4px 0' }}>
    {teams.map((team) => (
      <Button
        key={team.id}
        intent="secondary"
        aria-label={team.config?.name ?? `Team ${team.id}`}
        onClick={() => onTeamClick(team.id)}
        style={{ borderColor: '#e0e0e0', padding: '8px 12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
      >
        {team.config?.name ?? `Team ${team.id}`}
        <span style={{ float: 'right', color: '#aaa', fontSize: '0.75rem' }}>→</span>
      </Button>
    ))}
  </div>
);

const isPendingRound = (round: BracketRound) =>
  round.status === 'PENDING' && round.ties.every((tie) => tie.games.length === 0);

const getSeriesScoreText = (tie: Extract<BracketTie, { kind: 'SERIES' }>) =>
  tie.games.map((game) => {
    const teamAScore = game.homeTeamId === tie.teamA.teamId ? game.homeTeamResult : game.awayTeamResult;
    const teamBScore = game.homeTeamId === tie.teamB.teamId ? game.homeTeamResult : game.awayTeamResult;
    return `${teamAScore ?? '–'}–${teamBScore ?? '–'}`;
  }).join(', ');

const getSeriesWins = (tie: Extract<BracketTie, { kind: 'SERIES' }>) => {
  let teamAWins = 0;
  let teamBWins = 0;

  for (const game of tie.games) {
    if (game.homeTeamResult == null || game.awayTeamResult == null) continue;
    if (game.homeTeamResult === game.awayTeamResult) continue;

    const winnerId = game.homeTeamResult > game.awayTeamResult ? game.homeTeamId : game.awayTeamId;
    if (winnerId === tie.teamA.teamId) teamAWins += 1;
    if (winnerId === tie.teamB.teamId) teamBWins += 1;
  }

  return `${teamAWins}–${teamBWins}`;
};

const getSeriesSummary = (tie: Extract<BracketTie, { kind: 'SERIES' }>) => {
  const scoreText = getSeriesScoreText(tie);
  const winnerName = tie.winnerTeamId === tie.teamA.teamId ? tie.teamA.teamName : tie.teamB.teamName;
  const winnerText = winnerName ? ` ✓ ${winnerName} (${getSeriesWins(tie)})` : '';
  return `${tie.teamA.teamName ?? 'TBD'} [${scoreText}] ${tie.teamB.teamName ?? 'TBD'}${winnerText}`;
};

const getGameSummary = (tie: Extract<BracketTie, { kind: 'SERIES' }>, gameIndex: number) => {
  const game = tie.games[gameIndex];
  return `Game ${gameIndex + 1}: ${game.homeTeamName} ${game.homeTeamResult ?? '–'}–${game.awayTeamResult ?? '–'} ${game.awayTeamName ?? 'TBD'}`;
};

// @spec MSUI-002
const getSeededFromGroupsLabel = (league: any, division: any): string | null => {
  const selection = division.config?.seedingSelection;
  if (selection?.kind !== 'TOP_N_PER_DIVISION') return null;

  const sourceStage = league.config?.stages?.find((stage: any) => stage.id === selection.fromStage);
  return `Seeded from completed ${sourceStage?.name ?? 'group stage'}`;
};

// @spec UI-005,UI-006,UI-007,UI-008
const BracketView = ({
  rounds,
  teams,
  onTeamClick,
}: {
  rounds: BracketRound[];
  teams: any[];
  onTeamClick: (teamId: number) => void;
}) => {
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  if (rounds.length === 0) {
    return (
      <>
        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>
          No bracket yet — season not started.
        </p>
        <TeamRoster teams={teams} onTeamClick={onTeamClick} />
      </>
    );
  }

  const pendingRoundIndex = rounds.findIndex(isPendingRound);
  const visibleRounds = pendingRoundIndex === -1 ? rounds : rounds.slice(0, pendingRoundIndex);
  const pendingRound = pendingRoundIndex === -1 ? null : rounds[pendingRoundIndex];

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {visibleRounds.map((round, roundIndex) => {
        const byes = round.ties.filter((tie): tie is Extract<BracketTie, { kind: 'BYE' }> => tie.kind === 'BYE');
        const series = round.ties.filter((tie): tie is Extract<BracketTie, { kind: 'SERIES' }> => tie.kind === 'SERIES');
        const nextRoundLabel = rounds[roundIndex + 1]?.label ?? 'next round';

        return (
          <section key={`${round.round}-${round.label}`} style={{ display: 'grid', gap: '10px' }}>
            <SectionLabel style={{ color: '#666' }}>
              {round.label}
            </SectionLabel>

            {byes.length > 0 && (
              <Card style={{ display: 'grid', gap: '6px', padding: '10px 12px', background: '#fafafa', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                  Byes ({byes.length}) — auto-advanced to {nextRoundLabel}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#222' }}>
                  {byes.map((tie) => tie.teamA.teamName).filter(Boolean).join(', ')}
                </div>
              </Card>
            )}

            {series.map((tie, tieIndex) => {
              const seriesKey = `${round.round}-${tie.teamA.teamId ?? 'a'}-${tie.teamB.teamId ?? 'b'}-${tieIndex}`;
              const isExpanded = expandedSeries[seriesKey] ?? false;

              return (
                <Card key={seriesKey} style={{ borderRadius: '4px', overflow: 'hidden' }}>
                  <Button
                    intent="ghost"
                    onClick={() => setExpandedSeries((current) => ({ ...current, [seriesKey]: !isExpanded }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>{getSeriesSummary(tie)}</span>
                    <span style={{ color: '#777', fontSize: '0.78rem', fontWeight: 600 }}>
                      {isExpanded ? 'Hide games' : 'Show games'}
                    </span>
                  </Button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #eee', padding: '8px 12px', display: 'grid', gap: '8px', background: '#fcfcfc' }}>
                      {tie.games.map((game, gameIndex) => (
                        <div key={game.gameId} style={{ fontSize: '0.84rem', color: '#333' }}>
                          {getGameSummary(tie, gameIndex)}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </section>
        );
      })}

      {pendingRound && (
        <Card dashed style={{ padding: '10px 12px', borderRadius: '4px', fontSize: '0.85rem', textAlign: 'left' }}>
          Next: {pendingRound.label} — games pending
        </Card>
      )}
    </div>
  );
};

// @spec UI-005,UI-006,UI-007,UI-008,MSUI-001,MSUI-002
const Division = ({
  division,
  divisionStandings,
  divisionBracket,
  seededFromGroupsLabel,
  onTeamClick,
}: {
  division: any;
  divisionStandings?: DivisionStandings;
  divisionBracket?: LeagueDivisionBracket;
  seededFromGroupsLabel?: string | null;
  onTeamClick: (teamId: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasStandings = Boolean(divisionStandings && divisionStandings.standings.length > 0);
  const structure = divisionBracket?.structure ?? division.config?.format?.structure ?? 'ROUND_ROBIN';

  return (
    <Card
      data-testid={`division-card-${division.id}`}
      style={{ overflow: 'hidden', marginBottom: '12px' }}
    >
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              cursor: 'pointer',
              background: '#fafafa',
              borderBottom: isOpen ? '1px solid #e0e0e0' : 'none',
              userSelect: 'none',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{division.config?.name ?? `Division ${division.id}`}</span>
              {hasStandings && (
                <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#888' }}>
                  {divisionStandings?.standings.length} teams
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
              {isOpen ? '▲ Hide' : '▼ Show'}
            </span>
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div style={{ padding: '12px 16px' }}>
            {structure === 'KNOCKOUT' ? (
              <>
                {seededFromGroupsLabel && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>
                    {seededFromGroupsLabel}
                  </p>
                )}
                <BracketView
                  rounds={divisionBracket?.rounds ?? []}
                  teams={division.Teams ?? []}
                  onTeamClick={onTeamClick}
                />
              </>
            ) : hasStandings ? (
              <StandingsTable standings={divisionStandings!.standings} onTeamClick={onTeamClick} />
            ) : (
              <>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>
                  No standings yet — season not started.
                </p>
                <TeamRoster teams={division.Teams ?? []} onTeamClick={onTeamClick} />
              </>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
};

// @spec UI-001,UI-003,UI-004,UI-005,UI-006,UI-007,UI-008,MSUI-001,MSUI-002,MSUI-003
const League = () => {
  const { gwId, leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState<any>(null);
  const [standings, setStandings] = useState<DivisionStandings[]>([]);
  const [divisionBrackets, setDivisionBrackets] = useState<LeagueDivisionBracket[]>([]);

  useEffect(() => {
    if (!leagueId) return;

    let isMounted = true;

    fetch(Endpoints.GetLeague.replace(':leagueId', leagueId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then((leagueData) => { if (isMounted) setLeague(leagueData); })
      .catch(console.error);

    fetch(Endpoints.GetLeagueStandings.replace(':leagueId', leagueId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then((standingsData) => { if (isMounted) setStandings(standingsData ?? []); })
      .catch((error) => { console.error(error); if (isMounted) setStandings([]); });

    fetch(Endpoints.GetLeagueBracket.replace(':leagueId', leagueId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then((bracketData) => { if (isMounted) setDivisionBrackets(bracketData ?? []); })
      .catch((error) => { console.error(error); if (isMounted) setDivisionBrackets([]); });

    return () => { isMounted = false; };
  }, [leagueId]);

  if (!league) return <></>;

  // @spec ROSTUI-001
  const openTeamHub = (teamId: number) => navigate(`/${gwId}/team/${teamId}`);
  const hasAnyStandings = standings.some((s) => s.standings.length > 0);
  const hasAnyBracketRounds = divisionBrackets.some((division) => division.rounds.length > 0);
  const championBanner = formatLeagueChampionBanner(
    league,
    getChampionTeamName(league, divisionBrackets),
  );
  const championDivision = getChampionBracket(league, divisionBrackets);

  return (
    <PageContainer>

      {/* League identity */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {league.config?.name ?? `League ${leagueId}`}
          </h1>
          {league.config?.type && (
            <Badge>
              {league.config.type}
            </Badge>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
          {championBanner ?? `${league.Divisions?.length ?? 0} division${league.Divisions?.length !== 1 ? 's' : ''}${hasAnyStandings || hasAnyBracketRounds ? ' · Season in progress' : ' · No active season'}`}
        </p>
      </div>

      {/* Divisions */}
      <section>
        <SectionLabel style={{ marginBottom: '14px' }}>
          {hasAnyStandings || hasAnyBracketRounds ? 'Standings' : 'Divisions'}
        </SectionLabel>

        {league.Divisions?.map((division: any) => (
          <Division
            key={division.id}
            division={division}
            divisionStandings={standings.find((entry) => entry.divisionId === division.id)}
            divisionBracket={divisionBrackets.find((entry) => entry.divisionId === division.id)}
            seededFromGroupsLabel={getSeededFromGroupsLabel(league, division)}
            onTeamClick={openTeamHub}
          />
        ))}
      </section>
    </PageContainer>
  );
};

export { League };
