import { LeagueDivisionBracket } from '../api/models';

type TeamRecord = {
  id: number;
  config?: {
    name?: string;
  };
};

type DivisionRecord = {
  id: number;
  config?: {
    isTopTier?: boolean;
  };
  Teams?: TeamRecord[];
};

type LeagueRecord = {
  config?: {
    name?: string;
    type?: string;
  };
  Divisions?: DivisionRecord[];
};

const getChampionDivisionId = (league: LeagueRecord): number | null => {
  if (!league.Divisions?.length) return null;
  if (league.config?.type === 'League Cup') return league.Divisions[0]?.id ?? null;

  return league.Divisions.find((division) => division.config?.isTopTier === true)?.id
    ?? league.Divisions[0]?.id
    ?? null;
};

const getChampionBracket = (
  league: LeagueRecord,
  divisionBrackets: LeagueDivisionBracket[],
): LeagueDivisionBracket | null => {
  const championDivisionId = getChampionDivisionId(league);
  if (championDivisionId == null) return null;

  return divisionBrackets.find((entry) => entry.divisionId === championDivisionId) ?? null;
};

const getChampionTeamName = (
  league: LeagueRecord,
  divisionBrackets: LeagueDivisionBracket[],
): string | null => {
  const championTeamId = getChampionBracket(league, divisionBrackets)?.champion?.teamId;
  if (championTeamId == null) return null;

  for (const division of league.Divisions ?? []) {
    const team = division.Teams?.find((entry) => entry.id === championTeamId);
    if (team) return team.config?.name ?? `Team ${championTeamId}`;
  }

  return null;
};

const formatLeagueChampionBanner = (league: LeagueRecord, championTeamName: string | null): string | null => {
  if (!championTeamName) return null;

  switch (league.config?.type) {
    case 'League Cup':
      return `🏆 Cup Champion: ${championTeamName} · Final`;
    case 'League':
    default:
      return `🏆 ${league.config?.name ?? 'League'} Champion: ${championTeamName} · Table decided`;
  }
};

export {
  formatLeagueChampionBanner,
  getChampionBracket,
  getChampionDivisionId,
  getChampionTeamName,
};
