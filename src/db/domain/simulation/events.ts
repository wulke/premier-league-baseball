import { PAOutcome } from './pa-resolver';

// @spec PARP-002 — the only two Depth-0-real event types from the worked taxonomy
// (docs/architecture/design/event-taxonomy-baseball-worked-example.md, #219).
export interface PlateAppearanceResolutionContext {
  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  outcome: PAOutcome;
}

// @spec PARP-007 — one instance per transitioning runner, including the batter.
export interface BaserunningContext {
  runnerId: number;
  fromBase: 'batter' | 'first' | 'second' | 'third';
  toBase: 'first' | 'second' | 'third' | 'home';
}
