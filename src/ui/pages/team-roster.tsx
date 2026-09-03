import React, { useEffect, useState } from 'react';
import { useParams, useRouteLoaderData } from 'react-router';
import { Endpoints } from '../../api/endpoints';
import { RosterPlayer } from '../../api/models';
import { RosterTable } from '../components/roster-table';
import { PageContainer } from '../components/ui';

// @spec ROSTUI-002,ROSTUI-003,ROSTUI-004,ROSTUI-008,ROSTUI-009,XFERUI-005
const TeamRoster = () => {
  const { gwId, teamId } = useParams();
  // @spec RLDRUI-001
  const gw = useRouteLoaderData('gwId') as any;
  const managedTeamId: number | null | undefined = gw?.managedTeamId;
  const isManagedTeam = managedTeamId != null && String(managedTeamId) === teamId;

  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    if (!teamId) return;
    let isMounted = true;

    fetch(Endpoints.GetTeamRoster.replace(':teamId', teamId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    }).then((response) => (response.ok ? response.json() : []))
      .then((data) => { if (isMounted) setPlayers(Array.isArray(data) ? data : []); })
      .catch(() => { if (isMounted) setPlayers([]); });

    return () => { isMounted = false; };
  }, [teamId, refetchToken]);

  // @spec XFERUI-005
  const postTransferAction = async (endpoint: string, playerId: number) => {
    if (!teamId) return;
    await fetch(endpoint.replace(':teamId', teamId), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    setRefetchToken((token) => token + 1);
  };

  return (
    <PageContainer style={{ maxWidth: '1200px', padding: '24px 24px 48px' }}>
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
