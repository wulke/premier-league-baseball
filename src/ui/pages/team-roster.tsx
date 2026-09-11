import React from 'react';
import { useLoaderData, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer } from '../../api/models';
import { RosterTable } from '../components/roster-table';
import { PageContainer } from '../components/ui';

// @spec ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-008,ROSTUI-009,ROSTUI-010,XFERUI-005
const TeamRoster = () => {
  const { gwId, teamId } = useParams();
  // @spec RLDRUI-001
  const gw = useRouteLoaderData('gwId') as any;
  const managedTeamId: number | null | undefined = gw?.managedTeamId;
  const isManagedTeam = managedTeamId != null && String(managedTeamId) === teamId;

  // @spec NAVLOAD-001,NAVLOAD-003,NAVLOAD-005
  const players = useLoaderData() as RosterPlayer[];
  const { revalidate } = useRevalidator();

  // @spec XFERUI-005
  const postTransferAction = async (endpoint: string, playerId: number) => {
    if (!teamId) return;
    await fetch(endpoint.replace(':teamId', teamId), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    // @spec NAVLOAD-006
    revalidate();
  };

  return (
    <PageContainer data-testid="team-roster-page" style={{ maxWidth: '960px', padding: '24px 24px 48px' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: '1.35rem', fontWeight: 700 }}>Roster</h1>
      <RosterTable
        players={players}
        gwId={gwId}
        testIdPrefix="roster"
        actions={isManagedTeam ? [
          { testId: 'release-action', label: 'Release', onClick: (playerId) => postTransferAction(Endpoints.ReleasePlayer, playerId) },
          { testId: 'renew-action', label: 'Renew', onClick: (playerId) => postTransferAction(Endpoints.RenewPlayer, playerId) },
        ] : undefined}
      />
    </PageContainer>
  );
};

export { TeamRoster };
