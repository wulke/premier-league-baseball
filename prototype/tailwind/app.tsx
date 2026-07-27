import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId } from "../shared/mock-data";
import { teams, type TeamIdentity } from "../shared/tokens";

// ── token swap: club identity → CSS vars consumed by tailwind.config ──
function useAccent(clubId: number | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (clubId == null) {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-on");
    } else {
      const t = teams.find((x) => x.teamId === clubId)!;
      root.style.setProperty("--accent", t.primary);
      root.style.setProperty("--accent-on", t.onPrimary);
    }
  }, [clubId]);
}

const identity = (teamId: number): TeamIdentity =>
  teams.find((t) => t.teamId === teamId)!;

const FormStrip = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <div className="flex gap-1">
    {form.map((r, i) => (
      <span
        key={i}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold ${
          r === "W"
            ? "bg-green-500/20 text-green-300"
            : r === "D"
            ? "bg-edge-subtle text-ink-secondary"
            : "bg-red-500/20 text-red-300"
        }`}
      >
        {r}
      </span>
    ))}
  </div>
);

const DivisionRows = ({
  standings,
  clubId,
}: {
  standings: import("../shared/mock-data").TeamStanding[];
  clubId: number;
}) => (
  <>
    {standings.map((row, i) => {
      const id = identity(row.teamId);
      const isClub = row.teamId === clubId;
      return (
        <tr
          key={row.teamId}
          className="group border-b border-edge-subtle transition-colors hover:bg-app-hover"
        >
          <td className="px-2 py-2 text-center text-xs text-ink-muted">{i + 1}</td>
          <td className="px-2 py-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: id.primary }}
              />
              <span
                className={`font-semibold ${
                  isClub ? "text-ink-primary" : "text-ink-secondary"
                }`}
              >
                {row.teamName}
              </span>
              {isClub && (
                <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-on">
                  your club
                </span>
              )}
            </div>
          </td>
          <td className="px-2 py-2 text-center text-ink-secondary">{row.played}</td>
          <td className="px-2 py-2 text-center text-ink-secondary">{row.won}</td>
          <td className="px-2 py-2 text-center text-ink-muted">{row.drawn}</td>
          <td className="px-2 py-2 text-center text-ink-secondary">{row.lost}</td>
          <td className="px-2 py-2 text-center text-ink-muted">{row.runsFor}</td>
          <td className="px-2 py-2 text-center text-ink-muted">{row.runsAgainst}</td>
          <td className="px-2 py-2 text-center text-ink-secondary">
            {row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}
          </td>
          <td className="px-2 py-2 text-center font-bold text-ink-primary">
            {row.points}
          </td>
          <td className="px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
            <FormStrip form={row.form} />
          </td>
        </tr>
      );
    })}
  </>
);

const Division = ({
  name,
  standings,
  clubId,
}: {
  name: string;
  standings: import("../shared/mock-data").TeamStanding[];
  clubId: number;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-md border border-edge-subtle bg-app-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-app-raised px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-base font-bold text-ink-primary">{name}</span>
          <span className="text-xs text-ink-muted">{standings.length} teams</span>
        </span>
        <span className="text-xs font-semibold text-ink-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="px-4 py-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge-strong">
                {["#", "Team", "P", "W", "D", "L", "RF", "RA", "RD", "Pts", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted ${
                        i === 1 ? "text-left" : "text-center"
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              <DivisionRows standings={standings} clubId={clubId} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  useAccent(club);
  return (
    <div className="mx-auto max-w-4xl px-6 pb-12">
      <header className="flex items-center justify-between border-b-2 border-edge-strong py-3.5 mb-8">
        <span className="text-sm font-medium text-ink-secondary">← Game World</span>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          switch club
          <select
            value={club}
            onChange={(e) => setClub(Number(e.target.value))}
            className="rounded-sm border border-edge-strong bg-app-raised px-2 py-1 text-sm text-ink-primary"
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mb-8">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold text-ink-primary">{league.name}</h1>
          <span className="rounded-full border border-edge-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            {league.type}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {league.divisionCount} divisions · Season in progress
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Standings
        </h2>
        {divisions.map((d) => (
          <Division
            key={d.divisionId}
            name={d.divisionName}
            standings={d.standings}
            clubId={club}
          />
        ))}
      </section>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
