import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams, useNavigate } from 'react-router';
import { useGameWorldContext } from '../context/game-world-context';
import { AppHeader } from '../components/app-header';
import { getChampionDivisionId, getChampionTeamName } from '../champion';

type StartSeasonStatus = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';
type LeagueSeasonSummary = {
  leagueId: number;
  leagueName: string;
  championName: string | null;
};

// @spec UI-002,LIFE-001
const GameWorld = () => {
  const { gwId } = useParams();
  const { gw, invalidate } = useGameWorldContext();
  const [startSeasonStatus, setStartSeasonStatus] = useState<StartSeasonStatus>('idle');
  const [startSeasonError, setStartSeasonError] = useState<string | null>(null);
  const [leagueSeasonSummary, setLeagueSeasonSummary] = useState<LeagueSeasonSummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!gwId || !gw?.config?.inProgress) {
      setLeagueSeasonSummary([]);
      return;
    }

    const leagues: any[] = gw.Leagues ?? [];
    if (leagues.length === 0) {
      setLeagueSeasonSummary([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      leagues.map(async (leagueRow) => {
        const [leagueResponse, bracketResponse] = await Promise.all([
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
        ]);

        const championDivisionId = getChampionDivisionId(leagueResponse);
        const championDivision = Array.isArray(bracketResponse)
          ? bracketResponse.find((entry: any) => entry.divisionId === championDivisionId)
          : null;

        return {
          leagueId: leagueRow.id,
          leagueName: leagueRow.config?.name ?? `League ${leagueRow.id}`,
          championName: getChampionTeamName(leagueResponse, championDivision ? [championDivision] : []),
        };
      }),
    )
      .then((summary) => {
        if (!cancelled) setLeagueSeasonSummary(summary);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLeagueSeasonSummary([]);
      });

    return () => {
      cancelled = true;
    };
  }, [gw, gwId]);

  const startNewSeason = async () => {
    if (!gwId) return;
    setStartSeasonStatus('submitting');
    setStartSeasonError(null);

    await fetch(Endpoints.NewSeason.replace(':gwId', gwId!), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(async (response) => {
      if (!response.ok) throw Error(`Failed to start new season (${response.status})`);
      return response.json();
    }).then((updatedGw) => {
      // LLD u3 — refresh the shared context gw instead of a divergent local copy so AppHeader's
      // chip/batch guard stays in sync after a season start.
      invalidate();
      setStartSeasonStatus('success');
      if (updatedGw?.Leagues?.length > 0) {
        navigate(`/${gwId}/${updatedGw.Leagues[0].id}`);
      }
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

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* Shared header (Flow B) — replaces the page-local nav bar so the batch Simulate Today
          action and breadcrumb live in one place across the /:gwId subtree. */}
      <AppHeader backLink="/" backLabel="Game Worlds" />

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
