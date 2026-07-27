import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { divisions, league, clubTeamId, type TeamStanding } from "../shared/mock-data";
import { teams, type TeamIdentity } from "../shared/tokens";
import { cn } from "./lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./components/ui/collapsible";
import { Table, THead, TBody, TR, TH, TD } from "./components/ui/table";

// hex → "H S% L%" so we can drop it into shadcn's hsl(var(--primary)) token.
function hexToHsl(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const light = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      default: hue = (r - g) / d + 4;
    }
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%`;
}

// token swap — club identity → shadcn's --primary token, the whole theme follows.
function useAccent(clubId: number | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (clubId == null) {
      root.style.removeProperty("--primary");
    } else {
      const t = teams.find((x) => x.teamId === clubId)!;
      root.style.setProperty("--primary", hexToHsl(t.primary));
    }
  }, [clubId]);
}

const identity = (teamId: number): TeamIdentity => teams.find((t) => t.teamId === teamId)!;

const FormStrip = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <div className="flex gap-1">
    {form.map((r, i) => (
      <span
        key={i}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold",
          r === "W" && "bg-green-500/20 text-green-300",
          r === "D" && "bg-border text-muted-foreground",
          r === "L" && "bg-red-500/20 text-red-300"
        )}
      >
        {r}
      </span>
    ))}
  </div>
);

const StandingsRows = ({ rows, clubId }: { rows: TeamStanding[]; clubId: number }) => (
  <>
    {rows.map((row, i) => {
      const id = identity(row.teamId);
      const isClub = row.teamId === clubId;
      return (
        <TR key={row.teamId} className="group">
          <TD className="text-center text-xs text-subtle-foreground">{i + 1}</TD>
          <TD>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: id.primary }} />
              <span className={cn("font-semibold", isClub ? "text-foreground" : "text-muted-foreground")}>
                {row.teamName}
              </span>
              {isClub && (
                <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  your club
                </span>
              )}
            </div>
          </TD>
          <TD className="text-center text-muted-foreground">{row.played}</TD>
          <TD className="text-center text-muted-foreground">{row.won}</TD>
          <TD className="text-center text-subtle-foreground">{row.drawn}</TD>
          <TD className="text-center text-muted-foreground">{row.lost}</TD>
          <TD className="text-center text-subtle-foreground">{row.runsFor}</TD>
          <TD className="text-center text-subtle-foreground">{row.runsAgainst}</TD>
          <TD className="text-center text-muted-foreground">
            {row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}
          </TD>
          <TD className="text-center font-bold text-foreground">{row.points}</TD>
          <TD className="opacity-0 transition-opacity group-hover:opacity-100">
            <FormStrip form={row.form} />
          </TD>
        </TR>
      );
    })}
  </>
);

const Division = ({ name, rows, clubId }: { name: string; rows: TeamStanding[]; clubId: number }) => (
  <Collapsible defaultOpen className="overflow-hidden rounded-md border border-border bg-surface">
    <CollapsibleTrigger>
      <span className="flex items-center gap-2">
        <span className="text-base font-bold text-foreground">{name}</span>
        <span className="text-xs text-subtle-foreground">{rows.length} teams</span>
      </span>
      <span className="text-xs font-semibold text-subtle-foreground">▼</span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            {["#", "Team", "P", "W", "D", "L", "RF", "RA", "RD", "Pts", ""].map((h, i) => (
              <TH key={i} className={i === 1 ? "text-left" : "text-center"}>
                {h}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          <StandingsRows rows={rows} clubId={clubId} />
        </TBody>
      </Table>
    </CollapsibleContent>
  </Collapsible>
);

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  useAccent(club);
  return (
    <div className="mx-auto max-w-4xl px-6 pb-12">
      <header className="mb-8 flex items-center justify-between border-b-2 border-border-strong py-3.5">
        <span className="text-sm font-medium text-muted-foreground">← Game World</span>
        <label className="flex items-center gap-2 text-xs text-subtle-foreground">
          switch club
          <select
            value={club}
            onChange={(e) => setClub(Number(e.target.value))}
            className="rounded-sm border border-border-strong bg-card px-2 py-1 text-sm text-foreground"
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.name}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="mb-8">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-bold text-foreground">{league.name}</h1>
          <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {league.type}
          </span>
        </div>
        <p className="mt-1 text-sm text-subtle-foreground">
          {league.divisionCount} divisions · Season in progress
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Standings</h2>
        {divisions.map((d) => (
          <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
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
