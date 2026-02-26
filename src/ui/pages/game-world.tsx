import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams, useNavigate, Link } from 'react-router';

type StartSeasonStatus = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';

const GameWorld = () => {
  const { gwId } = useParams();
  const [gw, setGw] = useState<any>(null);
  const [startSeasonStatus, setStartSeasonStatus] = useState<StartSeasonStatus>('idle');
  const [startSeasonError, setStartSeasonError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(Endpoints.GetGameWorld.replace(':gwId', gwId!), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then(setGw)
      .catch(console.error);
  }, [gwId]);

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
      setGw(updatedGw);
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

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* Nav bar */}
      <header style={{
        borderBottom: '2px solid #000',
        padding: '14px 0',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link
          to="/"
          style={{ textDecoration: 'none', color: '#555', fontSize: '0.85rem', fontWeight: 500 }}
        >
          ← Game Worlds
        </Link>
        <span style={{ fontSize: '0.8rem', color: '#999' }}>Premier League Baseball</span>
      </header>

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
                Season {gw.year} — In Progress
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                Navigate to a league below to view standings and simulate games.
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
