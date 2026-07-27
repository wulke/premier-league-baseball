import * as React from "react";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { teams, type TeamIdentity } from "../../shared/tokens";
import { getPlayer, STAT_DEFS, percentileColor, inkOn } from "./savant-data";

// Player Overview (Savant register): the famous percentile-bar profile is the
// centerpiece — a totally different component from any table, which is why this
// page is the high-signal test of whether the Savant register generalizes.
// Header card with identity, big slash line, then the percentile grid.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;
const useAccent = (teamId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(teamId).primary);
  }, [teamId]);

const PercentileBar = ({ label, raw, percentile }: { label: string; raw: string; percentile: number }) => {
  const p = Math.max(2, Math.min(98, percentile));
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 shrink-0 text-right">
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

const SlashStat = ({ label, value, hot }: { label: string; value: string; hot?: boolean }) => (
  <div className="rounded-md border border-rule-hard bg-panel-0 px-3 py-2 text-center shadow-sm">
    <div className="font-num text-[10px] font-700 uppercase tracking-widest text-ink-lo">{label}</div>
    <div className={`font-num text-2xl font-700 ${hot ? "text-mlb-navy" : "text-ink-hi"}`}>{value}</div>
  </div>
);

const App = () => {
  const pid = Number(new URLSearchParams(location.search).get("player") ?? "101");
  const player = getPlayer(pid);
  const id = identity(player.teamId);
  useAccent(player.teamId);

  return (
    <div className="min-h-screen bg-panel-1">
      <header className="bg-mlb-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="font-num text-[15px] font-700 uppercase tracking-[0.12em]">Premier League Baseball</span>
            <span className="rounded-sm bg-white/15 px-1.5 py-0.5 font-num text-[10px] font-700 uppercase tracking-widest">Statcast</span>
          </div>
          <a href={`../team/?team=${player.teamId}`} className="font-num text-[11px] uppercase tracking-wider text-white/70 hover:text-white">← {id.name}</a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-5">
        {/* player identity card */}
        <div className="mb-5 flex items-center gap-4 rounded-md border border-rule-hard bg-panel-0 p-4 shadow-sm"
             style={{ borderLeft: `6px solid ${id.primary}` }}>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md font-num text-3xl font-700 text-white"
               style={{ background: `linear-gradient(135deg, ${id.primary}, #002d72)` }}>
            {player.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1">
            <h1 className="font-num text-3xl font-700 uppercase tracking-wide text-ink-hi">{player.name}</h1>
            <div className="mt-1 flex items-center gap-2 font-num text-[12px] uppercase tracking-wider text-ink-lo">
              <a href={`../team/?team=${player.teamId}`} className="inline-flex items-center gap-1.5 text-mlb-link hover:underline">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: id.primary }} />
                {id.name}
              </a>
              <span>·</span><span>{player.pos}</span>
              <span>·</span><span>B/T: {player.hand}</span>
            </div>
          </div>
        </div>

        {/* slash line */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SlashStat label="AVG" value={player.slash.avg} />
          <SlashStat label="OBP" value={player.slash.obp} />
          <SlashStat label="SLG" value={player.slash.slg} />
          <SlashStat label="OPS" value={player.slash.ops} hot />
        </div>

        {/* percentile profile — the centerpiece */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-num text-[12px] font-700 uppercase tracking-[0.1em] text-mlb-navy">Percentile Rankings</h2>
            <span className="font-num text-[9px] uppercase tracking-widest text-ink-lo">vs. league · illustrative</span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 rounded-md border border-rule-hard bg-panel-0 p-4 shadow-sm md:grid-cols-2">
            {STAT_DEFS.map((d) => (
              <PercentileBar
                key={d.key}
                label={d.label}
                raw={player.stats[d.key].raw}
                percentile={player.stats[d.key].percentile}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            {[10, 35, 50, 65, 90].map((p) => (
              <span key={p} className="inline-block h-2 w-8" style={{ background: percentileColor(p) }} />
            ))}
            <span className="ml-1 font-num text-[9px] uppercase tracking-widest text-ink-lo">poor → elite</span>
          </div>
        </section>

        <footer className="mt-8 border-t border-rule-soft pt-3 font-num text-[10px] uppercase tracking-widest text-ink-lo">
          Visual reference: Baseball Savant (statcast) · Player Overview · illustrative mock data
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
