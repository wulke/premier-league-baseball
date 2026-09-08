import React, { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Endpoints } from '../../api/endpoints';
import { NewGameWorld, GameWorldType, DefaultWorlds, useDefaultGameWorld } from '../../api/models';
import { useNavigate } from 'react-router';
import { ConfirmDeleteModal } from '../components/confirm-delete-modal';
import { Button, Card, ErrorBanner, FormField, IconButton, Input, PageContainer, Select, SectionLabel } from '../components/ui';

type DeleteStatus = 'confirming' | 'submitting' | 'error';
type DeleteTarget = { id: number; name: string };

// @spec GWDUI-001,GWDUI-002,GWDUI-003,GWDUI-004,GWDUI-005,GWDUI-006,GWDUI-007
const Home = () => {
  const navigate = useNavigate();
  const [gameWorlds, setGameWorlds] = useState<any[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hoveredGwId, setHoveredGwId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('confirming');
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const defaultGameWorld = useDefaultGameWorld();
  const [selectedType, setSelectedType] = useState<GameWorldType>(GameWorldType.PremierLeague);
  // @spec GWT-004 — the selected template drives the bundle (teams + leagues);
  // the summary derives from this single source so it never drifts from the payload.
  const selectedBundle = useDefaultGameWorld(selectedType);

  const { register, handleSubmit, setValue } = useForm<NewGameWorld>({
    defaultValues: defaultGameWorld
  });

  // @spec GWT-004 — selecting a template pre-fills the Name with the template's
  // display name (the GameWorldType value) and recomputes the bundle.
  const onSelectTemplate = (type: GameWorldType) => {
    setSelectedType(type);
    setValue('name', type);
  };

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
    setCreateError(undefined);
    // @spec GWT-004 — payload carries the selected template's bundle (teams +
    // leagues); only the Name field is user-editable, so it is taken from the form.
    const payload: NewGameWorld = {
      ...selectedBundle,
      name: data.name,
    };
    try {
      const response = await fetch(Endpoints.NewGameWorld, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const gw = await response.json().catch(() => ({}));
      if (!response.ok || !gw?.id) {
        throw new Error(typeof gw?.error === 'string' ? gw.error : 'Failed to create game world');
      }
      navigate(`/${gw.id}`);
    } catch (error) {
      console.error(error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create game world');
    } finally {
      setIsCreating(false);
    }
  };

  const openDeleteModal = (gw: any, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDeleteTarget({
      id: gw.id,
      name: gw.config?.name ?? `Game World ${gw.id}`,
    });
    setDeleteStatus('confirming');
    setDeleteError(undefined);
  };

  const closeDeleteModal = () => {
    if (deleteStatus === 'submitting') return;
    setDeleteTarget(null);
    setDeleteStatus('confirming');
    setDeleteError(undefined);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteStatus === 'submitting') return;

    const targetId = deleteTarget.id;

    setDeleteStatus('submitting');
    setDeleteError(undefined);

    try {
      const response = await fetch(Endpoints.DeleteGameWorld.replace(':gwId', String(targetId)), {
        method: 'DELETE',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to delete game world');
      }

      setGameWorlds((prev) => prev.filter((gw) => gw.id !== targetId));
      setHoveredGwId((current) => (current === targetId ? null : current));
      setDeleteTarget(null);
      setDeleteStatus('confirming');
      setDeleteError(undefined);
    } catch (error) {
      console.error(error);
      setDeleteStatus('error');
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete game world');
    }
  };

  return (
    <PageContainer>

      {/* Game Worlds Section */}
      <section>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <SectionLabel>
            Your Game Worlds
          </SectionLabel>
          {!showNewForm && (
            <Button intent="primary" onClick={() => setShowNewForm(true)}>
              + New Game World
            </Button>
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
              <Card
                key={gw.id}
                interactive
                onClick={() => navigate(`/${gw.id}`)}
                onMouseEnter={() => setHoveredGwId(gw.id)}
                onMouseLeave={() => setHoveredGwId((current) => (current === gw.id ? null : current))}
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                }}
              >
                {hoveredGwId === gw.id && (
                  <IconButton
                    type="button"
                    tone="danger"
                    onClick={(event) => openDeleteModal(gw, event)}
                    style={{ position: 'absolute', top: '10px', right: '10px' }}
                  >
                    [x]
                  </IconButton>
                )}
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {gw.config?.name ?? `Game World ${gw.id}`}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>
                  Year {gw.year}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>
                  {gw.config?.inProgress ? '● Season in progress' : '○ No active season'}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          !showNewForm && (
            <Card dashed style={{ padding: '32px', marginBottom: '28px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>No game worlds yet.</p>
              <Button intent="primary" onClick={() => setShowNewForm(true)}>
                Create your first game world
              </Button>
            </Card>
          )
        )}

        {/* New Game World Form */}
        {showNewForm && (
          <Card style={{ padding: '24px', maxWidth: '480px', marginBottom: '28px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>New Game World</h3>
              <IconButton onClick={() => setShowNewForm(false)} style={{ fontSize: '1.2rem', color: '#666' }}>
                ×
              </IconButton>
            </div>

            <form onSubmit={handleSubmit(submit)}>
              <FormField label="Name">
                <Input required {...register('name')} />
              </FormField>

              {/* @spec GWT-004 — template selector + dynamic summary */}
              <FormField label="Template">
                <Select
                  aria-label="Template"
                  value={selectedType}
                  onChange={(e) => onSelectTemplate(e.target.value as GameWorldType)}
                >
                  {Object.keys(DefaultWorlds).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </FormField>

              {/* Template summary — derived from the selected bundle */}
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
                  Template: {selectedType}
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', lineHeight: '1.7' }}>
                  {/* @spec TLO-002 — pools are owned per-League; external-source Leagues
                      (e.g. the cup) add no teams of their own */}
                  <li>{selectedBundle.leagues.reduce((count, league) => count + (league.teams?.length ?? 0), 0)} teams</li>
                  {selectedBundle.leagues.map((league) => (
                    <li key={league.name}>{league.name} — {league.stages
                      .flatMap((stage) => stage.divisions).length} divisions</li>
                  ))}
                  <li>Starting year: {selectedBundle.year}</li>
                </ul>
              </div>

              {createError && (
                <ErrorBanner style={{ marginBottom: '16px' }}>
                  {createError}
                </ErrorBanner>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" intent="secondary" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" intent="primary" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Game World →'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </section>

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete "${deleteTarget.name}"?`}
          message="This will permanently delete this game world and all of its data. This cannot be undone."
          status={deleteStatus}
          errorMessage={deleteError}
          onConfirm={confirmDelete}
          onCancel={closeDeleteModal}
        />
      )}
    </PageContainer>
  );
};

export { Home };
