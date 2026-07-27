import * as React from "react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Collapsible as RadixCollapsible } from "radix-ui";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import {
  styled,
  globalStyles,
  createTheme,
} from "./stitches.config";
import { divisions, league, clubTeamId, type TeamStanding } from "../shared/mock-data";
import { teams, type TeamIdentity } from "../shared/tokens";

globalStyles();

// NOTE (an ergonomic finding worth keeping): Stitches' $token substitution
// resolves ONLY inside styled()/css(). Plain inline `style={{}}` cannot use
// $tokens, so anything dynamic styled inline has to use resolved literals.
const C = {
  inkPrimary: "#E8EAED", inkSecondary: "#A0A6B0", inkMuted: "#6B7280",
  borderSubtle: "#2C313A",
};

// ── token swap: one Stitches theme class per club, applied to the root ──
const clubTheme: Record<number, string> = {};
for (const t of teams) {
  clubTheme[t.teamId] = createTheme({
    colors: { accent: t.primary, accentOn: t.onPrimary },
  });
}

const identity = (teamId: number): TeamIdentity => teams.find((t) => t.teamId === teamId)!;

// ── styled primitives ──
const Page = styled("div", { maxWidth: 900, margin: "0 auto", padding: "0 24px 48px" });
const Header = styled("header", {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  borderBottom: "2px solid $borderStrong", padding: "14px 0", marginBottom: 32,
});
const Title = styled("h1", { margin: 0, fontSize: "$xl", fontWeight: 700 });
const Badge = styled("span", {
  fontSize: "$xs", fontWeight: 600, color: "$inkSecondary",
  border: "1px solid $borderStrong", borderRadius: 999, padding: "2px 10px",
  textTransform: "uppercase", letterSpacing: "0.04em",
});
const SectionLabel = styled("h2", {
  margin: "0 0 12px", fontSize: "$xs", textTransform: "uppercase", letterSpacing: "0.07em",
  color: "$inkMuted", fontWeight: 600,
});
const Switcher = styled("select", {
  borderRadius: "$sm", border: "1px solid $borderStrong", background: "$raised",
  color: "$inkPrimary", padding: "4px 8px", fontSize: "$md",
});
const Card = styled("div", { overflow: "hidden", borderRadius: "$md", border: "1px solid $borderSubtle", background: "$surface", marginBottom: 12 });
const Trigger = styled(RadixCollapsible.Trigger, {
  display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
  background: "$raised", border: "none", padding: "12px 16px", cursor: "pointer", color: "inherit",
});
const Content = styled(RadixCollapsible.Content, { padding: "12px 16px" });

const Table = styled("table", { width: "100%", borderCollapse: "collapse", fontSize: "$md" });
const Th = styled("th", {
  padding: "6px 8px", fontWeight: 600, fontSize: "$xs", textTransform: "uppercase",
  letterSpacing: "0.04em", color: "$inkMuted", borderBottom: "2px solid $borderStrong",
  variants: { align: { left: { textAlign: "left" }, center: { textAlign: "center" } } },
  defaultVariants: { align: "center" },
});
const Td = styled("td", {
  padding: "8px", textAlign: "center",
  variants: {
    tone: { primary: { color: "$inkPrimary" }, secondary: { color: "$inkSecondary" }, muted: { color: "$inkMuted" } },
    bold: { true: { fontWeight: 700 } },
  },
});
const Row = styled("tr", {
  borderBottom: "1px solid $borderSubtle", transition: "background 120ms",
  "&:hover": { background: "$hover" },
});

const TeamCell = styled("div", { display: "flex", alignItems: "center", gap: 8 });
const Dot = styled("span", { display: "inline-block", width: 10, height: 10, borderRadius: "50%" });
const ClubTag = styled("span", {
  background: "$accent", color: "$accentOn", borderRadius: "$sm", padding: "1px 6px",
  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
});
const Chevron = styled(ChevronDownIcon, {
  width: 16, height: 16, color: "$inkMuted", transition: "transform 200ms",
  variants: { open: { true: { transform: "rotate(180deg)" } } },
});

const FormStrip = ({ form }: { form: ("W" | "D" | "L")[] }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {form.map((r, i) => (
      <span key={i} style={{
        display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center",
        borderRadius: 2, fontSize: 10, fontWeight: 700,
        background: r === "W" ? "rgba(46,158,91,0.2)" : r === "D" ? C.borderSubtle : "rgba(229,57,53,0.2)",
        color: r === "W" ? "#6EE7A8" : r === "D" ? C.inkSecondary : "#FCA5A5",
      }}>{r}</span>
    ))}
  </div>
);

const Division = ({ name, rows, clubId }: { name: string; rows: TeamStanding[]; clubId: number }) => {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <RadixCollapsible.Root open={open} onOpenChange={setOpen}>
        <Trigger>
          <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <strong style={{ fontSize: 16 }}>{name}</strong>
            <span style={{ fontSize: 12, color: C.inkMuted }}>{rows.length} teams</span>
          </span>
          <Chevron open={open} />
        </Trigger>
        <Content>
          <Table>
            <thead>
              <tr>
                {["#", "Team", "P", "W", "D", "L", "RF", "RA", "RD", "Pts", ""].map((h, i) => (
                  <Th key={i} align={i === 1 ? "left" : "center"}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const id = identity(row.teamId);
                const isClub = row.teamId === clubId;
                return (
                  <Row key={row.teamId}>
                    <Td tone="muted"><span style={{ fontSize: 12 }}>{i + 1}</span></Td>
                    <Td align="left" style={{ textAlign: "left" }}>
                      <TeamCell>
                        <Dot style={{ background: id.primary }} />
                        <span style={{ fontWeight: 600, color: isClub ? C.inkPrimary : C.inkSecondary }}>{row.teamName}</span>
                        {isClub && <ClubTag>your club</ClubTag>}
                      </TeamCell>
                    </Td>
                    <Td tone="secondary">{row.played}</Td>
                    <Td tone="secondary">{row.won}</Td>
                    <Td tone="muted">{row.drawn}</Td>
                    <Td tone="secondary">{row.lost}</Td>
                    <Td tone="muted">{row.runsFor}</Td>
                    <Td tone="muted">{row.runsAgainst}</Td>
                    <Td tone="secondary">{row.runDifference > 0 ? `+${row.runDifference}` : row.runDifference}</Td>
                    <Td tone="primary" bold>{row.points}</Td>
                    <Td><FormStrip form={row.form} /></Td>
                  </Row>
                );
              })}
            </tbody>
          </Table>
        </Content>
      </RadixCollapsible.Root>
    </Card>
  );
};

const App = () => {
  const [club, setClub] = useState<number>(clubTeamId);
  return (
    <div className={clubTheme[club]}>
      <Page>
        <Header>
          <span style={{ fontSize: 14, color: C.inkSecondary }}>← Game World</span>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.inkMuted }}>
            switch club
            <Switcher value={club} onChange={(e) => setClub(Number(e.target.value))}>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </Switcher>
          </label>
        </Header>

        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 6 }}>
            <Title>{league.name}</Title>
            <Badge>{league.type}</Badge>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.inkMuted }}>
            {league.divisionCount} divisions · Season in progress
          </p>
        </div>

        <section>
          <SectionLabel>Standings</SectionLabel>
          {divisions.map((d) => (
            <Division key={d.divisionId} name={d.divisionName} rows={d.standings} clubId={club} />
          ))}
        </section>
      </Page>
    </div>
  );
};

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
