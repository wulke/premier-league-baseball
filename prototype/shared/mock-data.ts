// Mock standings — identical across all four options so the comparison is
// purely about styling approach. Shape mirrors src/api/models.ts (TeamStanding).
import { teams, clubTeamId } from "./tokens";

export type TeamStanding = {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  runsFor: number;
  runsAgainst: number;
  runDifference: number;
  points: number;
  // prototype-only extra: form (W/D/L last 5) to power the opt-in density strip
  form: ("W" | "D" | "L")[];
};

export type DivisionStandings = {
  divisionId: number;
  divisionName: string;
  standings: TeamStanding[];
};

const row = (
  teamId: number,
  g: [number, number, number, number], // [played, won, drawn, lost]
  rf: number,
  ra: number,
  form: ("W" | "D" | "L")[]
): TeamStanding => {
  const [played, won, drawn, lost] = g;
  const name = teams.find((t) => t.teamId === teamId)!.name;
  return {
    teamId,
    teamName: name,
    played,
    won,
    drawn,
    lost,
    runsFor: rf,
    runsAgainst: ra,
    runDifference: rf - ra,
    points: won * 3 + drawn,
    form,
  };
};

export const divisions: DivisionStandings[] = [
  {
    divisionId: 1,
    divisionName: "Atlantic",
    standings: [
      row(2, [18, 12, 1, 5], 124, 88, ["W", "W", "L", "W", "W"]),
      row(1, [18, 11, 2, 5], 119, 91, ["W", "D", "W", "W", "L"]),
      row(3, [18, 9, 3, 6], 101, 99, ["L", "W", "D", "W", "L"]),
      row(4, [18, 8, 2, 8], 110, 112, ["L", "W", "L", "W", "D"]),
      row(5, [18, 5, 1, 12], 84, 131, ["L", "L", "W", "L", "L"]),
    ],
  },
  {
    divisionId: 2,
    divisionName: "Coastal",
    standings: [
      row(7, [18, 13, 0, 5], 142, 96, ["W", "W", "W", "L", "W"]),
      row(6, [18, 10, 2, 6], 121, 102, ["W", "D", "L", "W", "W"]),
      row(8, [18, 9, 1, 8], 108, 109, ["L", "W", "W", "L", "W"]),
      row(10, [18, 7, 3, 8], 99, 111, ["D", "L", "W", "D", "L"]),
      row(9, [18, 4, 2, 12], 79, 128, ["L", "L", "L", "W", "L"]),
    ],
  },
];

export const league = {
  name: "Premier Baseball League",
  type: "Round-Robin",
  divisionCount: 2,
};

export { clubTeamId };
