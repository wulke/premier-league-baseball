import { RandomSimulationEngine } from './random-engine';

// @spec SIM-016 SimulationEngine strategy seam — GameFactory delegates score
// production here (#190). The engine owns *what the score is*, never
// *whether/how it is written*: guards, the batch transaction, and completion
// hooks stay in GameFactory (docs/llds/game-simulation/game-simulation.md — "Simulation
// engine seam").

export interface SimulationContext {
  gameId: number;
  homeTeam: number;
  awayTeam: number;
  // #191/#192 grow this seam: lineups, attribute reads.
}

export interface SimulationResult {
  homeTeamResult: number;
  awayTeamResult: number;
}

export interface SimulationEngine {
  /** Pure — no DB access, no side effects; deterministic in (seed, ctx). */
  simulateGame(ctx: SimulationContext): SimulationResult;
}

/** Domain-only (LLD e16): tests/golden master pin a seed; production passes nothing. */
export interface SimulateOptions {
  seed?: number;
}

export const resolveSimulationEngine = (seed?: number): SimulationEngine =>
  new RandomSimulationEngine(seed);
