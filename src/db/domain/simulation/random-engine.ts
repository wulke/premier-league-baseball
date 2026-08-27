import { mulberry32 } from '../identity';
import { SimulationContext, SimulationEngine, SimulationResult } from './engine';
import { deriveGameSeed } from './seed';

// @spec SIM-016,SIM-017,SIM-018 — preserves the pre-seam behavior exactly:
// two independent floor(rng() * 10) draws in [0, 9], home drawn first
// (LLD e8/e15). mulberry32 is the existing identity-gen RNG (#143).

export class RandomSimulationEngine implements SimulationEngine {
  constructor(private readonly seed?: number) {}

  simulateGame(ctx: SimulationContext): SimulationResult {
    const rng = mulberry32(deriveGameSeed(this.seed ?? Date.now(), ctx.gameId));
    const homeTeamResult = Math.floor(rng() * 10); // draw 1: home
    const awayTeamResult = Math.floor(rng() * 10); // draw 2: away
    return { homeTeamResult, awayTeamResult };
  }
}
