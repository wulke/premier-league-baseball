import { PlayerAttributes } from '../../../api/models';

// @spec PARP-001 — never a pre-combined effective value (#179); each caller owns its own
// combination. Today: flat-7 IV, EV = 0 (#191); real (IV,EV) formulas are #193's job.
export type PlayerAttributeKey =
  'contact' | 'power' | 'armStrength' | 'accuracy' | 'reaction' | 'vision' | 'discipline';

export interface AttributeRead { iv: number; ev: number; }

export const readAttribute = (
  attributes: PlayerAttributes,
  key: PlayerAttributeKey,
): AttributeRead => ({ iv: attributes[key], ev: 0 });
