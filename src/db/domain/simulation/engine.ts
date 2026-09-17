import { MatchRules } from '../../../api/models';
import { RandomSimulationEngine } from './random-engine';
import { AttributeDrivenSimulationEngine } from './attribute-engine';
import { EventEnvelope } from '../events/envelope';
import { SyntheticLineup } from './synthetic-lineup';
import { PlayerGameStatsProjection } from './stat-projection';

// @spec SIM-016 SimulationEngine strategy seam — GameFactory delegates score
// production here (#190). The engine owns *what the score is*, never
// *whether/how it is written*: guards, the batch transaction, and completion
// hooks stay in GameFactory (docs/llds/game-simulation/game-simulation.md — "Simulation
// engine seam").

export interface SimulationContext {
  gameId: number;
  homeTeam: number;
  awayTeam: number;
  // @spec PARP-008,PARP-010 — additive, optional: RandomSimulationEngine reads neither.
  lineups?: { home: SyntheticLineup; away: SyntheticLineup };
  matchRules?: MatchRules;
}

export interface SimulationResult {
  homeTeamResult: number;
  awayTeamResult: number;
  // @spec PARP-007,PARP-011,PARP-012 — additive, optional: RandomSimulationEngine sets neither.
  eventChain?: EventEnvelope<unknown>[];
  playerGameStats?: PlayerGameStatsProjection[];
}

export interface SimulationEngine {
  /** Pure — no DB access, no side effects; deterministic in (seed, ctx). */
  simulateGame(ctx: SimulationContext): SimulationResult;
}

/** Domain-only (LLD e16): tests/golden master pin a seed; production passes nothing. */
export interface SimulateOptions {
  seed?: number;
}

// @spec SIM-016,SIM-021,SIM-022 — authored lineups select the production attribute engine;
// the score-only random engine remains a pure fallback for legacy/unconfigured games.
export const resolveSimulationEngine = (seed?: number): SimulationEngine => ({
  simulateGame: (ctx: SimulationContext): SimulationResult => (
    ctx.lineups
      ? new AttributeDrivenSimulationEngine(seed).simulateGame(ctx)
      : new RandomSimulationEngine(seed).simulateGame(ctx)
  ),
});
