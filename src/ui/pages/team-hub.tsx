import React, { useState } from 'react';
import { NavLink, Outlet, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { Button } from '../components/ui';

// @spec ROSTUI-006,ROSTUI-007,ROSTUI-010,LINEUI-001,MCLUI-001,MCLUI-002,MCLUI-003
const TeamHub = () => {
  const { gwId, teamId } = useParams();
  // @spec RLDRUI-001,RLDRUI-003
  const gw = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
  const [submitting, setSubmitting] = useState(false);
  const basePath = `/${gwId}/team/${teamId}`;

  // MCLUI-001/MCLUI-002 — the hub is the sole claim affordance. `managedTeamId` arrives via
  // the GET /api/gameWorld/:gwId payload (MCLB-002); it is `undefined` while the context loads,
  // so an unclaimed (or still-loading) hub shows "Claim as My Club".
  const managedTeamId = gw?.managedTeamId;
  const isManaged = managedTeamId != null && managedTeamId === Number(teamId);

  // MCLUI-003 — POST the setter, then re-read managedTeamId from the context re-GET (no reload).
  // NB: the fetch response status is intentionally unchecked (LLD `docs/llds/manager/managed-club-ui.md`
  // edge case u2). A 4xx/422 leaves the server pointer unchanged, so invalidate()'s re-GET reverts
  // the UI to the prior state — no bespoke error UI in MVP (frictionless posture, MCLUI-006). Don't
  // "fix" this by gating invalidate() on response.ok.
  const submitManagedClub = async (nextTeamId: number | null) => {
    if (!gwId || submitting) return;
    setSubmitting(true);
    try {
      await fetch(Endpoints.SetManagedClub.replace(':gwId', gwId), {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: nextTeamId }),
      });
      revalidate();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <nav
        data-testid="team-hub-tabs"
        aria-label="Team sections"
        style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 24px 0', display: 'flex', gap: '18px', borderBottom: '1px solid #e5e5e5' }}
      >
        {(['calendar', 'roster', 'lineup'] as const).map((tab) => (
          <NavLink
            key={tab}
            to={`${basePath}/${tab}`}
            style={({ isActive }) => ({
              color: '#222',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0 0 10px',
              borderBottom: `2px solid ${isActive ? '#222' : 'transparent'}`,
            })}
          >
            {tab === 'calendar' ? 'Calendar' : tab === 'roster' ? 'Roster' : 'Lineup'}
          </NavLink>
        ))}
        {gwId && teamId && (
          <Button
            intent="secondary"
            data-testid={isManaged ? 'resign-managed-club' : 'claim-managed-club'}
            type="button"
            onClick={() => submitManagedClub(isManaged ? null : Number(teamId))}
            disabled={submitting}
            style={{
              marginLeft: 'auto',
              alignSelf: 'center',
              marginBottom: '10px',
              padding: '5px 12px',
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: isManaged ? '#666' : '#222',
            }}
          >
            {isManaged ? 'Stop managing' : 'Claim as My Club'}
          </Button>
        )}
      </nav>
      <Outlet />
    </>
  );
};

export { TeamHub };
