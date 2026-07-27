import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId, type TeamStanding } from "../../shared/mock-data";
import { teams, type TeamIdentity } from "../../shared/tokens";
import { percentileColor, inkOn, pyth } from "./savant-data";

// Baseball Savant: the Statcast-nerd pole. Light theme, MLB navy/blue, a data
// table you could live in. The signature is the percentile color scale
// (red→yellow→green) applied to the columns that matter — here Pts and a
// sabermetric Pyth% (pythagorean expectation from RF/RA). Filter pills,
// sortable-looking headers, zebra rows, tabular numerics, trend arrows.
// Switch-club tints your-club row in MLB blue.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;
const useAccent = (clubId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(clubId).primary);
  }, [clubId]);

// trend arrow from most-recent result
const Trend = ({ last }: { last: "W" | "D" | "L" }) => {
  const m = { W: ["▲", "#1b6e3b"], D: ["▶", "#7A8499"], L: ["▼", "#d71920"] } as const;
  return <span style={{ color: m[last][1] }} className="text-[11px] font-bold">{m[last][0]}</span>;
};

const L5 = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <div className="flex justify-center gap-0.5">
    {form.map((r, i) => (
      <span
        key={i}
        className="inline-block h-3.5 w-3.5 rounded-[2px] text-[8px] font-bold leading-[14px] text-white"
        style={{ background: r === "W" ? "#1b6e3b" : r === "D" ? "#7A8499" : "#d71920" }}
      >{r}</span>
    ))}
  </div>
);

type SortKey = "pts" | "pyth" | "rd" | "rf";
const HEAD: [string, SortKey | null, string][] = [
  ["RK", null, "w-10"],
  ["", null, "w-8"],
  ["TEAM", null, "text-left"],
  ["P", null, ""],
  ["W", null, ""],
  ["D", null, ""],
  ["L", null, ""],
  ["RF", "rf", ""],
  ["RA", null, ""],
  ["RD", "rd", ""],
  ["PYTH%", "pyth", ""],
  ["L5", null, ""],
  ["PTS", "pts", ""],
];

