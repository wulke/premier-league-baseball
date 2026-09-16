import { DefaultMatchRules } from '../../../api/models';
import { mulberry32 } from '../identity';
import { EventEnvelope } from '../events/envelope';
import { BaserunningContext, PlateAppearanceResolutionContext } from './events';
import { SimulationContext, SimulationEngine, SimulationResult } from './engine';
import { deriveGameSeed } from './seed';
import { resolvePA } from './pa-resolver';
import { advanceRunners, BaseState } from './baserunning';
import { projectPlayerGameStats } from './stat-projection';
import { SyntheticLineup, SyntheticLineupEntry } from './synthetic-lineup';

// @spec PARP-015 — pure-function invariant, not a domain/API-boundary DomainError (backend-standards §3).
const validateLineup = (lineup: SyntheticLineup): void => {
  if (lineup.battingOrder.length !== 9) {
    throw new Error(`SyntheticLineup for team ${lineup.teamId} must have exactly 9 batting-order entries`);
  }
  const uniquePlayerIds = new Set(lineup.battingOrder.map((entry) => entry.playerId));
  if (uniquePlayerIds.size !== 9) {
    throw new Error(`SyntheticLineup for team ${lineup.teamId} has duplicate playerIds`);
  }
  if (!lineup.battingOrder.some((entry) => entry.playerId === lineup.startingPitcherId)) {
    throw new Error(`SyntheticLineup for team ${lineup.teamId} has no resolvable starting pitcher`);
  }
};

const pitcherEntry = (lineup: SyntheticLineup): SyntheticLineupEntry => (
  lineup.battingOrder.find((entry) => entry.playerId === lineup.startingPitcherId)!
);

// @spec PARP-008,PARP-009,PARP-010,PARP-011,PARP-016,PARP-017
export class AttributeDrivenSimulationEngine implements SimulationEngine {
  constructor(private readonly seed?: number) {}

  simulateGame(ctx: SimulationContext): SimulationResult {
    if (!ctx.lineups) throw new Error('AttributeDrivenSimulationEngine requires ctx.lineups');
    const { home, away } = ctx.lineups;
    validateLineup(home);   // PARP-015
    validateLineup(away);

    const innings = ctx.matchRules?.innings ?? DefaultMatchRules.innings ?? 9;   // PARP-010
    const rng = mulberry32(deriveGameSeed(this.seed ?? Date.now(), ctx.gameId));

    const eventChain: EventEnvelope<PlateAppearanceResolutionContext | BaserunningContext>[] = [];
    let sequence = 0;
    const battingIndexByTeamId: Record<number, number> = { [away.teamId]: 0, [home.teamId]: 0 };   // PARP-008

    for (let inning = 1; inning <= innings; inning += 1) {   // PARP-010
      for (const half of ['top', 'bottom'] as const) {
        const battingTeam = half === 'top' ? away : home;
        const pitchingTeam = half === 'top' ? home : away;
        const pitcher = pitcherEntry(pitchingTeam);

        let bases: BaseState = { first: null, second: null, third: null };
        let outs = 0;

        while (outs < 3) {   // PARP-009
          const entry = battingTeam.battingOrder[battingIndexByTeamId[battingTeam.teamId] % 9];
          battingIndexByTeamId[battingTeam.teamId] += 1;

          const outcome = resolvePA({ batter: entry.attributes, pitcher: pitcher.attributes, rng });   // PARP-002,016
          sequence += 1;
          const paSequence = sequence;
          eventChain.push({
            type: 'PlateAppearanceResolutionEvent',
            gameId: ctx.gameId,
            sequence: paSequence,
            causedByEventId: null,
            context: { batterId: entry.playerId, pitcherId: pitcher.playerId, battingTeamId: battingTeam.teamId, outcome },
          });

          const { bases: nextBases, transitions } = advanceRunners(bases, outcome, entry.playerId);   // PARP-004,005,006
          bases = nextBases;
          for (const t of transitions) {
            sequence += 1;
            eventChain.push({
              type: 'BaserunningEvent',
              gameId: ctx.gameId,
              sequence,
              causedByEventId: paSequence,   // PARP-007
              context: { runnerId: t.playerId, fromBase: t.from, toBase: t.to },
            });
          }

          if (outcome === 'out' || outcome === 'SO') outs += 1;   // PARP-009
        }
      }
    }

    const playerGameStats = projectPlayerGameStats(eventChain, { home, away });   // PARP-011,012

    const homePlayerIds = new Set(home.battingOrder.map((e) => e.playerId));
    const awayPlayerIds = new Set(away.battingOrder.map((e) => e.playerId));
    const homeTeamResult = playerGameStats.filter((row) => homePlayerIds.has(row.playerId)).reduce((sum, row) => sum + row.R, 0);
    const awayTeamResult = playerGameStats.filter((row) => awayPlayerIds.has(row.playerId)).reduce((sum, row) => sum + row.R, 0);

    return { homeTeamResult, awayTeamResult, eventChain, playerGameStats };
  }
}
