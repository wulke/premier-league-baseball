import * as React from "react";
import { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league } from "../../shared/mock-data";
import { teams, type TeamIdentity } from "../../shared/tokens";
import { rosterFor, starOf, percentileColor, inkOn } from "./savant-data";

// Team Overview (Savant register): team-color identity strip + record summary,
// a small team-level percentile profile (echoes the player-page language at the
// team scale), and a roster table linking to player pages. This page exists to
// test whether Savant's restraint can still let team identity "carry atmosphere"
// (#8 principle 2) — the core tension of a data-tool aesthetic.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;
const useAccent = (clubId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(clubId).primary);
  }, [clubId]);

// pull this team's standing out of the mock divisions
const findStanding = (teamId: number) => {
  for (const d of divisions) {
    const idx = d.standings.findIndex((s) => s.teamId === teamId);
    if (idx >= 0) return { division: d, pos: idx + 1, row: d.standings[idx] };
  }
  return null;
};

// team-level percentile bars — invented but plausible, derived from the standing
const teamStats = (teamId: number) => {
  const s = findStanding(teamId)!;
  const wpct = s.row.won / Math.max(1, s.row.played);
  const rdpg = (s.row.runDifference / Math.max(1, s.row.played));
  return [
    { label: "W%", raw: wpct.toFixed(3).replace(/^0/, ""), percentile: Math.round(wpct * 100) },
    { label: "RunDiff/G", raw: (rdpg >= 0 ? "+" : "") + rdpg.toFixed(2), percentile: Math.round(50 + rdpg * 12) },
    { label: "Runs For", raw: String(s.row.runsFor), percentile: Math.round(50 + (s.row.runsFor - 100) * 1.2) },
    { label: "Runs Against", raw: String(s.row.runsAgainst), percentile: Math.round(50 - (s.row.runsAgainst - 100) * 1.2) },
  ];
};

const PercentileBar = ({ label, raw, percentile }: { label: string; raw: string; percentile: number }) => {
  const p = Math.max(2, Math.min(98, percentile));
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 shrink-0 text-right">
        <div className="font-num text-[10px] font-700 uppercase tracking-wide text-ink-lo">{label}</div>
        <div className="font-num text-[13px] font-700 text-ink-hi">{raw}</div>
      </div>
      <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-panel-2">
        <div className="absolute inset-y-0 left-0" style={{ width: `${p}%`, background: percentileColor(p) }} />
      </div>
      <div
        className="flex h-5 w-9 items-center justify-center rounded-sm font-num text-[11px] font-700"
        style={{ background: percentileColor(p), color: inkOn(p) }}
      >{p}</div>
    </div>
  );
};

