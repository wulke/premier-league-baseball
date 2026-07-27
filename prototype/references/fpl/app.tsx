import * as React from "react";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId, type TeamStanding } from "../../shared/mock-data";
import { teams, type TeamIdentity } from "../../shared/tokens";

// FPL dark: gamified management energy. Color-coded status everywhere — form
// pills (green/grey/red), rank-movement arrows from last result, points in a
// chip, PL-purple brand accent. Rounded cards, Inter, chips & badges.
// Switch-club re-themes the your-club highlight + badge ring.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;
const useAccent = (clubId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(clubId).primary);
  }, [clubId]);

const FormPills = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <div className="flex gap-1">
    {form.map((r, i) => (
      <span
        key={i}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-pill text-[11px] font-bold ${
          r === "W" ? "bg-good/25 text-good" : r === "D" ? "bg-line-soft text-ink-md" : "bg-bad/25 text-bad"
        }`}
      >
        {r}
      </span>
    ))}
  </div>
);

// rank-movement arrow from the most recent result
const RankArrow = ({ last }: { last: "W" | "D" | "L" }) => {
  const map = {
    W: { g: "↑", c: "text-good" },
    D: { g: "→", c: "text-ink-lo" },
    L: { g: "↓", c: "text-bad" },
  } as const;
  return <span className={`text-sm font-bold ${map[last].c}`}>{map[last].g}</span>;
};

const HEAD = ["#", "", "Team", "P", "W", "D", "L", "RF", "RA", "RD", "Form", "Pts"];

const Division = ({ name, rows, clubId }: { name: string; rows: TeamStanding[]; clubId: number }) => (
  <div className="overflow-hidden rounded-2xl border border-line-soft bg-pitch-1 shadow-lg shadow-black/30">
    <div className="flex items-center gap-2 bg-gradient-to-r from-plum to-plumSoft px-4 py-2.5">
      <span className="text-[15px] font-bold text-white">{name}</span>
      <span className="rounded-pill bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90">{rows.length} teams</span>
    </div>
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line-soft text-ink-lo">
          {HEAD.map((h, i) => (
            <th key={i} className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wider ${i === 2 ? "text-left" : "text-center"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const id = identity(row.teamId);
          const isClub = row.teamId === clubId;
          return (
            <tr
              key={row.teamId}
              className={`group border-b border-line-soft/60 transition-colors hover:bg-pitch-hover ${
                isClub ? "bg-club/10" : ""
              }`}
            >
              <td className="px-2 py-2 text-center">
                <span className="inline-flex items-center gap-1 font-bold text-ink-md">
                  <RankArrow last={row.form[0]} />
                  {i + 1}
                </span>
              </td>
              <td className="px-1 py-2 text-center">
                {/* kit-badge: team color rounded square */}
                <span
                  className="inline-block h-6 w-6 rounded-md align-middle"
                  style={{ background: id.primary, boxShadow: isClub ? `0 0 0 2px var(--club)` : "none" }}
                />
              </td>
              <td className="px-2 py-2 text-left">
                <span className={`font-semibold ${isClub ? "text-ink-hi" : "text-ink-md"}`}>{row.teamName}</span>
                {isClub && <span className="ml-2 rounded-pill bg-club px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">★ Your Club</span>}
              </td>
              <td className="px-2 py-2 text-center text-ink-md">{row.played}</td>
              <td className="px-2 py-2 text-center font-semibold text-ink-hi">{row.won}</td>
              <td className="px-2 py-2 text-center text-ink-lo">{row.drawn}</td>
              <td className="px-2 py-2 text-center text-ink-md">{row.lost}</td>
              <td className="px-2 py-2 text-center text-ink-lo">{row.runsFor}</td>
              <td className="px-2 py-2 text-center text-ink-lo">{row.runsAgainst}</td>
              <td className="px-2 py-2 text-center text-ink-md">{row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}</td>
              <td className="px-2 py-2 text-center"><FormPills form={row.form} /></td>
              <td className="px-2 py-2 text-center">
                <span className={`inline-flex min-w-[2rem] justify-center rounded-pill px-2 py-0.5 text-sm font-bold ${
                  i === 0 ? "bg-good/25 text-good" : "bg-line-soft text-ink-hi"
                }`}>
                  {row.points}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  useAccent(club);
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-line-soft bg-pitch-1 px-4 py-3">
        <span className="text-sm font-medium text-ink-md">← Game World</span>
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-lo">
          Switch club
          <select
            value={club}
            onChange={(e) => setClub(Number(e.target.value))}
            className="rounded-pill border border-line-hard bg-pitch-2 px-3 py-1 text-sm font-semibold text-ink-hi"
          >
            {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select>
        </label>
      </header>

      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-pill bg-gradient-to-r from-plum to-plumSoft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Gameweek live</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-hi">{league.name}</h1>
        <p className="text-sm text-ink-lo">{league.type} · {league.divisionCount} divisions · Season in progress</p>
      </div>

      <div className="space-y-4">
        {divisions.map((d) => (
          <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
        ))}
      </div>

      <footer className="mt-8 text-[10px] font-semibold uppercase tracking-wider text-ink-lo">
        Visual reference: <span className="text-ink-md">Fantasy Premier League, dark theme</span> — gamified, color-coded status
      </footer>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
