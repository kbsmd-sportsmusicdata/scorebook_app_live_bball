// Score expectations lifted from the scenario event arrays in
// spec/test-scenarios.md (the full foul/bonus assertions are Phase 2 —
// only scoreReducer's slice of each scenario is asserted here).
import { describe, it, expect } from 'vitest';
import { scoreReducer } from '../src/reducers/scoreReducer.js';

// Compact scenario-notation builder: seq/ts stamped, period explicit.
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
const reset = () => {
  seq = 0;
};

describe('scoreReducer', () => {
  it('Scenario 1 (score slice): bonus FT pair after the 5th team foul → home 1, away 0', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'FOUL', 'away', 'A22', { foulType: 'personal', shooting: false }),
      ev(1, 'FOUL', 'away', 'A5', { foulType: 'personal', shooting: false }),
      ev(1, 'FOUL', 'away', 'A22', { foulType: 'personal', shooting: false }),
      ev(1, 'FOUL', 'away', 'A14', { foulType: 'personal', shooting: false }),
      ev(1, 'FOUL', 'away', 'A5', { foulType: 'personal', shooting: false }),
      ev(1, 'FT_MADE', 'home', 'H10', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
      ev(1, 'FT_MISSED', 'home', 'H10', { attemptOf: { n: 2, of: 2 }, context: 'bonus' }),
    ];
    expect(scoreReducer(events)).toMatchObject({ home: 1, away: 0 });
  });

  it('Scenario 4 (score slice): and-one → home 3, away 0', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'SHOT_MADE', 'home', 'H32', { points: 2 }),
      ev(1, 'FOUL', 'away', 'A5', { foulType: 'personal', shooting: true, andOne: true, fouledPlayer: 'H32' }),
      ev(1, 'FT_MADE', 'home', 'H32', { attemptOf: { n: 1, of: 1 }, context: 'andOne' }),
    ];
    expect(scoreReducer(events)).toMatchObject({ home: 3, away: 0 });
  });

  it('Scenario 9 (score slice): period splits gain an OT column, running total continuous', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'SHOT_MADE', 'home', 'H32', { points: 3 }),
      ev(1, 'SHOT_MADE', 'away', 'A22', { points: 2 }),
      ev(1, 'PERIOD_END'),
      ev(5, 'PERIOD_START'), // OT — fresh period, splits must show it separately
      ev(5, 'FT_MADE', 'away', 'A5', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
      ev(5, 'SHOT_MADE', 'home', 'H10', { points: 2 }),
    ];
    expect(scoreReducer(events)).toEqual({
      home: 5,
      away: 3,
      byPeriod: [
        { period: 1, home: 3, away: 2 },
        { period: 5, home: 2, away: 1 },
      ],
    });
  });

  it('Scenario 15 (score slice): a CORRECTION-voided basket scores nothing, without deleting the event', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'SHOT_MADE', 'home', 'H32', { points: 3 }),
      ev(1, 'SHOT_MADE', 'away', 'A22', { points: 2 }),
      ev(1, 'CORRECTION', null, null, { voidsSeq: 2, reason: 'ref waved off the 3' }),
    ];
    expect(scoreReducer(events)).toMatchObject({ home: 0, away: 2 });
    expect(events).toHaveLength(4); // the voided event is still in the log
  });

  it('started-but-scoreless periods appear in the splits at 0–0', () => {
    reset();
    const events = [ev(1, 'PERIOD_START')];
    expect(scoreReducer(events).byPeriod).toEqual([{ period: 1, home: 0, away: 0 }]);
  });

  it('misses never score (SHOT_MISSED and FT_MISSED are point-free)', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'SHOT_MISSED', 'home', 'H32', { shotValue: 3 }),
      ev(1, 'FT_MISSED', 'away', 'A5', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
    ];
    expect(scoreReducer(events)).toMatchObject({ home: 0, away: 0 });
  });
});