const App = () => {
  const teamId = Number(new URLSearchParams(location.search).get("team") ?? "1");
  const id = identity(teamId);
  useAccent(teamId);
  const standing = findStanding(teamId);
  const roster = useMemo(() => rosterFor(teamId), [teamId]);
  const star = starOf(teamId);
  const stats = teamStats(teamId);

  return (
    <div className="min-h-screen bg-panel-1">
      <header className="bg-mlb-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-num text-[15px] font-700 uppercase tracking-[0.12em]">Premier League Baseball</span>
            <span className="rounded-sm bg-white/15 px-1.5 py-0.5 font-num text-[10px] font-700 uppercase tracking-widest">Statcast</span>
          </div>
          <a href="../index.html" className="font-num text-[11px] uppercase tracking-wider text-white/70 hover:text-white">← Standings</a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-5">
        {/* team identity — the atmosphere test */}
        <div className="mb-5 flex items-center gap-4 border-b border-rule-soft pb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md font-num text-2xl font-700 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${id.primary}, ${id.short}22)` }}>
            {id.short}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-num text-2xl font-700 uppercase tracking-wide text-ink-hi">{id.name}</h1>
              <span className="rounded-sm bg-panel-2 px-1.5 py-0.5 font-num text-[10px] font-700 uppercase tracking-widest text-ink-lo">
                {standing?.division.divisionName} · #{standing?.pos}
              </span>
            </div>
            <div className="mt-0.5 font-num text-[12px] uppercase tracking-wider text-ink-lo">
              {league.name} · {league.type}
            </div>
          </div>
          {/* record summary block */}
          <div className="flex gap-4">
            {[
              ["W", standing!.row.won], ["D", standing!.row.drawn], ["L", standing!.row.lost], ["PTS", standing!.row.points],
            ].map(([l, v]) => (
              <div key={l as string} className="text-center">
                <div className="font-num text-[10px] font-700 uppercase tracking-widest text-ink-lo">{l}</div>
                <div className="font-num text-xl font-700 text-ink-hi">{v as number}</div>
              </div>
            ))}
          </div>
        </div>

        {/* two-column: team percentile profile + roster */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* team percentile profile */}
          <section>
            <h2 className="mb-2 font-num text-[12px] font-700 uppercase tracking-[0.1em] text-mlb-navy">Team Profile</h2>
            <div className="space-y-1.5 rounded-md border border-rule-hard bg-panel-0 p-3 shadow-sm">
              {stats.map((s) => (
                <PercentileBar key={s.label} label={s.label} raw={s.raw} percentile={s.percentile} />
              ))}
            </div>
            <p className="mt-2 font-num text-[9px] uppercase tracking-widest text-ink-lo">
              Percentile scale vs. league · illustrative
            </p>
          </section>

          {/* roster */}
          <section>
            <h2 className="mb-2 font-num text-[12px] font-700 uppercase tracking-[0.1em] text-mlb-navy">Roster</h2>
            <div className="overflow-hidden rounded-md border border-rule-hard bg-panel-0 shadow-sm">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-mlb-navy bg-panel-2 font-num text-[10px] font-700 uppercase tracking-wider text-ink-lo">
                    <th className="px-3 py-1.5 text-left">Player</th>
                    <th className="px-2 py-1.5 text-center">Pos</th>
                    <th className="px-2 py-1.5 text-center">B/T</th>
                    <th className="px-2 py-1.5 text-center">AVG</th>
                    <th className="px-2 py-1.5 text-center">OBP</th>
                    <th className="px-2 py-1.5 text-center">SLG</th>
                    <th className="px-2 py-1.5 text-center">OPS</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p, i) => (
                    <tr key={p.id} className={`group border-b border-rule-soft hover:bg-panel-hover ${i % 2 === 1 ? "bg-panel-zebra" : ""} ${p.id === star.id ? "ring-1 ring-inset ring-mlb-blue" : ""}`}>
                      <td className="px-3 py-1.5 text-left">
                        <a href={`../player/?player=${p.id}`} className="inline-flex items-center gap-1.5">
                          {p.id === star.id && <span className="text-mlb-blue">★</span>}
                          <span className="font-num font-600 text-mlb-link group-hover:underline">{p.name}</span>
                        </a>
                      </td>
                      <td className="px-2 py-1.5 text-center font-num text-ink-md">{p.pos}</td>
                      <td className="px-2 py-1.5 text-center font-num text-ink-lo">{p.hand}</td>
                      <td className="px-2 py-1.5 text-center font-num text-ink-md">{p.slash.avg}</td>
                      <td className="px-2 py-1.5 text-center font-num text-ink-md">{p.slash.obp}</td>
                      <td className="px-2 py-1.5 text-center font-num text-ink-md">{p.slash.slg}</td>
                      <td className="px-2 py-1.5 text-center font-num font-700" style={{ color: Number(p.slash.ops) >= 0.8 ? "#1b6e3b" : Number(p.slash.ops) >= 0.7 ? "#14213d" : "#d71920" }}>
                        {p.slash.ops}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="mt-8 border-t border-rule-soft pt-3 font-num text-[10px] uppercase tracking-widest text-ink-lo">
          Visual reference: Baseball Savant (statcast) · Team Overview · illustrative mock data
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
