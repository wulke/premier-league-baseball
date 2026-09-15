import React, { useCallback, useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams, useNavigate, useRevalidator, useRouteLoaderData } from 'react-router';
import { getChampionDivisionId, getChampionTeamName } from '../champion';
import { TeamSeasonGame } from '../../api/models';
import { NotificationStream } from './notification-stream';
import { Badge, Button, Card, ErrorText, PageContainer, SectionLabel } from '../components/ui';
import { CalendarStrip, DayEntry, addDays } from '../components/calendar-strip';
import { ActionItemsPanel, ActionItem } from '../components/action-items-panel';

type StartSeasonStatus = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';
type LeagueSeasonSummary = {
  leagueId: number;
  leagueName: string;
  championName: string | null;
};

// @spec LIFE-001,SHB-001,SHB-002,SHB-003,ACTUI-001,ACTUI-005
const GameWorld = () => {
  const { gwId } = useParams();
  // @spec RLDRUI-001,RLDRUI-003
  const gw = useRouteLoaderData('gwId') as any;
  const { revalidate } = useRevalidator();
  const [startSeasonStatus, setStartSeasonStatus] = useState<StartSeasonStatus>('idle');
  const [startSeasonError, setStartSeasonError] = useState<string | null>(null);
  const [leagueSeasonSummary, setLeagueSeasonSummary] = useState<LeagueSeasonSummary[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<DayEntry[]>([]);
  const [seasonBounds, setSeasonBounds] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const navigate = useNavigate();

  useEffect(() => {
    if (!gwId || !gw?.config?.inProgress) {
      setLeagueSeasonSummary([]);
      return;
    }

    const leagues: any[] = gw.Leagues ?? [];
    if (leagues.length === 0) {
      setLeagueSeasonSummary([]);
      return;
    }

    let cancelled = false;

    Promise.all(
      leagues.map(async (leagueRow) => {
        const [leagueResponse, bracketResponse] = await Promise.all([
          fetch(Endpoints.GetLeague.replace(':leagueId', String(leagueRow.id)), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
          }).then((response) => (response.ok ? response.json() : {})),
          fetch(Endpoints.GetLeagueBracket.replace(':leagueId', String(leagueRow.id)), {
            method: 'GET',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
          }).then((response) => (response.ok ? response.json() : [])),
        ]);

        const championDivisionId = getChampionDivisionId(leagueResponse);
        const championDivision = Array.isArray(bracketResponse)
          ? bracketResponse.find((entry: any) => entry.divisionId === championDivisionId)
          : null;

        return {
          leagueId: leagueRow.id,
          leagueName: leagueRow.config?.name ?? `League ${leagueRow.id}`,
          championName: getChampionTeamName(leagueResponse, championDivision ? [championDivision] : []),
        };
      }),
    )
      .then((summary) => {
        if (!cancelled) setLeagueSeasonSummary(summary);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setLeagueSeasonSummary([]);
      });

    return () => {
      cancelled = true;
    };
  }, [gw, gwId]);

  // @spec CALWUI-002 — fetches and maps a window of the managed club's cross-competition
  // calendar; CalendarStrip's prev/next calls this again with a shifted window.
  const fetchCalendar = useCallback(async (from: string, to: string) => {
    if (!gwId || gw?.managedTeamId == null) return;
    try {
      const response = await fetch(
        `${Endpoints.GetTeamSchedule.replace(':teamId', String(gw.managedTeamId))}?gwId=${gwId}&from=${from}&to=${to}`,
        { method: 'GET', mode: 'cors', headers: { 'Content-Type': 'application/json' } },
      );
      const body = response.ok ? await response.json() : null;
      const games: TeamSeasonGame[] = Array.isArray(body?.games) ? body.games : [];
      setCalendarEntries(games.map((game) => ({
        kind: 'game' as const,
        id: `game-${game.gameId}`,
        date: (game.scheduledDate ?? '').slice(0, 10),
        game,
      })));
      setSeasonBounds({ start: body?.seasonStart ?? null, end: body?.seasonEnd ?? null });
    } catch (error) {
      console.error(error);
      setCalendarEntries([]);
      setSeasonBounds({ start: null, end: null });
    }
  }, [gwId, gw?.managedTeamId]);

  // @spec CALWUI-001,CALWUI-007 — centered ±3-day window anchored on currentDate; skipped
  // entirely (no fetch, no CalendarStrip) when managedTeamId or currentDate is unset.
  useEffect(() => {
    if (gw?.managedTeamId == null || gw?.currentDate == null) {
      setCalendarEntries([]);
      setSeasonBounds({ start: null, end: null });
      return;
    }
    fetchCalendar(addDays(gw.currentDate, -3), addDays(gw.currentDate, 3));
  }, [gw?.managedTeamId, gw?.currentDate, fetchCalendar]);

  // @spec SCL-016,SHB-003
  const startNewSeason = async () => {
    if (!gwId || leagues.length === 0) return;
    setStartSeasonStatus('submitting');
    setStartSeasonError(null);

    try {
      // Sequential, not Promise.all: the leagues share a single-writer SQLite
      // connection, so starting them concurrently causes SQLITE_BUSY.
      for (const league of leagues) {
        const response = await fetch(Endpoints.LeagueSeasonStart.replace(':leagueId', String(league.id)), {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw Error(`Failed to start season for League ${league.id} (${response.status})`);
        await response.json();
      }
      // @spec RLDRUI-003 — refresh the shared gw loader instead of a divergent local copy so
      // the rail's chip/batch guard stays in sync after a season start.
      revalidate();
      setStartSeasonStatus('success');
      navigate(`/${gwId}/${leagues[0].id}`);
    } catch (error) {
      console.error(error);
      setStartSeasonError('Could not start a new season. Try again.');
      setStartSeasonStatus('error');
    }
  };

  if (!gw) return <></>;

  const nextYear = gw.year + 1;
  const leagues: any[] = gw.Leagues ?? [];
  const seasonComplete = leagueSeasonSummary.length > 0 && leagueSeasonSummary.every((league) => league.championName);
  const seasonLabel = gw.config?.inProgress
    ? `Season ${gw.year} · ${seasonComplete ? 'Complete' : 'In Progress'}`
    : `Season ${nextYear} · Ready to Start`;

  return (
    <PageContainer>

      {/* Game World Identity */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
            {gw.config?.name ?? `Game World ${gwId}`}
          </h1>
          {/* @spec SHB-001,SHB-002 */}
          <Badge data-testid="season-header-badge">{seasonLabel}</Badge>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
          {leagues.length} league{leagues.length !== 1 ? 's' : ''}
          &nbsp;&nbsp;·&nbsp;&nbsp;
          Current year: {gw.year}
        </p>
        {!gw.config?.inProgress && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
            {/* @spec SHB-002,SHB-003 */}
            {startSeasonStatus === 'idle' && (
              <Button intent="primary" onClick={() => setStartSeasonStatus('confirming')} size="sm">
                Start Season {nextYear}
              </Button>
            )}

            {startSeasonStatus === 'confirming' && (
              <>
                <span style={{ fontSize: '0.9rem', color: '#555' }}>
                  Start Season {nextYear}? This will create division season entries and schedule all games.
                </span>
                <Button intent="primary" onClick={startNewSeason} size="sm">Confirm</Button>
                <Button intent="secondary" onClick={() => setStartSeasonStatus('idle')} size="sm">Cancel</Button>
              </>
            )}

            {startSeasonStatus === 'submitting' && (
              <span style={{ fontSize: '0.9rem', color: '#555' }}>Creating season schedule…</span>
            )}

            {startSeasonStatus === 'error' && (
              <>
                <ErrorText style={{ fontSize: '0.9rem' }}>{startSeasonError}</ErrorText>
                <Button intent="secondary" onClick={() => setStartSeasonStatus('confirming')} size="sm">Retry</Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* @spec NOTIFUI-007 */}
      <NotificationStream gwId={Number(gwId)} managedTeamId={gw.managedTeamId ?? null} />

      {/* @spec CALWUI-001,CALWUI-002,CALWUI-003,CALWUI-004,CALWUI-005,CALWUI-006,CALWUI-007 */}
      {gw.managedTeamId != null && gw.currentDate != null && (
        <section data-testid="calendar-section" style={{ marginBottom: '40px' }}>
          <SectionLabel style={{ marginBottom: '12px' }}>
            Calendar
          </SectionLabel>

          <CalendarStrip
            currentDate={gw.currentDate}
            seasonStart={seasonBounds.start}
            seasonEnd={seasonBounds.end}
            entries={calendarEntries}
            onWindowChange={fetchCalendar}
          />
        </section>
      )}

      {/* @spec ACTUI-001,ACTUI-005 — no real producer exists yet, so items is always empty. */}
      {gw.managedTeamId != null && (
        <ActionItemsPanel items={[] as ActionItem[]} />
      )}

      {/* Leagues Section */}
      <section>
        <SectionLabel style={{ marginBottom: '12px' }}>
          Leagues
        </SectionLabel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {leagues.map((league) => (
            <Card
              key={league.id}
              interactive
              onClick={() => navigate(`/${gwId}/${league.id}`)}
              style={{
                padding: '16px 20px',
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
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  );
};

export { GameWorld };
