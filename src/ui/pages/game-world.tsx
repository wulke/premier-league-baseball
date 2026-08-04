import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams, useNavigate } from 'react-router';
import { useGameWorldContext } from '../context/game-world-context';
import { getChampionDivisionId, getChampionTeamName } from '../champion';
import { TeamSeasonGame } from '../../api/models';

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

// @spec UI-002,LIFE-001,TODAYUI-001,TODAYUI-002,TODAYUI-003,TODAYUI-004,TODAYUI-005
const GameWorld = () => {
  const { gwId } = useParams();
  const { gw, invalidate } = useGameWorldContext();
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
        // @spec TODAYUI-001,TODAYUI-002
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
          fetch(Endpoints.GetLeagueToday.replace(':leagueId', String(leagueRow.id)), {
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

    await Promise.all(leagues.map((league) =>
      fetch(Endpoints.LeagueSeasonStart.replace(':leagueId', String(league.id)), {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (response) => {
        if (!response.ok) throw Error(`Failed to start season for League ${league.id} (${response.status})`);
        return response.json();
      })
    )).then(() => {
      // LLD u3 — refresh the shared context gw instead of a divergent local copy so the rail's
      // chip/batch guard stays in sync after a season start.
      invalidate();
      setStartSeasonStatus('success');
      navigate(`/${gwId}/${leagues[0].id}`);
    }).catch((error) => {
      console.error(error);
      setStartSeasonError('Could not start a new season. Try again.');
      setStartSeasonStatus('error');
    });
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
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

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

      {/* Season Section */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#888',
          fontWeight: 600,
        }}>
          Season
        </h2>

        <div style={{
          border: '1px solid #ccc',
          borderRadius: '6px',
          padding: '20px',
        }}>
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
                <button
                  onClick={() => setStartSeasonStatus('confirming')}
                  style={{
                    padding: '9px 20px',
                    background: '#000',
                    color: '#fff',
                    border: '1px solid #000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Start Season {nextYear}
                </button>
              )}

              {startSeasonStatus === 'confirming' && (
                <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>
                    Start Season {nextYear}? This will create division season entries and schedule all games.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={startNewSeason}
                      style={{
                        padding: '8px 18px',
                        background: '#000',
                        color: '#fff',
                        border: '1px solid #000',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setStartSeasonStatus('idle')}
                      style={{
                        padding: '8px 16px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      Cancel
                    </button>
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
                  <p style={{ margin: '0 0 12px', color: '#c00', fontSize: '0.9rem' }}>
                    {startSeasonError}
                  </p>
                  <button
                    onClick={() => setStartSeasonStatus('confirming')}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* @spec TODAYUI-003,TODAYUI-004,TODAYUI-005 */}
      {leaguesWithTodayGames.length > 0 && (
        <section data-testid="today-section" style={{ marginBottom: '40px' }}>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: '#888',
            fontWeight: 600,
          }}>
            Today
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {leaguesWithTodayGames.map((league) => (
              <div key={league.leagueId} data-testid={`today-league-${league.leagueId}`}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700 }}>
                  {league.leagueName}
                </h3>
                <div style={{ border: '1px solid #ccc', borderRadius: '6px' }}>
                  {league.games.map((game) => (
                    <div
                      key={game.gameId}
                      data-testid={`today-game-${game.gameId}`}
                      style={{ padding: '12px 14px', borderBottom: '1px solid #eee' }}
                    >
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '3px' }}>
                        {game.scheduledDate ?? 'TBD'} · {game.divisionName}{game.roundLabel ? ` · ${game.roundLabel}` : ''}
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {game.homeTeamName} vs {game.awayTeamName}
                        {game.status === 'COMPLETED' && ` · ${game.homeTeamResult}–${game.awayTeamResult}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '3px' }}>
                        {game.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leagues Section */}
      <section>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#888',
          fontWeight: 600,
        }}>
          Leagues
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leagues.map((league) => (
            <div
              key={league.id}
              onClick={() => navigate(`/${gwId}/${league.id}`)}
              style={{
                border: '1px solid #ccc',
                borderRadius: '6px',
                padding: '16px 20px',
                cursor: 'pointer',
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export { GameWorld };
