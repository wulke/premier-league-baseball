/**
 * #143 Identity-generation prototype — generation logic.
 *
 * THROWAWAY PROTOTYPE (branch prototype/143-identity-generation). NOT production.
 *
 * Decisions baked in here come straight from the closed tickets + this ticket:
 *  - #141 field set: givenName, familyName, countryCode (ISO-a2), bats (L|R|S),
 *    throws (L|R), birthDate (DATE). displayName is derived, never stored.
 *  - #142 approach: pick country FIRST then draw from its pool; curated lists
 *    (no faker); bats/throws INDEPENDENT random, no country correlation.
 *  - #143 structure: nationality weights are a per-league COMPOSITION (not a
 *    global constant) → generator is league-agnostic (MLB / KBO / NPB / any).
 *
 * Open tunables (judged against sample-output.md): per-league weights
 * (compositions.ts), bats/throws distributions, birthDate age band, gender handling.
 *
 * `rng` is injectable so the sample dump is reproducible (mulberry32 seed) and so
 * the real generateRoster can be unit-tested with a fixed seed later (#142 ask).
 */

import { COUNTRIES, CountryPool } from './pools';
import { LeagueComposition } from './compositions';

export type BatHand = 'L' | 'R' | 'S';
export type ThrowHand = 'L' | 'R';

export interface PlayerIdentity {
  givenName: string;
  familyName: string;
  countryCode: string; // ISO 3166-1 alpha-2
  bats: BatHand;
  throws: ThrowHand;
  birthDate: string; // ISO yyyy-mm-dd
  age: number; // derived from birthDate + reference year (for the dump only)
}

/** Country registry lookup (code → pool). */
const REGISTRY = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Deterministic RNG (mulberry32). Seeded so the sample dump is stable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dedupe = (xs: string[]): string[] => Array.from(new Set(xs));

/**
 * Weighted country pick over the league's composition. Only countries listed in
 * the composition can be drawn — so a KBO composition never yields a US-majority
 * roster. Resolves the chosen code to its pool via the shared registry.
 */
export function pickCountry(rng: () => number, composition: LeagueComposition): CountryPool {
  const total = composition.weights.reduce((sum, w) => sum + w.weight, 0);
  let r = rng() * total;
  for (const w of composition.weights) {
    r -= w.weight;
    if (r <= 0) return REGISTRY.get(w.code)!;
  }
  return REGISTRY.get(composition.weights[composition.weights.length - 1].code)!;
}

function pick<T>(rng: () => number, xs: T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

// v1 distributions per #142 Section F. TUNE in the prototype.
const BATS: { value: BatHand; weight: number }[] = [
  { value: 'R', weight: 0.70 },
  { value: 'L', weight: 0.25 },
  { value: 'S', weight: 0.05 },
];
const THROWS: { value: ThrowHand; weight: number }[] = [
  { value: 'R', weight: 0.75 },
  { value: 'L', weight: 0.25 },
];

function weighted<V extends string>(
  rng: () => number,
  opts: { value: V; weight: number }[]
): V {
  const total = opts.reduce((s, o) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of opts) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return opts[opts.length - 1].value;
}

/** Age band for the prototype. TUNE — open decision (#142 flagged range to #143). */
const MIN_AGE = 18;
const MAX_AGE = 38;

/**
 * Build one identity for a player in the given league. `referenceYear` = the
 * GameWorld year (birthDate computed so the player is MIN_AGE..MAX_AGE at that
 * year). In production, birthDate is stored and age derived at read time; here we
 * carry age for the dump only.
 */
export function generateIdentity(
  rng: () => number,
  referenceYear: number,
  composition: LeagueComposition
): PlayerIdentity {
  const country = pickCountry(rng, composition);
  const given = pick(rng, dedupe(country.given));
  const family = pick(rng, dedupe(country.family));
  const bats = weighted(rng, BATS);
  const throws = weighted(rng, THROWS);

  const age = MIN_AGE + Math.floor(rng() * (MAX_AGE - MIN_AGE + 1));
  const birthYear = referenceYear - age;
  const birthMonth = 1 + Math.floor(rng() * 12);
  const birthDay = 1 + Math.floor(rng() * 28); // safe across months
  const pad = (n: number) => String(n).padStart(2, '0');
  const birthDate = `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`;

  return {
    givenName: given,
    familyName: family,
    countryCode: country.code,
    bats,
    throws,
    birthDate,
    age,
  };
}
