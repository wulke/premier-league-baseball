import db from '../../../src/db/client';
import { GameFactory, resolveSimulationEngine } from '../../../src/db/domain';
import { RandomSimulationEngine } from '../../../src/db/domain/simulation/random-engine';
import { deriveGameSeed } from '../../../src/db/domain/simulation/seed';

// @spec SIM-016..SIM-018 (simulation engine seam — unit level)
// Gherkin pairing: test/bdd/features/simulate-game.feature (domain-direct steps).
// See docs/llds/game-simulation.md — "Simulation engine seam" and e13..e17.

describe('simulation engine seam', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  describe('deriveGameSeed (SIM-017/SIM-018 mechanics)', () => {
    it('is deterministic for the same (base, gameId)', () => {
      for (let i = 0; i < 50; i++) {
        const base = 1_000_000 + i;
        expect(deriveGameSeed(base, 7)).toBe(deriveGameSeed(base, 7));
      }
    });

    it('separates distinct gameIds under one base (no intra-batch collisions, e13)', () => {
      const seeds = new Set<number>();
      for (let gameId = 1; gameId <= 50; gameId++) {
        seeds.add(deriveGameSeed(4242, gameId));
      }
      expect(seeds.size).toBe(50);
    });

    it('returns a uint32 for any inputs (integer ops only, e14)', () => {
      expect(Number.isInteger(deriveGameSeed(0, 0))).toBe(true);
      expect(deriveGameSeed(Date.now(), 12345)).toBeGreaterThanOrEqual(0);
      expect(deriveGameSeed(Date.now(), 12345)).toBeLessThanOrEqual(0xffffffff);
    });
  });

  describe('RandomSimulationEngine', () => {
    it('reproduces scores for the same seed and context across instances (SIM-017)', () => {
      const ctx = { gameId: 9, homeTeam: 1, awayTeam: 2 };
      const first = new RandomSimulationEngine(4242).simulateGame(ctx);
      const second = new RandomSimulationEngine(4242).simulateGame(ctx);
      expect(second).toStrictEqual(first);
    });

    it('keeps scores in [0, 9] (e8 — behavior preserved)', () => {
      const engine = new RandomSimulationEngine(777);
      for (let gameId = 1; gameId <= 100; gameId++) {
        const { homeTeamResult, awayTeamResult } = engine.simulateGame({
          gameId,
          homeTeam: 1,
          awayTeam: 2,
        });
        expect(homeTeamResult).toBeGreaterThanOrEqual(0);
        expect(homeTeamResult).toBeLessThanOrEqual(9);
        expect(awayTeamResult).toBeGreaterThanOrEqual(0);
        expect(awayTeamResult).toBeLessThanOrEqual(9);
        expect(Number.isInteger(homeTeamResult)).toBe(true);
        expect(Number.isInteger(awayTeamResult)).toBe(true);
      }
    });

    it('varies scores across gameIds under one seed (per-game streams)', () => {
      const engine = new RandomSimulationEngine(4242);
      const pairs = new Set<string>();
      for (let gameId = 1; gameId <= 10; gameId++) {
        const r = engine.simulateGame({ gameId, homeTeam: 1, awayTeam: 2 });
        pairs.add(`${r.homeTeamResult}-${r.awayTeamResult}`);
      }
      expect(pairs.size).toBeGreaterThan(1);
    });

    it('varies scores across seeds for one gameId', () => {
      const pairs = new Set<string>();
      for (let seed = 1; seed <= 10; seed++) {
        const r = new RandomSimulationEngine(seed).simulateGame({ gameId: 9, homeTeam: 1, awayTeam: 2 });
        pairs.add(`${r.homeTeamResult}-${r.awayTeamResult}`);
      }
      expect(pairs.size).toBeGreaterThan(1);
    });
  });

  describe('golden master (SIM-017)', () => {
    // Literal pin — machine-independent by construction (deriveGameSeed uses
    // integer ops only; LLD e13/e14). If this breaks, draw order or derivation
    // drifted: fail loudly, do not "fix" the literal (e15).
    it('pins the literal score pair for seed 4242, gameId 7', () => {
      expect(new RandomSimulationEngine(4242).simulateGame({ gameId: 7, homeTeam: 1, awayTeam: 2 }))
        .toStrictEqual({ homeTeamResult: 2, awayTeamResult: 8 });
    });

    it('pins a second literal pair (seed 99, gameId 12345)', () => {
      expect(new RandomSimulationEngine(99).simulateGame({ gameId: 12345, homeTeam: 3, awayTeam: 4 }))
        .toStrictEqual({ homeTeamResult: 8, awayTeamResult: 4 });
    });
  });

  describe('GameFactory delegation (#190)', () => {
    it('delegates score production to the engine (SIM-016)', async () => {
      const game = await GameFactory().create(1, 2);
      const simulated = await GameFactory(game.id).simulate({ seed: 4242 });
      const expected = resolveSimulationEngine(4242).simulateGame({
        gameId: game.id,
        homeTeam: 1,
        awayTeam: 2,
      });
      expect(simulated.homeTeamResult).toBe(expected.homeTeamResult);
      expect(simulated.awayTeamResult).toBe(expected.awayTeamResult);
    });

    it('exposes no unguarded result() writer (LLD e4 — removed)', () => {
      expect((GameFactory(1) as any).result).toBeUndefined();
    });

    it('varies scores without a seed (SIM-018 — fresh per-game seed)', async () => {
      const pairs = new Set<string>();
      for (let i = 0; i < 15; i++) {
        const game = await GameFactory().create(1, 2);
        const simulated = await GameFactory(game.id).simulate();
        pairs.add(`${simulated.homeTeamResult}-${simulated.awayTeamResult}`);
      }
      expect(pairs.size).toBeGreaterThan(1);
    });
  });
});
