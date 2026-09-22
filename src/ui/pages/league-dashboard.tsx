import React from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router';
import { BracketRound, DivisionStandings, LeagueDivisionBracket, TeamSeasonGame, TeamStanding } from '../../api/models';
import { formatLeagueChampionBanner, getChampionTeamName } from '../champion';
import { Badge, Button, Card, PageContainer, SectionLabel } from '../components/ui';
import { TeamCrest } from '../components/team-crest';
import { TeamRosterGrid } from '../components/team-roster-grid';
import { StandingsTable } from './league';

type LeagueDashboardData = {
  league: any;
  today: TeamSeasonGame[];
  standings: DivisionStandings[];
  brackets: LeagueDivisionBracket[];
};

// @spec LDASH-004 — top-5 slice for one round-robin division's condensed widget.
const condensedStandings = (divisionStandings: DivisionStandings): TeamStanding[] =>
  divisionStandings.standings.slice(0, 5);

// @spec LDASH-006 — the round to preview for one knockout division's teaser: the first round
// that is not yet COMPLETE (so an IN_PROGRESS round with partial results still previews).
const firstIncompleteRound = (rounds: BracketRound[]): { round: BracketRound; index: number } | null => {
  const index = rounds.findIndex((round) => round.status !== 'COMPLETE');
  return index === -1 ? null : { round: rounds[index], index };
};

// @spec LDASH-007 — division-level champion name, independent of the league-wide champion
// (champion.ts's getChampionTeamName only resolves the league's designated top-tier division).
const divisionChampionName = (division: any, bracket: LeagueDivisionBracket): string | null => {
  const championTeamId = bracket.champion?.teamId;
  if (championTeamId == null) return null;
  return division.Teams?.find((team: any) => team.id === championTeamId)?.config?.name
    ?? `Team ${championTeamId}`;
};

// @spec LDASH-003 — one team name per matchup tile; not part of LDASH-009's click surface, so
// plain text rather than a navigation target.
const TeamName = ({ name }: { name: string | null }) => <>{name ?? 'TBD'}</>;

// @spec LDASH-009,BADGEUI-010 — clickable team identity, wired into condensed rows/teaser ties/roster
// grid/champion line.
const TeamButton = ({ teamId, name, badge, onClick }: { teamId: number | null; name: string | null; badge?: string | null; onClick: (teamId: number) => void }) => {
  if (teamId == null) return <TeamName name={name} />;
  return (
    <Button
      intent="ghost"
      aria-label={name ?? `Team ${teamId}`}
      onClick={() => onClick(teamId)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, textDecoration: 'underline', textDecorationColor: '#ccc', textUnderlineOffset: '3px' }}
    >
      {/* @spec BADGEUI-010 */}
      <TeamCrest name={name ?? `Team ${teamId}`} badge={badge} size={18} testId={`dashboard-team-badge-${teamId}`} />
      {name ?? `Team ${teamId}`}
    </Button>
  );
};

// @spec LDASH-003 — one horizontal matchup-banner tile per Today game, in backend chronological
// order (today is already sorted ascending by scheduledDate).
const TodayTile = ({ game }: { game: TeamSeasonGame }) => {
  const completed = game.status === 'COMPLETED' && game.homeTeamResult != null && game.awayTeamResult != null;
  const homeWinner = completed && game.homeTeamResult! > game.awayTeamResult!;
  const awayWinner = completed && game.awayTeamResult! > game.homeTeamResult!;
  const summary = completed
    ? `${game.homeTeamName} ${game.homeTeamResult}–${game.awayTeamResult} ${game.awayTeamName}`
    : `${game.homeTeamName} vs ${game.awayTeamName}`;

  const lane = (side: 'home' | 'away', name: string, badge: string | null | undefined, result: number | null, isWinner: boolean) => (
    <div
      data-testid={`today-lane-${game.gameId}-${side}`}
      data-winner={isWinner ? 'true' : 'false'}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: isWinner ? 700 : 500, padding: '2px 0' }}
    >
      <TeamCrest name={name} badge={badge} size={16} />
      <span>{name}</span>
      {completed && <span style={{ marginLeft: 'auto' }}>{result}</span>}
      {isWinner && <span aria-label="Winner" data-testid={`today-winner-marker-${game.gameId}-${side}`} style={{ marginLeft: '4px' }}>▲</span>}
    </div>
  );

  return (
    <div
      key={game.gameId}
      data-testid={`today-tile-${game.gameId}`}
      style={{ padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', minWidth: '220px' }}
    >
      <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '4px' }}>
        {game.scheduledDate ?? 'TBD'} · {game.divisionName}{game.roundLabel ? ` · ${game.roundLabel}` : ''} · {game.status}
      </div>
      <div data-testid={`today-matchup-${game.gameId}`} style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
        {summary}
      </div>
      {lane('home', game.homeTeamName, game.homeTeamBadge, game.homeTeamResult, homeWinner)}
      {lane('away', game.awayTeamName, game.awayTeamBadge, game.awayTeamResult, awayWinner)}
    </div>
  );
};

