// @spec PID-001,PID-002,PID-004,PID-005,PID-007,PID-008,PID-009,PID-010
export type CountryCode = 'US' | 'DO' | 'VE' | 'PR' | 'CU' | 'JP' | 'KR' | 'MX' | 'BR' | 'TW';
export type Bats = 'R' | 'L' | 'S';
export type Throws = 'R' | 'L';

export interface LeagueComposition extends Partial<Record<CountryCode, number>> {}

export interface PlayerIdentity {
  givenName: string;
  familyName: string;
  countryCode: CountryCode;
  bats: Bats;
  throws: Throws;
  birthDate: Date;
}

export const POOLS: Record<CountryCode, { givenNames: string[]; familyNames: string[] }> = {
  US: { givenNames: ['James', 'Michael', 'David', 'Marcus'], familyNames: ['Williams', 'Johnson', 'Miller', 'Davis'] },
  DO: { givenNames: ['Juan', 'José', 'Rafael', 'Miguel'], familyNames: ['Rodríguez', 'Martínez', 'Santos', 'Ramírez'] },
  VE: { givenNames: ['Luis', 'Carlos', 'Andrés', 'José'], familyNames: ['González', 'Pérez', 'Hernández', 'Suárez'] },
  PR: { givenNames: ['Javier', 'Carlos', 'Edwin', 'Luis'], familyNames: ['Rivera', 'Ortiz', 'Díaz', 'Santiago'] },
  CU: { givenNames: ['Yordan', 'Yoan', 'Adolis', 'Lourdes'], familyNames: ['Álvarez', 'Moncada', 'García', 'Gurriel'] },
  JP: { givenNames: ['Shohei', 'Yuki', 'Takumi', 'Daiki'], familyNames: ['Tanaka', 'Sato', 'Suzuki', 'Yamamoto'] },
  KR: { givenNames: ['Min-jun', 'Ji-hoon', 'Seung-min', 'Hyun-woo'], familyNames: ['Kim', 'Lee', 'Park', 'Choi'] },
  MX: { givenNames: ['Alejandro', 'Héctor', 'Diego', 'Manuel'], familyNames: ['López', 'García', 'Castillo', 'Torres'] },
  BR: { givenNames: ['Lucas', 'Rafael', 'Matheus', 'Thiago'], familyNames: ['Silva', 'Souza', 'Oliveira', 'Pereira'] },
  TW: { givenNames: ['Wei', 'Chih', 'Yu', 'Tzu'], familyNames: ['Chen', 'Lin', 'Wang', 'Chang'] },
};

export const LEAGUE_COMPOSITIONS: Record<string, LeagueComposition> = {
  PREMIER_LEAGUE: { US: 55, DO: 12, VE: 8, PR: 5, CU: 3, JP: 4, KR: 3, MX: 5, BR: 3, TW: 2 },
  NPB: { JP: 75, US: 8, DO: 4, VE: 3, KR: 3, TW: 3, MX: 2, CU: 1, BR: 1 },
  KBO: { KR: 78, US: 7, JP: 3, DO: 3, VE: 3, TW: 3, MX: 1, CU: 1, BR: 1 },
};

// @spec PID-005
// ELI5: this turns one starting number (the seed) into the same repeatable stream
// of seemingly random numbers every time. Each call mixes the number a few times
// and returns a decimal from 0 up to (but not including) 1, then keeps the mixed
// number for the next call. That lets roster generation make random-looking choices
// while tests and replays can reproduce the exact same roster from the same seed.
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

// @spec PID-002,PID-010
export const resolveComposition = (compositionKey?: string): LeagueComposition => (
  LEAGUE_COMPOSITIONS[compositionKey ?? ''] ?? LEAGUE_COMPOSITIONS.PREMIER_LEAGUE
);

const weightedPick = <T>(entries: Array<[T, number]>, rng: () => number): T => {
  if (entries.length === 0) throw new Error('Identity composition must contain a positive country weight');
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return value;
  }
  return entries[entries.length - 1][0];
};

// @spec PID-001,PID-004,PID-007,PID-008,PID-009
export const generateIdentity = (
  composition: LeagueComposition,
  rng: () => number,
  gameWorldYear = new Date().getUTCFullYear(),
): PlayerIdentity => {
  const countries = (Object.keys(composition) as CountryCode[])
    .map((country) => [country, composition[country]] as [CountryCode, number | undefined])
    .filter((entry): entry is [CountryCode, number] => entry[1] != null && entry[1] > 0);
  const countryCode = weightedPick(countries, rng);
  const pool = POOLS[countryCode];
  if (!pool || pool.givenNames.length === 0 || pool.familyNames.length === 0) {
    throw new Error(`Identity pool for '${countryCode}' must be curated and non-empty`);
  }

  const pick = <T>(values: T[]): T => values[Math.floor(rng() * values.length)];
  const age = 18 + Math.floor(rng() * 21);
  // Days 1–28 are valid for every month, avoiding month-length branching while
  // preserving a uniform month/day draw for generated birth dates.
  const birthDate = new Date(Date.UTC(gameWorldYear - age, Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)));

  return {
    countryCode,
    givenName: pick(pool.givenNames),
    familyName: pick(pool.familyNames),
    bats: weightedPick<Bats>([['R', 70], ['L', 25], ['S', 5]], rng),
    throws: weightedPick<Throws>([['R', 75], ['L', 25]], rng),
    birthDate,
  };
};
