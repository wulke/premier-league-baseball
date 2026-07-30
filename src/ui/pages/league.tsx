import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { BracketRound, BracketTie, DivisionStandings, LeagueDivisionBracket, TeamStanding } from '../../api/models';
import { useNavigate, useParams } from 'react-router';
import { Collapsible } from 'radix-ui';
import { AppHeader } from '../components/app-header';

const StandingsTable = ({
  standings,
  onTeamClick,
}: {
  standings: TeamStanding[];
  onTeamClick: (teamId: number) => void;
}) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
    <thead>
      <tr style={{ borderBottom: '2px solid #000' }}>
        {['Pos', 'Team', 'P', 'W', 'D', 'L', 'RF', 'RA', 'RD', 'Pts'].map((h) => (
          <th
            key={h}
            style={{
              textAlign: h === 'Team' ? 'left' : 'center',
              padding: '6px 8px',
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#555',
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {standings.map((row, i) => (
        <tr key={row.teamId} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ textAlign: 'center', padding: '8px', color: '#888', fontSize: '0.8rem' }}>{i + 1}</td>
          <td style={{ padding: '8px' }}>
            <button
              onClick={() => onTeamClick(row.teamId)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'underline',
                textDecorationColor: '#ccc',
                textUnderlineOffset: '3px',
              }}
            >
              {row.teamName}
            </button>
          </td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.played}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.won}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.drawn}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.lost}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runsFor}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runsAgainst}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runDifference}</td>
          <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700 }}>{row.points}</td>
        </tr>
      ))}
    </tbody>
  </table>
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
      <button
        key={team.id}
        aria-label={team.config?.name ?? `Team ${team.id}`}
        onClick={() => onTeamClick(team.id)}
        style={{
          background: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}
      >
        {team.config?.name ?? `Team ${team.id}`}
        <span style={{ float: 'right', color: '#aaa', fontSize: '0.75rem' }}>→</span>
      </button>
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
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666' }}>
              {round.label}
            </div>

            {byes.length > 0 && (
              <div style={{ display: 'grid', gap: '6px', padding: '10px 12px', background: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>
                  Byes ({byes.length}) — auto-advanced to {nextRoundLabel}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#222' }}>
                  {byes.map((tie) => tie.teamA.teamName).filter(Boolean).join(', ')}
                </div>
              </div>
            )}

            {series.map((tie, tieIndex) => {
              const seriesKey = `${round.round}-${tie.teamA.teamId ?? 'a'}-${tie.teamB.teamId ?? 'b'}-${tieIndex}`;
              const isExpanded = expandedSeries[seriesKey] ?? false;

              return (
                <div key={seriesKey} style={{ border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedSeries((current) => ({ ...current, [seriesKey]: !isExpanded }))}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
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
                  </button>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #eee', padding: '8px 12px', display: 'grid', gap: '8px', background: '#fcfcfc' }}>
                      {tie.games.map((game, gameIndex) => (
                        <div key={game.gameId} style={{ fontSize: '0.84rem', color: '#333' }}>
                          {getGameSummary(tie, gameIndex)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      {pendingRound && (
        <div style={{ padding: '10px 12px', border: '1px dashed #ccc', borderRadius: '4px', fontSize: '0.85rem', color: '#666' }}>
          Next: {pendingRound.label} — games pending
        </div>
      )}
    </div>
  );
};

// @spec UI-005,UI-006,UI-007,UI-008
const Division = ({
  division,
  divisionStandings,
  divisionBracket,
  onTeamClick,
}: {
  division: any;
  divisionStandings?: DivisionStandings;
  divisionBracket?: LeagueDivisionBracket;
  onTeamClick: (teamId: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasStandings = Boolean(divisionStandings && divisionStandings.standings.length > 0);
  const structure = divisionBracket?.structure ?? division.config?.format?.structure ?? 'ROUND_ROBIN';

  return (
    <div
      data-testid={`division-card-${division.id}`}
      style={{ border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}
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
              <BracketView
                rounds={divisionBracket?.rounds ?? []}
                teams={division.Teams ?? []}
                onTeamClick={onTeamClick}
              />
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
    </div>
  );
};

// @spec UI-004,UI-005,UI-006,UI-007,UI-008
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

  // @spec UI-004
  const openTeamCalendar = (teamId: number) => navigate(`/${gwId}/team/${teamId}/calendar`);
  const hasAnyStandings = standings.some((s) => s.standings.length > 0);
  const hasAnyBracketRounds = divisionBrackets.some((division) => division.rounds.length > 0);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* Shared header (Flow B) */}
      <AppHeader backLink={`/${gwId}`} backLabel="Game World" />

      {/* League identity */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {league.config?.name ?? `League ${leagueId}`}
          </h1>
          {league.config?.type && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#666',
              border: '1px solid #ccc',
              borderRadius: '20px',
              padding: '2px 10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {league.config.type}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
          {league.Divisions?.length ?? 0} division{league.Divisions?.length !== 1 ? 's' : ''}
          {hasAnyStandings || hasAnyBracketRounds ? ' · Season in progress' : ' · No active season'}
        </p>
      </div>

      {/* Divisions */}
      <section>
        <h2 style={{
          margin: '0 0 14px',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#888',
          fontWeight: 600,
        }}>
          {hasAnyStandings || hasAnyBracketRounds ? 'Standings' : 'Divisions'}
        </h2>

        {league.Divisions?.map((division: any) => (
          <Division
            key={division.id}
            division={division}
            divisionStandings={standings.find((entry) => entry.divisionId === division.id)}
            divisionBracket={divisionBrackets.find((entry) => entry.divisionId === division.id)}
            onTeamClick={openTeamCalendar}
          />
        ))}
      </section>
    </div>
  );
};

export { League };
