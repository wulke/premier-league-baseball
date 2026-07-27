// Savant-page helpers + mock player/roster data. Shared by the three Savant
// pages (standings / team / player). Mock — illustrative only, not real stats.
import { teams } from "../../shared/tokens";

// ── percentile color scale (moved here from app.tsx) ──────────────────────
const STOPS: [number, [number, number, number]][] = [
  [0, [215, 25, 32]],     // #d71920 worst
  [50, [253, 225, 0]],    // #fde100 avg
  [100, [27, 110, 59]],   // #1b6e3b elite
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const percentileColor = (pct: number): string => {
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (pct >= STOPS[i][0] && pct <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const t = (pct - lo[0]) / (hi[0] - lo[0] || 1);
  const r = Math.round(lerp(lo[1][0], hi[1][0], t));
  const g = Math.round(lerp(lo[1][1], hi[1][1], t));
  const b = Math.round(lerp(lo[1][2], hi[1][2], t));
  return `rgb(${r}, ${g}, ${b})`;
};
export const inkOn = (pct: number) => (pct < 32 || pct > 70 ? "#ffffff" : "#14213d");

// pythagorean expectation: W% ≈ RF² / (RF² + RA²)
export const pyth = (rf: number, ra: number) => {
  const a = rf * rf, b = ra * ra;
  return a / (a + b);
};

// ── deterministic per-player RNG so values are stable across renders ─────
const rng = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

// ── player stat definitions (batting-flavored, clearly illustrative) ─────
type StatCat = "avg" | "power" | "discipline" | "battedball";
type StatDef = { key: string; label: string; cat: StatCat; min: number; max: number; fmt: (v: number) => string; invert?: boolean };
export const STAT_DEFS: StatDef[] = [
  { key: "xavg", label: "xBA", cat: "avg", min: 0.2, max: 0.34, fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "xobp", label: "xOBP", cat: "avg", min: 0.28, max: 0.42, fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "xslg", label: "xSLG", cat: "power", min: 0.35, max: 0.6, fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "ops", label: "OPS", cat: "power", min: 0.65, max: 1.0, fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "hr", label: "HR", cat: "power", min: 4, max: 46, fmt: (v) => String(Math.round(v)) },
  { key: "rbi", label: "RBI", cat: "power", min: 18, max: 115, fmt: (v) => String(Math.round(v)) },
  { key: "sb", label: "SB", cat: "avg", min: 0, max: 42, fmt: (v) => String(Math.round(v)) },
  { key: "bbpct", label: "BB%", cat: "discipline", min: 0.05, max: 0.18, fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "kpct", label: "K%", cat: "discipline", min: 0.1, max: 0.32, fmt: (v) => `${(v * 100).toFixed(1)}%`, invert: true },
  { key: "hhpct", label: "HardHit%", cat: "battedball", min: 0.3, max: 0.56, fmt: (v) => `${(v * 100).toFixed(1)}%` },
];

export type PlayerStat = { raw: string; percentile: number };
export type Player = {
  id: number;
  teamId: number;
  name: string;
  pos: "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" | "DH";
  hand: "L" | "R" | "S";
  stats: Record<string, PlayerStat>;
  slash: { avg: string; obp: string; slg: string; ops: string };
  form: ("W" | "D" | "L")[]; // borrowed shape for the "last 10" strip (team results)
};

const FIRST = ["Marcus", "Diego", "Hiro", "Caleb", "Theo", "Niko", "Beau", "Rashid", "Eli", "Tomas", "Joon", "Pavel", "Deshawn", "Finn", "Mateo"];
const LAST = ["Vega", "Okafor", "Lindqvist", "Reyes", "Bauer", "Castillo", "Ndlovu", "Park", "Sullivan", "Marsh", "Adeyemi", "Costa", "Holloway", "Becker", "Suzuki"];
const POS: Player["pos"][] = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const HAND: Player["hand"][] = ["L", "R", "S"];

export const getPlayer = (id: number): Player => {
  const teamId = Math.floor(id / 100);
  const idx = id % 100;
  const r = rng(id * 2654435761);
  const name = `${FIRST[(teamId * 3 + idx) % FIRST.length]} ${LAST[(teamId * 5 + idx * 2) % LAST.length]}`;
  const pos = POS[(idx - 1) % POS.length];
  const hand = HAND[Math.floor(r() * HAND.length)];
  const stats: Record<string, PlayerStat> = {};
  let avgV = 0, obpV = 0, slgV = 0, opsV = 0;
  for (const d of STAT_DEFS) {
    const p = Math.round(6 + r() * 90); // 6..96
    // invert: lower raw is better (K%) → high percentile should mean LOW raw
    const frac = d.invert ? 1 - p / 100 : p / 100;
    const v = d.min + frac * (d.max - d.min);
    stats[d.key] = { raw: d.fmt(v), percentile: p };
    if (d.key === "xavg") avgV = v;
    if (d.key === "xobp") obpV = v;
    if (d.key === "xslg") slgV = v;
    if (d.key === "ops") opsV = v;
  }
  // ensure OPS roughly consistent: prefer obp+slg over the generated ops
  const opsConsistent = obpV + slgV;
  stats.ops = { raw: opsConsistent.toFixed(3).replace(/^0/, ""), percentile: stats.ops.percentile };
  return {
    id, teamId, name, pos, hand,
    stats,
    slash: {
      avg: avgV.toFixed(3).replace(/^0/, ""),
      obp: obpV.toFixed(3).replace(/^0/, ""),
      slg: slgV.toFixed(3).replace(/^0/, ""),
      ops: opsConsistent.toFixed(3).replace(/^0/, ""),
    },
    form: ["W", "L", "W", "W", "L", "D", "W", "L", "W", "W"].slice(Math.floor(r() * 3), Math.floor(r() * 3) + 5) as any,
  };
};

export const rosterFor = (teamId: number): Player[] =>
  [1, 2, 3, 4, 5].map((i) => getPlayer(teamId * 100 + i));

export const starOf = (teamId: number): Player =>
  rosterFor(teamId).reduce((best, p) => (Number(p.slash.ops) > Number(best.slash.ops) ? p : best));

export const teamName = (teamId: number) =>
  teams.find((t) => t.teamId === teamId)?.name ?? `Team ${teamId}`;
