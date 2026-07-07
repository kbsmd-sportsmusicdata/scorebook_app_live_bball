import { describe, it, expect } from 'vitest';
import { logReducer } from '../src/reducers/logReducer.js';

const rosters = {
  home: {
    name: 'Oakland Swish',
    color: '#394F6E',
    players: [
      { playerId: '675230-3', name: 'Alayna Contreras', jersey: '3', position: 'G' },
      { playerId: '675230-rokia-doumbia', name: 'Rokia Doumbia', jersey: null, position: 'G' },
    ],
  },
  away: {
    name: 'Alameda Wolves',
    color: '#8A2B46',
    players: [{ playerId: '675231-22', name: 'Bianca Mcgee', jersey: '22', position: 'G' }],
  },
};

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

describe('logReducer', () => {
  seq = 0;
  const events = [
    ev(1, 'PERIOD_START'),
    ev(1, 'SHOT_MADE', 'home', '675230-3', { points: 2 }),
    ev(1, 'FOUL', 'away', '675231-22', { foulType: 'personal', shooting: true }),
    ev(1, 'FT_MISSED', 'home', '675230-3', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
    ev(1, 'TIMEOUT', 'league', null, { toType: 'mandatory' }),
    ev(1, 'SUB_IN', 'home', '675230-rokia-doumbia'),
    ev(1, 'LAST_TWO_START'),
    ev(1, 'CORRECTION', null, null, { voidsSeq: 2, reason: 'wrong shooter' }),
    ev(1, 'PERIOD_END'),
  ];
  const log = logReducer(events, rosters);

  it('resolves player names, jerseys, and team names', () => {
    expect(log[1].text).toBe('#3 Alayna Contreras (Oakland Swish) made a 2-point shot');
    expect(log[2].text).toBe('personal foul, shooting on #22 Bianca Mcgee (Alameda Wolves)');
    expect(log[3].text).toBe('#3 Alayna Contreras (Oakland Swish) missed free throw 1 of 2 (bonus)');
  });

  it('handles a no-jersey player via the slug playerId', () => {
    expect(log[5].text).toBe('Rokia Doumbia (Oakland Swish) checks in');
  });

  it("Scenario 11's exact league-mandatory timeout entry", () => {
    expect(log[4].text).toBe('League mandatory timeout (60s)');
  });

  it('labels clock events with period names', () => {
    expect(log[0].text).toBe('Start of Q1');
    expect(log[6].text).toBe('Last two minutes of Q1 — penalty rules armed');
    expect(log[8].text).toBe('End of Q1');
  });

  it('Scenario 15: voided events stay in the log, flagged voided, with the correction visible', () => {
    expect(log).toHaveLength(events.length);
    expect(log[1].voided).toBe(true);
    expect(log[7].voided).toBe(false);
    expect(log[7].text).toBe('Correction: voids event #2 — wrong shooter');
  });

  it('labels OT periods correctly', () => {
    const otLog = logReducer([{ seq: 1, ts: 0, period: 5, type: 'PERIOD_START', team: null, playerId: null, payload: { period: 5 } }], rosters);
    const doubleOtLog = logReducer([{ seq: 1, ts: 0, period: 6, type: 'PERIOD_START', team: null, playerId: null, payload: { period: 6 } }], rosters);
    expect(otLog[0].text).toBe('Start of OT');
    expect(doubleOtLog[0].text).toBe('Start of 2OT');
  });
});
