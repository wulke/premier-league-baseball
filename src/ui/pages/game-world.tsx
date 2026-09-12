import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams, useNavigate, useRevalidator, useRouteLoaderData } from 'react-router';
import { getChampionDivisionId, getChampionTeamName } from '../champion';
import { TeamSeasonGame } from '../../api/models';
import { NotificationStream } from './notification-stream';
import { Button, Card, ErrorText, PageContainer, SectionLabel } from '../components/ui';
import { TeamCrest } from '../components/team-crest';

type StartSeasonStatus = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';
type LeagueSeasonSummary = {
  leagueId: number;
  leagueName: string;
  championName: string | null;
};
type LeagueTodaySummary = {
  leagueId: number;
  leagueName: string;
  games: TeamSeasonGame[];
};

type ScoreboardOutcome = 'home' | 'away' | 'none';

// @spec TODAYUI-008
const scoreboardOutcome = (game: TeamSeasonGame): ScoreboardOutcome => {
  if (game.status !== 'COMPLETED' || game.homeTeamResult == null || game.awayTeamResult == null) return 'none';
  if (game.homeTeamResult > game.awayTeamResult) return 'home';
  if (game.awayTeamResult > game.homeTeamResult) return 'away';
  return 'none';
};

// @spec UI-002,LIFE-001,TODAYUI-001,TODAYUI-002,TODAYUI-003,TODAYUI-004,TODAYUI-005,TODAYUI-006,TODAYUI-007,TODAYUI-008
const GameWorld = () => {
  const { gwId } = useParams();
  // @spec RLDRUI-001,RLDRUI-003
  const gw = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
  const [startSeasonStatus, setStartSeasonStatus] = useState<StartSeasonStatus>('idle');
  const [startSeasonError, setStartSeasonError] = useState<string | null>(null);
  const [leagueSeasonSummary, setLeagueSeasonSummary] = useState<LeagueSeasonSummary[]>([]);
  const [leagueTodaySummary, setLeagueTodaySummary] = useState<LeagueTodaySummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!gwId || !gw?.config?.inProgress) {
      setLeagueSeasonSummary([]);
      setLeagueTodaySummary([]);
      return;
    }

    const leagues: any[] = gw.Leagues ?? [];
    if (leagues.length === 0) {
      setLeagueSeasonSummary([]);
      setLeagueTodaySummary([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      leagues.map(async (leagueRow) => {
        // @spec TODAYUI-001,TODAYUI-002,TODAYUI-006
        // TODAYUI-006: a null currentDate guarantees TODAY-002's 422 — skip the
        // request (and the server-side log noise it produces) and treat the league
        // as an empty window instead.
        const [leagueResponse, bracketResponse, games] = await Promise.all([
          fetch(Endpoints.GetLeague.replace(':leagueId', String(leagueRow.id)), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
          }).then((response) => (response.ok ? response.json() : {})),
          fetch(Endpoints.GetLeagueBracket.replace(':leagueId', String(leagueRow.id)), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
          }).then((response) => (response.ok ? response.json() : [])),
          gw?.currentDate == null
            ? Promise.resolve([])
            : fetch(Endpoints.GetLeagueToday.replace(':leagueId', String(leagueRow.id)), {
              method: 'GET',
              mode: 'cors',
              headers: { 'Content-Type': 'application/json' },
            })
              .then((response) => (response.ok ? response.json() : []))
              .catch(() => []),
        ]);

        const championDivisionId = getChampionDivisionId(leagueResponse);
        const championDivision = Array.isArray(bracketResponse)
          ? bracketResponse.find((entry: any) => entry.divisionId === championDivisionId)
          : null;

        const leagueName = leagueRow.config?.name ?? `League ${leagueRow.id}`;
        return {
          season: {
            leagueId: leagueRow.id,
            leagueName,
            championName: getChampionTeamName(leagueResponse, championDivision ? [championDivision] : []),
          },
          today: {
            leagueId: leagueRow.id,
            leagueName,
            games: Array.isArray(games) ? games : [],
          },
        };
      }),
    )
      .then((summary) => {
        if (!cancelled) {
          setLeagueSeasonSummary(summary.map(({ season }) => season));
          setLeagueTodaySummary(summary.map(({ today }) => today));
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setLeagueSeasonSummary([]);
          setLeagueTodaySummary([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gw, gwId]);

  // @spec SCL-016
  const startNewSeason = async () => {
    if (!gwId || leagues.length === 0) return;
    setStartSeasonStatus('submitting');
    setStartSeasonError(null);

    try {
      // Sequential, not Promise.all: the leagues share a single-writer SQLite
      // connection, so starting them concurrently causes SQLITE_BUSY.
      for (const league of leagues) {
        const response = await fetch(Endpoints.LeagueSeasonStart.replace(':leagueId', String(league.id)), {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw Error(`Failed to start season for League ${league.id} (${response.status})`);
        await response.json();
      }
      // @spec RLDRUI-003 — refresh the shared gw loader instead of a divergent local copy so
      // the rail's chip/batch guard stays in sync after a season start.
      revalidate();
      setStartSeasonStatus('success');
      navigate(`/${gwId}/${leagues[0].id}`);
    } catch (error) {
      console.error(error);
      setStartSeasonError('Could not start a new season. Try again.');
      setStartSeasonStatus('error');
    }
  };

  if (!gw) return <></>;

  const nextYear = gw.year + 1;
  const leagues: any[] = gw.Leagues ?? [];
  const seasonComplete = leagueSeasonSummary.length > 0 && leagueSeasonSummary.every((league) => league.championName);
  const seasonSummaryText = leagueSeasonSummary.map((league) =>
    league.championName ? `🏆 ${league.leagueName}: ${league.championName}` : `${league.leagueName}: In progress`,
  ).join(' · ');
  // @spec TODAYUI-003,TODAYUI-004,TODAYUI-005
  const leaguesWithTodayGames = leagueTodaySummary.filter((league) => league.games.length > 0);

  return (
    <PageContainer>

      {/* Game World Identity */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 700 }}>
          {gw.config?.name ?? `Game World ${gwId}`}
        </h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
          {leagues.length} league{leagues.length !== 1 ? 's' : ''}
          &nbsp;&nbsp;·&nbsp;&nbsp;
          Current year: {gw.year}
        </p>
      </div>

      {/* @spec NOTIFUI-007 */}
      <NotificationStream gwId={Number(gwId)} managedTeamId={gw.managedTeamId ?? null} />

      {/* Season Section */}
      <section style={{ marginBottom: '40px' }}>
        <SectionLabel style={{ marginBottom: '12px' }}>
          Season
        </SectionLabel>

        <Card style={{ padding: '20px' }}>
          {gw.config?.inProgress ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                Season {gw.year} — {seasonComplete ? 'Complete' : 'In Progress'}
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                {seasonSummaryText || 'Navigate to a league below to view standings and simulate games.'}
              </p>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                No active season
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#555' }}>
                Ready to begin Season {nextYear}.
              </p>

              {startSeasonStatus === 'idle' && (
                <Button intent="primary" onClick={() => setStartSeasonStatus('confirming')} style={{ padding: '9px 20px', fontSize: '0.9rem' }}>
                  Start Season {nextYear}
                </Button>
              )}

              {startSeasonStatus === 'confirming' && (
                <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>
                    Start Season {nextYear}? This will create division season entries and schedule all games.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Button intent="primary" onClick={startNewSeason}>
                      Confirm
                    </Button>
                    <Button intent="secondary" onClick={() => setStartSeasonStatus('idle')}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {startSeasonStatus === 'submitting' && (
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                  Creating season schedule…
                </p>
              )}

              {startSeasonStatus === 'error' && (
                <div>
                  <ErrorText style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>
                    {startSeasonError}
                  </ErrorText>
                  <Button intent="secondary" onClick={() => setStartSeasonStatus('confirming')}>
                    Retry
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      {/* @spec TODAYUI-003,TODAYUI-004,TODAYUI-005,TODAYUI-007,TODAYUI-008 */}
      {leaguesWithTodayGames.length > 0 && (
        <section data-testid="today-section" style={{ marginBottom: '40px' }}>
          <SectionLabel style={{ marginBottom: '12px' }}>
            Today
          </SectionLabel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {leaguesWithTodayGames.map((league) => (
              <div key={league.leagueId} data-testid={`today-league-${league.leagueId}`}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700 }}>
                  {league.leagueName}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {league.games.map((game) => {
                    // @spec TODAYUI-007,TODAYUI-008
                    const outcome = scoreboardOutcome(game);
                    const context = [game.divisionName, game.roundLabel, game.scheduledDate].filter(Boolean).join(' · ');
                    const statusLabel = game.status === 'COMPLETED' ? 'Final' : game.status;
                    const teamLane = (side: 'home' | 'away', teamName: string, badge: string | null | undefined, result: number | null) => {
                      const isWinner = outcome === side;
                      return (
                        <div
                          key={side}
                          data-testid={`today-team-lane-${game.gameId}-${side}`}
                          style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto 18px', gap: '8px', alignItems: 'center', minWidth: 0, fontWeight: isWinner ? 700 : 400 }}
                        >
                          {/* @spec BADGEUI-009 */}
                          <TeamCrest name={teamName} badge={badge} testId={`today-team-badge-${game.gameId}-${side}`} />
                          <span data-testid={`today-team-name-${game.gameId}-${side}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {teamName}
                          </span>
                          <span data-testid={`today-team-score-${game.gameId}-${side}`} style={{ minWidth: '16px', textAlign: 'right', fontWeight: 700 }}>
                            {result ?? '—'}
                          </span>
                          {isWinner ? <span data-testid={`today-winner-${game.gameId}-${side}`} aria-label={`${teamName} won`}>W</span> : <span aria-hidden="true" />}
                        </div>
                      );
                    };

                    return (
                      <div key={game.gameId} data-testid={`today-game-${game.gameId}`}>
                        <div
                          data-testid={`today-scoreboard-${game.gameId}`}
                          style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr)', gap: '12px 20px', alignItems: 'center', padding: '10px 12px', border: '1px solid #dfe5dc', borderRadius: '6px', background: '#fff' }}
                        >
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{context || 'TBD'}</div>
                          <div style={{ justifySelf: 'end', fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' }}>{statusLabel}</div>
                          <div style={{ display: 'grid', gap: '5px', gridColumn: '1 / -1' }}>
                            {teamLane('home', game.homeTeamName, game.homeTeamBadge, game.homeTeamResult)}
                            {teamLane('away', game.awayTeamName, game.awayTeamBadge, game.awayTeamResult)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leagues Section */}
      <section>
        <SectionLabel style={{ marginBottom: '12px' }}>
          Leagues
        </SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leagues.map((league) => (
            <Card
              key={league.id}
              interactive
              onClick={() => navigate(`/${gwId}/${league.id}`)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {league.config?.name ?? `League ${league.id}`}
                </div>
                {league.config?.type && (
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                    {league.config.type}
                  </div>
                )}
              </div>
              <span style={{ color: '#aaa', fontSize: '1rem' }}>→</span>
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  );
};

export { GameWorld };
