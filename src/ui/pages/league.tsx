import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { DivisionStandings, TeamStanding } from '../../api/models';
import { useNavigate, useParams } from 'react-router';
import { Collapsible } from 'radix-ui';
import { AppHeader } from '../components/app-header';

const StandingsTable = ({
  standings,
  onTeamClick,
}: {
  standings: TeamStanding[];
  onTeamClick: (teamId: number) => void;
}) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
    <thead>
      <tr style={{ borderBottom: '2px solid #000' }}>
        {['Pos', 'Team', 'P', 'W', 'D', 'L', 'RF', 'RA', 'RD', 'Pts'].map((h) => (
          <th
            key={h}
            style={{
              textAlign: h === 'Team' ? 'left' : 'center',
              padding: '6px 8px',
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#555',
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {standings.map((row, i) => (
        <tr key={row.teamId} style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ textAlign: 'center', padding: '8px', color: '#888', fontSize: '0.8rem' }}>{i + 1}</td>
          <td style={{ padding: '8px' }}>
            <button
              onClick={() => onTeamClick(row.teamId)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'underline',
                textDecorationColor: '#ccc',
                textUnderlineOffset: '3px',
              }}
            >
              {row.teamName}
            </button>
          </td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.played}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.won}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.drawn}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.lost}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runsFor}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runsAgainst}</td>
          <td style={{ textAlign: 'center', padding: '8px' }}>{row.runDifference}</td>
          <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700 }}>{row.points}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const TeamRoster = ({
  teams,
  onTeamClick,
}: {
  teams: any[];
  onTeamClick: (teamId: number) => void;
}) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', padding: '4px 0' }}>
    {teams.map((team) => (
      <button
        key={team.id}
        onClick={() => onTeamClick(team.id)}
        style={{
          background: 'none',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}
      >
        {team.config?.name ?? `Team ${team.id}`}
        <span style={{ float: 'right', color: '#aaa', fontSize: '0.75rem' }}>→</span>
      </button>
    ))}
  </div>
);

const Division = ({
  division,
  divisionStandings,
  onTeamClick,
}: {
  division: any;
  divisionStandings?: DivisionStandings;
  onTeamClick: (teamId: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasStandings = divisionStandings && divisionStandings.standings.length > 0;

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger asChild>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              cursor: 'pointer',
              background: '#fafafa',
              borderBottom: isOpen ? '1px solid #e0e0e0' : 'none',
              userSelect: 'none',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{division.config?.name ?? `Division ${division.id}`}</span>
              {hasStandings && (
                <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#888' }}>
                  {divisionStandings.standings.length} teams
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
              {isOpen ? '▲ Hide' : '▼ Show'}
            </span>
          </div>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div style={{ padding: '12px 16px' }}>
            {hasStandings ? (
              <StandingsTable standings={divisionStandings.standings} onTeamClick={onTeamClick} />
            ) : (
              <>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>
                  No standings yet — season not started.
                </p>
                <TeamRoster teams={division.Teams ?? []} onTeamClick={onTeamClick} />
              </>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
};

const League = () => {
  const { gwId, leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState<any>(null);
  const [standings, setStandings] = useState<DivisionStandings[]>([]);

  useEffect(() => {
    if (!leagueId) return;

    let isMounted = true;

    fetch(Endpoints.GetLeague.replace(':leagueId', leagueId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then((leagueData) => { if (isMounted) setLeague(leagueData); })
      .catch(console.error);

    fetch(Endpoints.GetLeagueStandings.replace(':leagueId', leagueId), {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' }
    }).then((r) => r.json())
      .then((standingsData) => { if (isMounted) setStandings(standingsData ?? []); })
      .catch((error) => { console.error(error); if (isMounted) setStandings([]); });

    return () => { isMounted = false; };
  }, [leagueId]);

  if (!league) return <></>;

  // @spec UI-004
  const openTeamCalendar = (teamId: number) => navigate(`/${gwId}/team/${teamId}/calendar`);
  const hasAnyStandings = standings.some((s) => s.standings.length > 0);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px 48px' }}>

      {/* Shared header (Flow B) */}
      <AppHeader backLink={`/${gwId}`} backLabel="Game World" />

      {/* League identity */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {league.config?.name ?? `League ${leagueId}`}
          </h1>
          {league.config?.type && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#666',
              border: '1px solid #ccc',
              borderRadius: '20px',
              padding: '2px 10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {league.config.type}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
          {league.Divisions?.length ?? 0} division{league.Divisions?.length !== 1 ? 's' : ''}
          {hasAnyStandings ? ' · Season in progress' : ' · No active season'}
        </p>
      </div>

      {/* Divisions */}
      <section>
        <h2 style={{
          margin: '0 0 14px',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#888',
          fontWeight: 600,
        }}>
          {hasAnyStandings ? 'Standings' : 'Divisions'}
        </h2>

        {league.Divisions?.map((division: any) => (
          <Division
            key={division.id}
            division={division}
            divisionStandings={standings.find((s) => s.divisionId === division.id)}
            onTeamClick={openTeamCalendar}
          />
        ))}
      </section>
    </div>
  );
};

export { League };