const SavantTable = ({ rows, clubId }: { rows: TeamStanding[]; clubId: number }) => {
  const [sort, setSort] = useState<SortKey>("pts");
  // precompute pyth + points bounds for the percentile scale (within this view)
  const withPyth = useMemo(
    () => rows.map((r) => ({ ...r, pyth: pyth(r.runsFor, r.runsAgainst) })),
    [rows]
  );
  const bounds = useMemo(() => {
    const pts = withPyth.map((r) => r.points);
    const py = withPyth.map((r) => r.pyth);
    return {
      pts: [Math.min(...pts), Math.max(...pts)] as [number, number],
      pyth: [Math.min(...py), Math.max(...py)] as [number, number],
    };
  }, [withPyth]);
  const pct = (v: number, [lo, hi]: [number, number]) =>
    hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;

  const sorted = useMemo(() => {
    const a = [...withPyth].sort((x, y) => {
      switch (sort) {
        case "pyth": return y.pyth - x.pyth;
        case "rd": return y.runDifference - x.runDifference;
        case "rf": return y.runsFor - x.runsFor;
        default: return y.points - x.points;
      }
    });
    return a;
  }, [withPyth, sort]);

  return (
    <div className="overflow-hidden rounded-md border border-rule-hard bg-panel-0 shadow-sm">
      <table className="savant-table w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-mlb-navy bg-panel-2 text-ink-lo">
            {HEAD.map(([label, key, align], i) => (
              <th
                key={i}
                onClick={() => key && setSort(key)}
                className={`px-2 py-1.5 font-num text-[10px] font-700 uppercase tracking-wider text-center ${align} ${
                  key ? "cursor-pointer hover:text-mlb-navy" : ""
                } ${key && sort === key ? "text-mlb-navy underline underline-offset-2" : ""}`}
              >
                <span className="inline-flex items-center gap-0.5 justify-center">
                  {label}
                  {key && sort === key && <span className="text-[8px]">▼</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const id = identity(row.teamId);
            const isClub = row.teamId === clubId;
            const ptsPct = pct(row.points, bounds.pts);
            const pyPct = pct(row.pyth, bounds.pyth);
            return (
              <tr
                key={row.teamId}
                className={`group border-b border-rule-soft transition-colors hover:bg-panel-hover ${
                  i % 2 === 1 ? "bg-panel-zebra" : ""
                } ${isClub ? "ring-1 ring-inset ring-club/40" : ""}`}
                style={isClub ? { boxShadow: "inset 3px 0 0 var(--club)" } : undefined}
              >
                <td className="px-2 py-1.5 text-center font-num font-700 text-ink-md">{i + 1}</td>
                <td className="px-2 py-1.5 text-center"><Trend last={row.form[0]} /></td>
                <td className="px-2 py-1.5 text-left">
                  <a href={`team/?team=${row.teamId}`} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: id.primary }} />
                    <span className={`font-num font-600 ${isClub ? "text-ink-hi" : "text-mlb-link hover:underline"}`}>{row.teamName}</span>
                    {isClub && <span className="ml-1 font-num text-[9px] font-700 uppercase tracking-wide text-club">★ your club</span>}
                  </a>
                </td>
                <td className="px-2 py-1.5 text-center font-num text-ink-md">{row.played}</td>
                <td className="px-2 py-1.5 text-center font-num font-600 text-ink-hi">{row.won}</td>
                <td className="px-2 py-1.5 text-center font-num text-ink-lo">{row.drawn}</td>
                <td className="px-2 py-1.5 text-center font-num text-ink-md">{row.lost}</td>
                <td className="px-2 py-1.5 text-center font-num text-ink-md">{row.runsFor}</td>
                <td className="px-2 py-1.5 text-center font-num text-ink-md">{row.runsAgainst}</td>
                <td className="px-2 py-1.5 text-center font-num font-600 text-ink-hi">{row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}</td>
                {/* PYTH% — percentile gradient cell */}
                <td
                  className="px-2 py-1.5 text-center font-num font-700"
                  style={{ background: percentileColor(pyPct), color: inkOn(pyPct) }}
                >{row.pyth.toFixed(3).replace(/^0/, "")}</td>
                <td className="px-2 py-1.5 text-center"><L5 form={row.form} /></td>
                {/* PTS — percentile gradient cell */}
                <td
                  className="px-2 py-1.5 text-center font-num font-700"
                  style={{ background: percentileColor(ptsPct), color: inkOn(ptsPct) }}
                >{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-3 py-1 font-num text-[11px] font-700 uppercase tracking-wide transition-colors ${
      active ? "border-mlb-navy bg-mlb-navy text-white" : "border-rule-hard bg-panel-1 text-ink-md hover:border-mlb-blue hover:text-mlb-navy"
    }`}
  >{children}</button>
);

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  const [view, setView] = useState<"all" | number>("all");
  useAccent(club);
  const shown = divisions.filter((d) => view === "all" || d.divisionId === view);

  return (
    <div className="min-h-screen bg-panel-1">
      {/* MLB navy header strip — Savant's brand band */}
      <header className="bg-mlb-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-num text-[15px] font-700 uppercase tracking-[0.12em]">Premier League Baseball</span>
            <span className="rounded-sm bg-white/15 px-1.5 py-0.5 font-num text-[10px] font-700 uppercase tracking-widest">Statcast</span>
          </div>
          <span className="font-num text-[11px] uppercase tracking-wider text-white/70">← Game World</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-5">
        {/* filter bar — division pills + club switcher */}
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-rule-soft pb-3">
          <span className="mr-1 font-num text-[10px] font-700 uppercase tracking-widest text-ink-lo">Division:</span>
          <Pill active={view === "all"} onClick={() => setView("all")}>All</Pill>
          {divisions.map((d) => (
            <Pill key={d.divisionId} active={view === d.divisionId} onClick={() => setView(d.divisionId)}>{d.divisionName}</Pill>
          ))}
          <label className="ml-auto flex items-center gap-2 font-num text-[10px] font-700 uppercase tracking-widest text-ink-lo">
            Your club
            <select
              value={club}
              onChange={(e) => setClub(Number(e.target.value))}
              className="rounded border border-rule-hard bg-panel-0 px-2 py-1 font-num text-[12px] font-600 uppercase tracking-wide text-ink-hi"
            >
              {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
            </select>
          </label>
        </div>

        {/* page title */}
        <div className="mb-4">
          <h1 className="font-num text-xl font-700 uppercase tracking-wide text-ink-hi">{league.name} · Standings</h1>
          <p className="font-num text-[11px] uppercase tracking-widest text-ink-lo">
            {league.type} · {league.divisionCount} divisions · Season in progress · sorted by points
          </p>
        </div>

        {/* per-division tables */}
        <div className="space-y-5">
          {shown.map((d) => (
            <section key={d.divisionId}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <h2 className="font-num text-[13px] font-700 uppercase tracking-[0.1em] text-mlb-navy">{d.divisionName}</h2>
                <span className="font-num text-[10px] uppercase tracking-wider text-ink-lo">{d.standings.length} teams</span>
              </div>
              <SavantTable rows={d.standings} clubId={club} />
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-rule-soft pt-3 font-num text-[10px] uppercase tracking-widest text-ink-lo">
          Visual reference: <span className="text-ink-md">Baseball Savant (statcast)</span> — light, data-dense, percentile color scale (red→yellow→green) on Pts &amp; Pyth%
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
