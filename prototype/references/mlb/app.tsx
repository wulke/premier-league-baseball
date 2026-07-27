import * as React from "react";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId, type TeamStanding } from "../../shared/mock-data";
import { teams, type TeamIdentity } from "../../shared/tokens";

// MLB app dark: near-black, broadcast-dense, condensed numerals, team color as
// a restrained 3px row accent. All divisions open, strong rules between them.
// Baseball-native "GB" column computed from W/L. Switch-club tints the your-club row.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;

// baseball games-behind: ((leader_W − team_W) + (team_L − leader_L)) / 2
const gb = (rows: TeamStanding[]) => {
  const leader = rows[0];
  return (row: TeamStanding) =>
    ((leader.won - row.won) + (row.lost - leader.lost)) / 2;
};

const useAccent = (clubId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(clubId).primary);
  }, [clubId]);

const HEAD = ["#", "TEAM", "P", "W", "D", "L", "RF", "RA", "RD", "GB", "PTS"];

const Division = ({
  name, rows, clubId,
}: { name: string; rows: TeamStanding[]; clubId: number }) => {
  const calcGb = gb(rows);
  return (
    <section className="mb-7">
      <div className="flex items-baseline gap-3 border-b-[3px] border-line-hard pb-1.5 mb-0">
        <h2 className="text-[17px] font-bold uppercase tracking-[0.08em] text-ink-hi">{name}</h2>
        <span className="text-[11px] uppercase tracking-wider text-ink-lo">{rows.length} teams</span>
      </div>
      <table className="w-full border-collapse text-[15px] font-condensed tabular-nums">
        <thead>
          <tr className="border-b border-line-soft text-ink-lo">
            {HEAD.map((h, i) => (
              <th key={i} className={`py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider ${i === 1 ? "text-left" : "text-center"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = identity(row.teamId);
            const isClub = row.teamId === clubId;
            const g = calcGb(row);
            return (
              <tr
                key={row.teamId}
                className="group border-b border-line-soft/60 transition-colors hover:bg-field-hover"
                style={{ borderLeft: `3px solid ${id.primary}`, paddingLeft: 0 }}
              >
                <td className={`py-2 px-2 text-center font-bold ${isClub ? "text-club" : "text-ink-lo"}`}>{i + 1}</td>
                <td className="py-2 px-2 text-left">
                  <span className={`font-bold uppercase tracking-wide ${isClub ? "text-ink-hi" : "text-ink-md"}`}>
                    {row.teamName}
                  </span>
                  {isClub && <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-club">▲ Your Club</span>}
                </td>
                <td className="py-2 px-2 text-center text-ink-md">{row.played}</td>
                <td className="py-2 px-2 text-center font-bold text-ink-hi">{row.won}</td>
                <td className="py-2 px-2 text-center text-ink-lo">{row.drawn}</td>
                <td className="py-2 px-2 text-center text-ink-md">{row.lost}</td>
                <td className="py-2 px-2 text-center text-ink-md">{row.runsFor}</td>
                <td className="py-2 px-2 text-center text-ink-md">{row.runsAgainst}</td>
                <td className="py-2 px-2 text-center text-ink-md">{row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}</td>
                <td className="py-2 px-2 text-center text-ink-md">{g === 0 ? "—" : g.toFixed(1)}</td>
                <td className="py-2 px-2 text-center font-bold text-ink-hi">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  useAccent(club);
  return (
    <div className="mx-auto max-w-5xl px-6 py-5">
      <header className="mb-6 flex items-center justify-between border-b border-line-hard pb-3">
        <span className="text-[13px] uppercase tracking-wider text-ink-lo">← Game World</span>
        <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-lo">
          Switch club
          <select
            value={club}
            onChange={(e) => setClub(Number(e.target.value))}
            className="bg-field-2 px-2 py-1 font-condensed text-[13px] uppercase tracking-wide text-ink-hi outline-none"
          >
            {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select>
        </label>
      </header>

      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-lo mb-1">Standings</div>
        <h1 className="text-3xl font-bold uppercase tracking-[0.04em] text-ink-hi">{league.name}</h1>
        <div className="text-[13px] uppercase tracking-wider text-ink-md mt-0.5">
          {league.type} · {league.divisionCount} divisions · Season in progress
        </div>
      </div>

      {divisions.map((d) => (
        <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
      ))}

      <footer className="mt-8 border-t border-line-soft pt-3 text-[10px] uppercase tracking-wider text-ink-lo">
        Visual reference: <span className="text-ink-md">MLB app, dark mode</span> — broadcast-dense, team color as restrained accent
      </footer>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
