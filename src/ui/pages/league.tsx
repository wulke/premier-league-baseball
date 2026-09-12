import React, { useState } from 'react';
import { DivisionStandings, LeagueDivisionBracket, TeamStanding } from '../../api/models';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import { Collapsible } from 'radix-ui';
import { formatLeagueChampionBanner, getChampionBracket, getChampionTeamName } from '../champion';
import { Badge, Button, Card, PageContainer, SectionLabel, Table, Td, Th, Tr } from '../components/ui';
import { TeamCrest } from '../components/team-crest';
import { BracketView } from '../components/bracket-view';
import { TeamRosterGrid } from '../components/team-roster-grid';

const StandingsTable = ({
  standings,
  onTeamClick,
}: {
  standings: TeamStanding[];
  onTeamClick: (teamId: number) => void;
}) => (
  <Table>
    <thead>
      <tr style={{ borderBottom: '2px solid #000' }}>
        {['Pos', 'Team', 'P', 'W', 'D', 'L', 'RF', 'RA', 'RD', 'Pts'].map((h) => (
          <Th key={h} style={{ textAlign: h === 'Team' ? 'left' : 'center' }}>
            {h}
          </Th>
        ))}
      </tr>
    </thead>
    <tbody>
      {standings.map((row, i) => (
        <Tr key={row.teamId}>
          <Td style={{ color: '#888', fontSize: '0.8rem' }}>{i + 1}</Td>
          <Td align="left">
            <Button
              intent="ghost"
              aria-label={row.teamName}
              onClick={() => onTeamClick(row.teamId)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'underline',
                textDecorationColor: '#ccc',
                textUnderlineOffset: '3px',
              }}
            >
              {/* @spec BADGEUI-005,BADGEUI-006 */}
              <TeamCrest name={row.teamName} badge={row.teamBadge} size={22} testId={`standings-team-badge-${row.teamId}`} />
              {row.teamName}
            </Button>
          </Td>
          <Td>{row.played}</Td>
          <Td>{row.won}</Td>
          <Td>{row.drawn}</Td>
          <Td>{row.lost}</Td>
          <Td>{row.runsFor}</Td>
          <Td>{row.runsAgainst}</Td>
          <Td>{row.runDifference}</Td>
          <Td style={{ fontWeight: 700 }}>{row.points}</Td>
        </Tr>
      ))}
    </tbody>
  </Table>
);

// @spec MSUI-002
const getSeededFromGroupsLabel = (league: any, division: any): string | null => {
  const selection = division.config?.seedingSelection;
  if (selection?.kind !== 'TOP_N_PER_DIVISION') return null;

  const sourceStage = league.config?.stages?.find((stage: any) => stage.id === selection.fromStage);
  return `Seeded from completed ${sourceStage?.name ?? 'group stage'}`;
};

// @spec UI-005,UI-006,UI-007,UI-008,MSUI-001,MSUI-002
const Division = ({
  division,
  divisionStandings,
  divisionBracket,
  seededFromGroupsLabel,
  onTeamClick,
}: {
  division: any;
  divisionStandings?: DivisionStandings;
  divisionBracket?: LeagueDivisionBracket;
  seededFromGroupsLabel?: string | null;
  onTeamClick: (teamId: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasStandings = Boolean(divisionStandings && divisionStandings.standings.length > 0);
  const structure = divisionBracket?.structure ?? division.config?.format?.structure ?? 'ROUND_ROBIN';

  return (
    <Card
      data-testid={`division-card-${division.id}`}
      style={{ overflow: 'hidden', marginBottom: '12px' }}
    >
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
                  {divisionStandings?.standings.length} teams
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
            {structure === 'KNOCKOUT' ? (
              <>
                {seededFromGroupsLabel && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>
                    {seededFromGroupsLabel}
                  </p>
                )}
                <BracketView
                  rounds={divisionBracket?.rounds ?? []}
                  teams={division.Teams ?? []}
                  onTeamClick={onTeamClick}
                />
              </>
            ) : hasStandings ? (
              <StandingsTable standings={divisionStandings!.standings} onTeamClick={onTeamClick} />
            ) : (
              <>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>
                  No standings yet — season not started.
                </p>
                <TeamRosterGrid teams={division.Teams ?? []} onTeamClick={onTeamClick} />
              </>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
};

// @spec UI-001,UI-003,UI-004,UI-005,UI-006,UI-007,UI-008,MSUI-001,MSUI-002,MSUI-003
const League = () => {
  const { gwId, leagueId } = useParams();
  const navigate = useNavigate();
  // @spec NAVLOAD-001,NAVLOAD-004,NAVLOAD-005
  const { league, standings, brackets: divisionBrackets } = useLoaderData() as { league: any; standings: DivisionStandings[]; brackets: LeagueDivisionBracket[] };

  if (!league) return <></>;

  // @spec ROSTUI-001
  const openTeamHub = (teamId: number) => navigate(`/${gwId}/team/${teamId}`);
  const hasAnyStandings = standings.some((s) => s.standings.length > 0);
  const hasAnyBracketRounds = divisionBrackets.some((division) => division.rounds.length > 0);
  const championBanner = formatLeagueChampionBanner(
    league,
    getChampionTeamName(league, divisionBrackets),
  );
  const championDivision = getChampionBracket(league, divisionBrackets);

  return (
    <PageContainer>

      {/* League identity */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {league.config?.name ?? `League ${leagueId}`}
          </h1>
          {league.config?.type && (
            <Badge>
              {league.config.type}
            </Badge>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
          {championBanner ?? `${league.Divisions?.length ?? 0} division${league.Divisions?.length !== 1 ? 's' : ''}${hasAnyStandings || hasAnyBracketRounds ? ' · Season in progress' : ' · No active season'}`}
        </p>
      </div>

      {/* Divisions */}
      <section>
        <SectionLabel style={{ marginBottom: '14px' }}>
          {hasAnyStandings || hasAnyBracketRounds ? 'Standings' : 'Divisions'}
        </SectionLabel>

        {league.Divisions?.map((division: any) => (
          <Division
            key={division.id}
            division={division}
            divisionStandings={standings.find((entry) => entry.divisionId === division.id)}
            divisionBracket={divisionBrackets.find((entry) => entry.divisionId === division.id)}
            seededFromGroupsLabel={getSeededFromGroupsLabel(league, division)}
            onTeamClick={openTeamHub}
          />
        ))}
      </section>
    </PageContainer>
  );
};

export { League };