// @spec LDASH-006,LDASH-010 — non-interactive round preview: team names only, no round-to-round
// connectors, no click-to-expand.
const BracketTeaser = ({ division, round, onTeamClick }: { division: any; round: BracketRound; onTeamClick: (teamId: number) => void }) => (
  <div data-testid={`bracket-teaser-${division.id}`}>
    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem' }}>{round.label}</p>
    {round.ties.map((tie, i) => (
      <div
        key={i}
        data-testid={`bracket-teaser-tie-${division.id}-${i}`}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '4px 0' }}
      >
        <TeamButton teamId={tie.teamA.teamId} name={tie.teamA.teamName} badge={tie.teamA.teamBadge} onClick={onTeamClick} />
        <span style={{ color: '#aaa' }}>vs</span>
        <TeamButton teamId={tie.teamB?.teamId ?? null} name={tie.teamB?.teamName ?? 'Bye'} badge={tie.teamB?.teamBadge} onClick={onTeamClick} />
      </div>
    ))}
  </div>
);

// @spec LDASH-004,LDASH-006,LDASH-007,LDASH-008 — one section per division: condensed
// standings, bracket teaser, champion line, or the roster-grid pre-season fallback.
const DashboardDivision = ({
  division,
  divisionStandings,
  divisionBracket,
  onTeamClick,
}: {
  division: any;
  divisionStandings?: DivisionStandings;
  divisionBracket?: LeagueDivisionBracket;
  onTeamClick: (teamId: number) => void;
}) => {
  const structure = divisionBracket?.structure ?? division.config?.format?.structure ?? 'ROUND_ROBIN';

  return (
    <Card data-testid={`division-section-${division.id}`} style={{ padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '10px' }}>
        {division.config?.name ?? `Division ${division.id}`}
      </div>

      {structure === 'ROUND_ROBIN' ? (
        divisionStandings && divisionStandings.standings.length > 0 ? (
          <div data-testid={`condensed-standings-${division.id}`}>
            <StandingsTable standings={condensedStandings(divisionStandings)} onTeamClick={onTeamClick} />
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>No standings yet — season not started.</p>
            <TeamRosterGrid teams={division.Teams ?? []} onTeamClick={onTeamClick} />
          </>
        )
      ) : (divisionBracket?.rounds.length ?? 0) === 0 ? (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#888' }}>No bracket yet — season not started.</p>
          <TeamRosterGrid teams={division.Teams ?? []} onTeamClick={onTeamClick} />
        </>
      ) : (() => {
        const incomplete = firstIncompleteRound(divisionBracket!.rounds);
        if (incomplete === null) {
          const championName = divisionChampionName(division, divisionBracket!);
          return (
            <p data-testid={`division-champion-${division.id}`} style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
              Champion: {championName == null ? null : (
                <TeamButton teamId={divisionBracket!.champion!.teamId} name={championName} badge={division.Teams?.find((team: any) => team.id === divisionBracket!.champion!.teamId)?.config?.badge} onClick={onTeamClick} />
              )}
            </p>
          );
        }
        return <BracketTeaser division={division} round={incomplete.round} onTeamClick={onTeamClick} />;
      })()}
    </Card>
  );
};

// @spec LDASH-001,LDASH-002,LDASH-003,LDASH-005,LDASH-009
const LeagueDashboard = () => {
  const { gwId, leagueId } = useParams();
  const navigate = useNavigate();
  const { league, today, standings, brackets } = useLoaderData() as LeagueDashboardData;

  if (!league) return <></>;

  // @spec LDASH-009
  const openTeamHub = (teamId: number) => navigate(`/${gwId}/team/${teamId}`);
  const openStandings = () => navigate(`/${gwId}/${leagueId}/standings`);

  const hasAnyStandings = standings.some((s) => s.standings.length > 0);
  const hasAnyBracketRounds = brackets.some((division) => division.rounds.length > 0);
  const championBanner = formatLeagueChampionBanner(league, getChampionTeamName(league, brackets));

  return (
    <PageContainer data-testid="league-dashboard-page">

      {/* @spec LDASH-002 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {league.config?.name ?? `League ${leagueId}`}
          </h1>
          {league.config?.type && <Badge>{league.config.type}</Badge>}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>
          {championBanner ?? `${league.Divisions?.length ?? 0} division${league.Divisions?.length !== 1 ? 's' : ''}${hasAnyStandings || hasAnyBracketRounds ? ' · Season in progress' : ' · No active season'}`}
        </p>
      </div>

      {/* @spec LDASH-003 */}
      {today.length > 0 && (
        <section data-testid="today-section" style={{ marginBottom: '32px' }}>
          <SectionLabel style={{ marginBottom: '10px' }}>Today</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {today.map((game) => <TodayTile key={game.gameId} game={game} />)}
          </div>
        </section>
      )}

      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <SectionLabel>Divisions</SectionLabel>
          {/* @spec LDASH-005 */}
          <Button intent="secondary" size="sm" onClick={openStandings}>View full standings</Button>
        </div>

        {league.Divisions?.map((division: any) => (
          <DashboardDivision
            key={division.id}
            division={division}
            divisionStandings={standings.find((entry) => entry.divisionId === division.id)}
            divisionBracket={brackets.find((entry) => entry.divisionId === division.id)}
            onTeamClick={openTeamHub}
          />
        ))}
      </section>
    </PageContainer>
  );
};

export { LeagueDashboard };
