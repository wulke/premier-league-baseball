// @spec SIM-017,SIM-018 per-game seed derivation (shared infra for engine impls).
// Deterministic 32-bit avalanche mix (murmur3-style finalizer) of (base, gameId):
// integer ops only — no floats, no Math.random — so a pinned base seed yields
// identical RNG streams on every machine, every run (LLD e13/e14).

export const deriveGameSeed = (base: number, gameId: number): number => {
  let h = base >>> 0;
  h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = (h ^ gameId) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
