import React, { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Endpoints } from '../../api/endpoints';
import { NewGameWorld, useDefaultGameWorld } from '../../api/models';
import { useNavigate } from 'react-router';

const Home = () => {
  const navigate = useNavigate();
  const [gameWorlds, setGameWorlds] = useState<any[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const defaultGameWorld = useDefaultGameWorld();

  const { register, handleSubmit } = useForm<NewGameWorld>({
    defaultValues: defaultGameWorld
  });

  useEffect(() => {
    fetch(Endpoints.GetGameWorlds, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then(setGameWorlds)
      .catch(console.error);
  }, []);

  const submit: SubmitHandler<NewGameWorld> = async (data) => {
    setIsCreating(true);
    const payload: NewGameWorld = {
      ...defaultGameWorld,
      ...data,
      name: data.name,
    };
    await fetch(Endpoints.NewGameWorld, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => r.json())
      .then((gw) => navigate(`/${gw.id}`))
      .catch(console.error)
      .finally(() => setIsCreating(false));
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* App Header */}
      <header style={{
        borderBottom: '2px solid #000',
        padding: '20px 0',
        marginBottom: '36px',
      }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700 }}>
          Premier League Baseball
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
          Sports simulation and season management
        </p>
      </header>

      {/* Game Worlds Section */}
      <section>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h2 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>
            Your Game Worlds
          </h2>
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                padding: '6px 14px',
                background: '#000',
                color: '#fff',
                border: '1px solid #000',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              + New Game World
            </button>
          )}
        </div>

        {/* Game World Cards */}
        {gameWorlds.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
            marginBottom: '28px',
          }}>
            {gameWorlds.map((gw) => (
              <div
                key={gw.id}
                onClick={() => navigate(`/${gw.id}`)}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {gw.config?.name ?? `Game World ${gw.id}`}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>
                  Year {gw.year}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                  {gw.config?.inProgress ? '● Season in progress' : '○ No active season'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showNewForm && (
            <div style={{
              border: '1px dashed #ccc',
              borderRadius: '6px',
              padding: '32px',
              textAlign: 'center',
              color: '#888',
              marginBottom: '28px',
            }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>No game worlds yet.</p>
              <button
                onClick={() => setShowNewForm(true)}
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
                Create your first game world
              </button>
            </div>
          )
        )}

        {/* New Game World Form */}
        {showNewForm && (
          <div style={{
            border: '1px solid #ccc',
            borderRadius: '6px',
            padding: '24px',
            maxWidth: '480px',
            marginBottom: '28px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>New Game World</h3>
              <button
                onClick={() => setShowNewForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit(submit)}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Name
                </label>
                <input
                  required
                  {...register('name')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Template summary */}
              <div style={{
                background: '#f8f8f8',
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                padding: '14px',
                marginBottom: '20px',
                fontSize: '0.82rem',
                color: '#555',
              }}>
                <div style={{ fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                  Template: Premier League
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', lineHeight: '1.7' }}>
                  <li>44 teams</li>
                  <li>Premier League — 2 divisions (PL + Championship)</li>
                  <li>League Cup — knockout format</li>
                  <li>Starting year: {new Date().getFullYear() - 1}</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
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
                <button
                  type="submit"
                  disabled={isCreating}
                  style={{
                    padding: '8px 18px',
                    border: '1px solid #000',
                    borderRadius: '4px',
                    background: '#000',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    opacity: isCreating ? 0.6 : 1,
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Game World →'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
};

export { Home };
