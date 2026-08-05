/**
 * #143 Identity-generation prototype — generation logic.
 *
 * THROWAWAY PROTOTYPE (branch prototype/143-identity-generation). NOT production.
 *
 * Decisions baked in here come straight from the closed tickets:
 *  - #141 field set: givenName, familyName, countryCode (ISO-a2), bats (L|R|S),
 *    throws (L|R), birthDate (DATE). displayName is derived, never stored.
 *  - #142 approach: pick country FIRST then draw from its pool; curated lists
 *    (no faker); bats/throws INDEPENDENT random, no country correlation.
 *
 * Open tunables (judged against sample-output.md): country weights (pools.ts),
 * bats/throws distributions, birthDate age band, gender handling.
 *
 * `rng` is injectable so the sample dump is reproducible (mulberry32 seed) and so
 * the real generateRoster can be unit-tested with a fixed seed later (#142 ask).
 */

import { COUNTRIES, CountryPool } from './pools';

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

/** Weighted pick over the country table (weights normalized). */
export function pickCountry(rng: () => number, pool: CountryPool[] = COUNTRIES): CountryPool {
  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  let r = rng() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
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
 * Build one identity. `referenceYear` = the GameWorld year (birthDate computed
 * so the player is MIN_AGE..MAX_AGE at that year). In production, birthDate is
 * stored and age derived at read time; here we carry age for the dump only.
 */
export function generateIdentity(rng: () => number, referenceYear: number): PlayerIdentity {
  const country = pickCountry(rng);
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

export { COUNTRIES };
