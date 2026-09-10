import React, { useState } from 'react';
import { useLoaderData, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer } from '../../api/models';
import { RosterTable } from '../components/roster-table';
import { ErrorText, PageContainer } from '../components/ui';

// @spec XFERUI-001,XFERUI-002,XFERUI-003,XFERUI-004,XFERUI-006
const Transfers = () => {
  const { gwId } = useParams();
  // @spec RLDRUI-001
  const gw = useRouteLoaderData('gwId') as any;
  const managedTeamId: number | null | undefined = gw?.managedTeamId;
  const hasManagedClub = managedTeamId != null;

  // @spec NAVLOAD-001,NAVLOAD-003,NAVLOAD-005
  const freeAgents = useLoaderData() as RosterPlayer[];
  const [signError, setSignError] = useState<number | null>(null);
  const { revalidate } = useRevalidator();

  // @spec XFERUI-003,XFERUI-004
  const signPlayer = async (playerId: number) => {
    if (!hasManagedClub) return;
    setSignError(null);
    const response = await fetch(Endpoints.SignPlayer.replace(':teamId', String(managedTeamId)), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    if (!response.ok) setSignError(playerId);
    // @spec NAVLOAD-006
    revalidate();
  };

  return (
    <PageContainer style={{ maxWidth: '1200px', padding: '24px 24px 48px' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: '1.35rem', fontWeight: 700 }}>Transfers</h1>
      {signError != null && (
        <ErrorText data-testid="sign-error" style={{ display: 'block' }}>
          That player is no longer available.
        </ErrorText>
      )}
      <RosterTable
        players={freeAgents}
        gwId={gwId}
        testIdPrefix="free-agent"
        actions={hasManagedClub ? [{ testId: 'sign-action', label: 'Sign', onClick: signPlayer }] : undefined}
      />
    </PageContainer>
  );
};

export { Transfers };
