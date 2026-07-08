import { describe, it, expect } from 'vitest';
import { templateFor } from '../src/writers/eventTemplates.js';

let seq = 0;
const ev = (period, type, team = null, playerId = null, payload = {}) => ({
  seq: ++seq,
  ts: 0,
  period,
  type,
  team,
  playerId,
  payload,
});

describe('templateFor (inspector defaults follow the log)', () => {
  seq = 0;
  const events = [
    ev(1, 'PERIOD_START', null, null, { period: 1 }),
    ev(1, 'SHOT_MADE', 'home', 'H1', { points: 2 }),
    ev(1, 'FT_MADE', 'home', 'H1', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
  ];

  it('CORRECTION defaults to voiding the LATEST event, never #1', () => {
    expect(templateFor('CORRECTION', events).voidsSeq).toBe(3);
    expect(templateFor('CORRECTION', []).voidsSeq).toBe(1);
  });

  it('an FT following "1 of 2" defaults to "2 of 2" with the same context', () => {
    expect(templateFor('FT_MISSED', events)).toMatchObject({
      attemptOf: { n: 2, of: 2 },
      context: 'bonus',
    });
  });

  it('a completed FT sequence resets the next FT template to attempt 1', () => {
    seq = 3;
    const completed = [...events, ev(1, 'FT_MISSED', 'home', 'H1', { attemptOf: { n: 2, of: 2 }, context: 'bonus' })];
    expect(templateFor('FT_MADE', completed).attemptOf).toEqual({ n: 1, of: 2 });
  });

  it('PERIOD_START advances; PERIOD_END/LAST_TWO_START stay in the current period', () => {
    expect(templateFor('PERIOD_START', events).period).toBe(2);
    expect(templateFor('PERIOD_END', events).period).toBe(1);
    expect(templateFor('LAST_TWO_START', events).period).toBe(1);
  });
});
