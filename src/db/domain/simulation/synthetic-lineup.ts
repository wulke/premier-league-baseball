import { PlayerAttributes, PlayerPosition } from '../../../api/models';

// @spec PARP-015 — the lineup-read interface the resolvers consume, implemented against a
// synthetic (in-memory only) lineup; no Lineup/LineupEntry rows are read or written here.
export interface SyntheticLineupEntry {
  playerId: number;
  battingOrder: number;              // 1..9
  fieldingPosition: PlayerPosition | null;
  attributes: PlayerAttributes;      // inlined — the engine stays pure, no DB reads
}

export interface SyntheticLineup {
  teamId: number;
  battingOrder: SyntheticLineupEntry[];   // exactly 9 entries, unique playerIds (PARP-015)
  startingPitcherId: number;              // derived by the caller, never persisted separately
  // A DH lineup's pitcher is not in its batting order but still supplies pitching attributes.
  startingPitcher?: SyntheticLineupEntry;
}
