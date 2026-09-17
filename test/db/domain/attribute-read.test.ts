import { readAttribute } from '../../../src/db/domain';
import { PlayerAttributes } from '../../../src/api/models';

// @spec PARP-001,PARP-019 (attribute-read seam and PA IV/EV combination — unit level)
// Gherkin pairing: none — see docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md
// Traceability ("PARP-001 ... routed to unit tests instead").

const attributes: PlayerAttributes = {
  contact: 42, power: 77, armStrength: 13, accuracy: 90, reaction: 55, vision: 61, discipline: 8,
  positions: {} as any, pitches: [],
  ivEv: {
    contact: { iv: 42, ev: 17 }, power: { iv: 77, ev: -3 }, armStrength: { iv: 13, ev: 2 },
    accuracy: { iv: 90, ev: 4 }, reaction: { iv: 55, ev: 0 }, vision: { iv: 61, ev: 9 }, discipline: { iv: 8, ev: 12 },
  },
};

describe('readAttribute (PARP-001)', () => {
  it('returns the persisted IV/EV pair without pre-combining it', () => {
    (['contact', 'power', 'armStrength', 'accuracy', 'reaction', 'vision', 'discipline'] as const).forEach((key) => {
      expect(readAttribute(attributes, key)).toStrictEqual(attributes.ivEv![key]);
    });
  });

  it('never pre-combines — each read is independent of every other attribute on the same Player', () => {
    const contactRead = readAttribute(attributes, 'contact');
    const powerRead = readAttribute(attributes, 'power');
    expect(contactRead).toStrictEqual({ iv: 42, ev: 17 });
    expect(powerRead).toStrictEqual({ iv: 77, ev: -3 });
  });

  it('uses the legacy scalar as IV with neutral EV only when the persisted tuple is absent', () => {
    const { ivEv: _legacyTuple, ...legacyAttributes } = attributes;
    expect(readAttribute(legacyAttributes, 'contact')).toStrictEqual({ iv: 42, ev: 0 });
  });
});
