/**
 * #143 Identity-generation prototype — sample-output dump (CLI).
 *
 * THROWAWAY PROTOTYPE. Run:  npx ts-node prototype/143-identity-generation/dump.ts
 * (Seeded → stable output so the committed sample-output.md is reproducible.)
 *
 * Produces two views to react to:
 *   1. One sample team roster — does it look like real *people*?
 *   2. League-wide distribution (8 teams) — do country / handedness shares
 *      match the intended weights?
 */

import { COUNTRIES } from './pools';
import { generateIdentity, makeRng, PlayerIdentity } from './generate';

const REFERENCE_YEAR = 2025;
const MIN_ROSTER = 20;
const MAX_ROSTER = 30;

const display = (p: PlayerIdentity) => `${p.givenName} ${p.familyName}`;
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

function rosterSize(rng: () => number): number {
  return MIN_ROSTER + Math.floor(rng() * (MAX_ROSTER - MIN_ROSTER + 1));
}

const countryByCode = new Map(COUNTRIES.map((c) => [c.code, c]));

function teamRoster(rng: () => number, size: number): PlayerIdentity[] {
  return Array.from({ length: size }, () => generateIdentity(rng, REFERENCE_YEAR));
}

function printTeam(name: string, roster: PlayerIdentity[]): void {
  const sorted = [...roster].sort(
    (a, b) =>
      a.countryCode.localeCompare(b.countryCode) ||
      a.familyName.localeCompare(b.familyName) ||
      a.givenName.localeCompare(b.givenName)
  );
  console.log(`### ${name}  (${roster.length} players)\n`);
  console.log(`| # | Player | Country | Bats | Throws | Age | DOB |`);
  console.log(`|---|---|---|---|---|---|---|`);
  sorted.forEach((p, i) => {
    const c = countryByCode.get(p.countryCode)!;
    console.log(
      `| ${i + 1} | ${display(p)} | ${c.flag} ${p.countryCode} | ${p.bats} | ${p.throws} | ${p.age} | ${p.birthDate} |`
    );
  });
  console.log('');
}

function dist(counts: Map<string, number>, total: number, keys: string[]): string {
  return keys
    .map((k) => {
      const n = counts.get(k) ?? 0;
      const pct = ((n / total) * 100).toFixed(1);
      return `${k}: ${n} (${pct}%)`;
    })
    .join(' · ');
}

function printSummary(players: PlayerIdentity[]): void {
  const total = players.length;
  const cc = new Map<string, number>();
  const bats = new Map<string, number>();
  const throws = new Map<string, number>();
  for (const p of players) {
    cc.set(p.countryCode, (cc.get(p.countryCode) ?? 0) + 1);
    bats.set(p.bats, (bats.get(p.bats) ?? 0) + 1);
    throws.set(p.throws, (throws.get(p.throws) ?? 0) + 1);
  }

  console.log(`### League distribution  (${total} players across 8 teams)\n`);
  console.log(`**Country shares** (intended weight → actual):\n`);
  console.log(`| Country | Intended | Actual |`);
  console.log(`|---|---|---|`);
  for (const c of COUNTRIES) {
    const n = cc.get(c.code) ?? 0;
    console.log(
      `| ${c.flag} ${c.code} ${c.display} | ${(c.weight * 100).toFixed(0)}% | ${n} (${((n / total) * 100).toFixed(1)}%) |`
    );
  }
  const covered = COUNTRIES.reduce((s, c) => s + (cc.get(c.code) ?? 0), 0);
  console.log(`\n*Coverage:* ${covered}/${total} players fall in the 10 listed countries.\n`);

  console.log(`**Handedness** (intended → actual):\n`);
  console.log(`- Bats — ${dist(bats, total, ['R', 'L', 'S'])}  _(intended R .70 / L .25 / S .05)_`);
  console.log(`- Throws — ${dist(throws, total, ['R', 'L'])}  _(intended R .75 / L .25)_\n`);

  // Age band sanity
  const ages = players.map((p) => p.age);
  console.log(
    `**Age** — min ${Math.min(...ages)}, max ${Math.max(...ages)}, band ${Math.min(...ages)}–${Math.max(
      ...ages
    )} _(intended 18–38)_\n`
  );
}

function main(): void {
  const rng = makeRng(143);

  console.log('# #143 Identity generation — sample output\n');
  console.log(
    '> THROWAWAY PROTOTYPE. Seeded RNG (`mulberry32`, seed 143) → reproducible. ' +
      `Reference year ${REFERENCE_YEAR}. Rosters sized ${MIN_ROSTER}–${MAX_ROSTER} (real PCON-010 range). ` +
      'Realism is the thing to judge here — *people*, international flavor, Caribbean distinctness.\n'
  );

  printTeam('Sample team A', teamRoster(rng, rosterSize(rng)));

  // League: 8 teams, independent rosters.
  const league: PlayerIdentity[] = [];
  for (let t = 0; t < 8; t++) {
    league.push(...teamRoster(rng, rosterSize(rng)));
  }
  printSummary(league);
}

main();
