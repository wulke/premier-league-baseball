/**
 * #143 Identity-generation prototype — per-league nationality compositions.
 *
 * THROWAWAY PROTOTYPE (branch prototype/143-identity-generation). NOT production.
 *
 * The KEY structural decision for global-league support: nationality WEIGHTS are
 * a property of the LEAGUE, not a global constant. `pools.ts` is a shared registry
 * of countries + name pools (league-agnostic); each league supplies its own weight
 * vector over those countries. So the same generator/pools serve an MLB-style
 * league, KBO (Korea), NPB (Japan), or any future league — only the weights change.
 *
 * Codes MUST exist in the COUNTRIES registry (pools.ts). To support a new region,
 * add the country to the registry + a composition referencing it.
 */

export interface CountryWeight {
  code: string; // ISO 3166-1 alpha-2; must exist in pools.ts COUNTRIES
  weight: number;
}

export interface LeagueComposition {
  name: string;
  weights: CountryWeight[];
}

/**
 * The app's default league. "Premier League Baseball" is a top-tier international
 * league, so the v1 skew is MLB-ish (research/name-country-generation.md Section E).
 * Tune to taste — this is a #143 decision, not a fixed constant of nature.
 */
export const PREMIER_LEAGUE: LeagueComposition = {
  name: 'Premier League Baseball',
  weights: [
    { code: 'US', weight: 0.55 },
    { code: 'DO', weight: 0.10 },
    { code: 'VE', weight: 0.06 },
    { code: 'CU', weight: 0.04 },
    { code: 'PR', weight: 0.04 },
    { code: 'MX', weight: 0.05 },
    { code: 'CA', weight: 0.03 },
    { code: 'JP', weight: 0.04 },
    { code: 'KR', weight: 0.03 },
    { code: 'TW', weight: 0.01 },
  ],
};

/** KBO-style: Korea-dominant with a small foreign-player contingent. */
export const KBO: LeagueComposition = {
  name: 'KBO (Korea)',
  weights: [
    { code: 'KR', weight: 0.88 },
    { code: 'US', weight: 0.04 },
    { code: 'DO', weight: 0.03 },
    { code: 'VE', weight: 0.03 },
    { code: 'CU', weight: 0.02 },
  ],
};

/** NPB-style: Japan-dominant with a small foreign-player contingent. */
export const NPB: LeagueComposition = {
  name: 'NPB (Japan)',
  weights: [
    { code: 'JP', weight: 0.88 },
    { code: 'US', weight: 0.04 },
    { code: 'DO', weight: 0.03 },
    { code: 'VE', weight: 0.03 },
    { code: 'CU', weight: 0.02 },
  ],
};

export const COMPOSITIONS: LeagueComposition[] = [PREMIER_LEAGUE, KBO, NPB];
