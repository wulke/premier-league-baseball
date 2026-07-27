import * as React from "react";
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId, type TeamStanding } from "../../shared/mock-data";
import { teams, type TeamIdentity } from "../../shared/tokens";

// EA Sports FC hub: the energy/spectacle end of the band. Oversized display
// hero with a team-color radial glow (switch-club re-themes the whole hero),
// glossy dark cards, big touch targets, leader gets gold. Still a table —
// data-first holds — but rendered with maximum atmosphere.

const identity = (id: number): TeamIdentity => teams.find((t) => t.teamId === id)!;
const useAccent = (clubId: number) =>
  useEffect(() => {
    document.documentElement.style.setProperty("--club", identity(clubId).primary);
  }, [clubId]);

const HEAD = ["RK", "CLUB", "P", "W", "D", "L", "RF", "RA", "RD", "PTS"];

const Division = ({ name, rows, clubId }: { name: string; rows: TeamStanding[]; clubId: number }) => (
  <div className="overflow-hidden rounded-2xl border border-line-hard bg-void-2">
    <div className="eafc-card-top flex items-center gap-3 px-5 py-3 border-b border-line-hard">
      <span className="inline-block h-5 w-1 rounded-full bg-club" />
      <span className="font-condensed text-lg font-bold uppercase tracking-[0.12em] text-ink-hi">{name}</span>
      <span className="ml-auto font-condensed text-xs uppercase tracking-widest text-ink-lo">{rows.length} teams</span>
    </div>
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-line-soft text-ink-lo">
          {HEAD.map((h, i) => (
            <th key={i} className={`px-3 py-2 font-condensed text-[11px] font-semibold uppercase tracking-widest ${i === 1 ? "text-left" : "text-center"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const id = identity(row.teamId);
          const isClub = row.teamId === clubId;
          const isLeader = i === 0;
          return (
            <tr
              key={row.teamId}
              className={`group relative border-b border-line-soft/50 transition-all duration-150 hover:bg-void-hover ${
                isLeader ? "eafc-leader" : ""
              } ${isClub ? "eafc-row-glow" : ""}`}
            >
              <td className="px-3 py-3 text-center">
                <span className={`font-display text-lg ${isLeader ? "text-gold" : "text-ink-lo"}`}>{i + 1}</span>
              </td>
              <td className="px-3 py-3 text-left">
                <div className="flex items-center gap-3">
                  {/* big team-color gradient block (the spectacle expression of identity) */}
                  <span
                    className="inline-block h-9 w-9 rounded-md align-middle"
                    style={{
                      background: `linear-gradient(135deg, ${id.primary}, color-mix(in srgb, ${id.primary} 50%, #000))`,
                      boxShadow: `0 0 14px -3px ${id.primary}`,
                    }}
                  />
                  <div className="flex flex-col">
                    <span className={`font-condensed text-[17px] font-bold uppercase tracking-wide ${isClub ? "text-ink-hi" : "text-ink-md group-hover:text-ink-hi"}`}>
                      {row.teamName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isLeader && <span className="font-condensed text-[10px] font-bold uppercase tracking-widest text-gold">★ Division leader</span>}
                      {isClub && <span className="font-condensed text-[10px] font-bold uppercase tracking-widest text-club">◆ Your club</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-center font-condensed text-ink-md">{row.played}</td>
              <td className="px-3 py-3 text-center font-condensed font-semibold text-ink-hi">{row.won}</td>
              <td className="px-3 py-3 text-center font-condensed text-ink-lo">{row.drawn}</td>
              <td className="px-3 py-3 text-center font-condensed text-ink-md">{row.lost}</td>
              <td className="px-3 py-3 text-center font-condensed text-ink-md">{row.runsFor}</td>
              <td className="px-3 py-3 text-center font-condensed text-ink-md">{row.runsAgainst}</td>
              <td className="px-3 py-3 text-center font-condensed text-ink-md">{row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}</td>
              <td className="px-3 py-3 text-center">
                <span className={`font-display text-xl ${isLeader ? "text-gold" : "text-ink-hi"}`}>{row.points}</span>
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
    <div className="min-h-screen">
      {/* HERO — oversized title with club-color radial glow */}
      <div className="eafc-hero border-b border-line-hard">
        <div className="mx-auto max-w-5xl px-6 pt-6 pb-8">
          <header className="mb-6 flex items-center justify-between">
            <span className="font-condensed text-sm uppercase tracking-widest text-ink-md">← Game World</span>
            <label className="flex items-center gap-2 font-condensed text-[11px] uppercase tracking-widest text-ink-lo">
              Switch club
              <select
                value={club}
                onChange={(e) => setClub(Number(e.target.value))}
                className="rounded-md border border-line-hard bg-void-2 px-3 py-1.5 font-condensed text-sm uppercase tracking-wide text-ink-hi"
              >
                {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
              </select>
            </label>
          </header>

          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-electric">Season in progress</div>
          <h1 className="mt-1 font-display text-5xl uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,229,255,0.25)]">
            {league.name}
          </h1>
          <p className="mt-2 font-condensed text-sm uppercase tracking-widest text-ink-md">
            {league.type} · {league.divisionCount} divisions
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-5">
        {divisions.map((d) => (
          <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
        ))}
        <footer className="pt-2 font-condensed text-[10px] uppercase tracking-widest text-ink-lo">
          Visual reference: <span className="text-ink-md">EA Sports FC hub</span> — energy, spectacle, team identity as gradient glow
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
