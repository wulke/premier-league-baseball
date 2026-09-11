import { PlayerPosition } from '../api/models';

// @spec PDETUI-007,ROSTUI-011 — one display vocabulary for every UI surface that
// renders a PlayerPosition enum value.
const positionLabels: Record<PlayerPosition, string> = {
  Pitcher: 'P',
  Catcher: 'C',
  FirstBase: '1B',
  SecondBase: '2B',
  ThirdBase: '3B',
  Shortstop: 'SS',
  LeftField: 'LF',
  CenterField: 'CF',
  RightField: 'RF',
};

export { positionLabels };
