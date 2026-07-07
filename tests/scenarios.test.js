// Vitest fixtures ported from spec/test-scenarios.md — the acceptance criteria
// for the Phase 2 foul/bonus reducers. Event arrays are copied from the spec;
// per the process rule these were written against the rulebook BEFORE any
// implementation, and the reducers must satisfy them, not the reverse.
//
// Ported here: the teamFouls/playerStats slices of S1–S7, S9, S16 (score/log
// slices of S1/S4/S9/11/15 are in scoreReducer/logReducer tests from Phase 1).
// Still owed by later phases: S8 (wizard branches, P3), S10 (game end, P3),
// S11 (timeoutsReducer, P5), S12 (quarterPointsReducer, P5), S13 (undo, P4),
// S14 (round-trip, P5).
import { describe, it, expect } from 'vitest';
import { teamFoulsReducer } from '../src/reducers/teamFoulsReducer.js';
import { playerStatsReducer, statsFor } from '../src/reducers/playerStatsReducer.js';
import { scoreReducer } from '../src/reducers/scoreReducer.js';

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
const personal = (period, team, playerId, extra = {}) =>
  ev(period, 'FOUL', team, playerId, { foulType: 'personal', shooting: false, ...extra });

describe('Scenario 1 — standard bonus trip (5th team foul)', () => {
  reset();
  const through5 = [
    ev(1, 'PERIOD_START'),
    personal(1, 'away', 'A22'),
    personal(1, 'away', 'A5'),
    personal(1, 'away', 'A22'),
    personal(1, 'away', 'A14'),
  ];

  it('after #5: away team fouls 4, no bonus', () => {
    const tf = teamFoulsReducer(through5);
    expect(tf.teamFouls.away).toBe(4);
    expect(tf.bonus.home).toBe(false);
  });

  const through8 = [
    ...through5,
    personal(1, 'away', 'A5'),
    ev(1, 'FT_MADE', 'home', 'H10', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
    ev(1, 'FT_MISSED', 'home', 'H10', { attemptOf: { n: 2, of: 2 }, context: 'bonus' }),
  ];

  it('after #8: away 5, home IN THE BONUS', () => {
    const tf = teamFoulsReducer(through8);
    expect(tf.teamFouls.away).toBe(5);
    expect(tf.bonus.home).toBe(true);
    expect(tf.bonus.away).toBe(false);
  });

  it('after #8: score 1–0; H10 PTS 1, FTM 1, FTA 2', () => {
    expect(scoreReducer(through8)).toMatchObject({ home: 1, away: 0 });
    const h10 = statsFor(playerStatsReducer(through8), 'H10');
    expect(h10).toMatchObject({ pts: 1, ftm: 1, fta: 2 });
  });
});

describe('Scenario 2 — last-2:00 penalty trigger (any quarter)', () => {
  reset();
  const events = [
    ev(3, 'PERIOD_START'),
    personal(3, 'away', 'A22'), // away team foul 1
    ev(3, 'LAST_TWO_START'), // clock hits 2:00
  ];

  it('1 foul + armed marker: no bonus yet', () => {
    const tf = teamFoulsReducer(events);
    expect(tf.teamFouls.away).toBe(1);
    expect(tf.bonus.home).toBe(false);
  });

  it('2nd team foul after LAST_TWO_START: home in the bonus at only 2 fouls — and the pre-marker foul counts', () => {
    const tf = teamFoulsReducer([...events, personal(3, 'away', 'A5')]);
    expect(tf.teamFouls.away).toBe(2);
    expect(tf.bonus.home).toBe(true);
  });

  it('boundary: a team already at 5+ when the marker fires was already in the penalty (triggers are OR-ed)', () => {
    reset();
    const already = [
      ev(2, 'PERIOD_START'),
      personal(2, 'away', 'A22'),
      personal(2, 'away', 'A5'),
      personal(2, 'away', 'A22'),
      personal(2, 'away', 'A14'),
      personal(2, 'away', 'A5'),
    ];
    expect(teamFoulsReducer(already).bonus.home).toBe(true);
    expect(teamFoulsReducer([...already, ev(2, 'LAST_TWO_START')]).bonus.home).toBe(true);
  });
});

describe('Scenario 3 — quarter reset', () => {
  reset();
  const events = [
    // End of Scenario 1: away 5 team fouls (A22 has 2 of them), home in bonus, Q1
    ev(1, 'PERIOD_START'),
    personal(1, 'away', 'A22'),
    personal(1, 'away', 'A5'),
    personal(1, 'away', 'A22'),
    personal(1, 'away', 'A14'),
    personal(1, 'away', 'A5'),
    ev(1, 'FT_MADE', 'home', 'H10', { attemptOf: { n: 1, of: 2 }, context: 'bonus' }),
    ev(1, 'FT_MISSED', 'home', 'H10', { attemptOf: { n: 2, of: 2 }, context: 'bonus' }),
    ev(1, 'PERIOD_END'),
    ev(2, 'PERIOD_START'),
    personal(2, 'away', 'A22'),
  ];

  it('team fouls reset at the quarter boundary; bonus off', () => {
    const tf = teamFoulsReducer(events);
    expect(tf.teamFouls.away).toBe(1);
    expect(tf.bonus.home).toBe(false);
  });

  it('player fouls never reset: A22 has 3', () => {
    expect(statsFor(playerStatsReducer(events), 'A22').fouls).toBe(3);
  });

  it('a LAST_TWO_START armed in a prior quarter is cleared by the next PERIOD_START', () => {
    reset();
    const armedThenReset = [
      ev(1, 'PERIOD_START'),
      ev(1, 'LAST_TWO_START'),
      ev(1, 'PERIOD_END'),
      ev(2, 'PERIOD_START'),
      personal(2, 'away', 'A22'),
      personal(2, 'away', 'A5'),
    ];
    // 2 fouls in Q2 with no Q2 marker: no bonus (Q1's marker must not leak)
    expect(teamFoulsReducer(armedThenReset).bonus.home).toBe(false);
  });
});

describe('Scenario 4 — and-one', () => {
  reset();
  const events = [
    ev(1, 'PERIOD_START'),
    ev(1, 'SHOT_MADE', 'home', 'H32', { points: 2 }),
    ev(1, 'FOUL', 'away', 'A5', { foulType: 'personal', shooting: true, andOne: true, fouledPlayer: 'H32' }),
    ev(1, 'FT_MADE', 'home', 'H32', { attemptOf: { n: 1, of: 1 }, context: 'andOne' }),
  ];

  it('home 3–0; H32 PTS 3, FGM/FGA 1/1, FTM/FTA 1/1', () => {
    expect(scoreReducer(events)).toMatchObject({ home: 3, away: 0 });
    expect(statsFor(playerStatsReducer(events), 'H32')).toMatchObject({
      pts: 3,
      fgm: 1,
      fga: 1,
      ftm: 1,
      fta: 1,
    });
  });

  it('A5 fouls 1; away team fouls 1 (a shooting personal counts toward the team total)', () => {
    expect(statsFor(playerStatsReducer(events), 'A5').fouls).toBe(1);
    expect(teamFoulsReducer(events).teamFouls.away).toBe(1);
  });
});

describe('Scenario 5 — sixth-foul disqualification', () => {
  reset();
  // Setup: A14 has 5 personal fouls from earlier quarters; away has 3 team fouls in Q4.
  const events = [
    ev(1, 'PERIOD_START'),
    personal(1, 'away', 'A14'),
    personal(1, 'away', 'A14'),
    ev(1, 'PERIOD_END'),
    ev(2, 'PERIOD_START'),
    personal(2, 'away', 'A14'),
    personal(2, 'away', 'A14'),
    ev(2, 'PERIOD_END'),
    ev(3, 'PERIOD_START'),
    personal(3, 'away', 'A14'),
    ev(3, 'PERIOD_END'),
    ev(4, 'PERIOD_START'),
    personal(4, 'away', 'A5'),
    personal(4, 'away', 'A22'),
    personal(4, 'away', 'A5'),
    // #80 — her sixth
    ev(4, 'FOUL', 'away', 'A14', {
      foulType: 'personal',
      shooting: true,
      shotValue: 2,
      made: false,
      fouledPlayer: 'H10',
    }),
  ];

  it('A14: fouls 6, dq true — at SIX, not five', () => {
    const before = events.slice(0, -1);
    expect(statsFor(playerStatsReducer(before), 'A14')).toMatchObject({ fouls: 5, dq: false });
    expect(statsFor(playerStatsReducer(events), 'A14')).toMatchObject({ fouls: 6, dq: true });
  });

  it('the DQ foul still counts toward the team total: away Q4 team fouls 4', () => {
    expect(teamFoulsReducer(events).teamFouls.away).toBe(4);
  });

  it('dq is not ejection: no next-game suspension for fouling out', () => {
    const a14 = statsFor(playerStatsReducer(events), 'A14');
    expect(a14.ejected).toBe(false);
    expect(a14.nextGameSuspension).toBe(false);
  });
});

describe('Scenario 6 — offensive foul in the bonus', () => {
  reset();
  // Setup: Q4, home has 6 team fouls (away in the bonus).
  const setup = [
    ev(4, 'PERIOD_START'),
    personal(4, 'home', 'H1'),
    personal(4, 'home', 'H2'),
    personal(4, 'home', 'H3'),
    personal(4, 'home', 'H4'),
    personal(4, 'home', 'H5'),
    personal(4, 'home', 'H1'),
  ];
  const events = [...setup, ev(4, 'FOUL', 'home', 'H10', { foulType: 'offensive' })];

  it('H10 personal fouls +1', () => {
    expect(statsFor(playerStatsReducer(events), 'H10').fouls).toBe(1);
  });

  it('home team fouls unchanged at 6; away still in the bonus', () => {
    const tf = teamFoulsReducer(events);
    expect(tf.teamFouls.home).toBe(6);
    expect(tf.bonus.away).toBe(true);
  });

  it('an offensive foul alone never arms the bonus for the opponent', () => {
    reset();
    const lone = [
      ev(1, 'PERIOD_START'),
      ev(1, 'FOUL', 'home', 'H10', { foulType: 'offensive' }),
    ];
    expect(teamFoulsReducer(lone).teamFouls.home).toBe(0);
  });
});

describe('Scenario 7 — technical foul and the ejection ladder', () => {
  reset();
  // Setup: A5 has 1 prior technical from Q1.
  const events = [
    ev(1, 'PERIOD_START'),
    ev(1, 'FOUL', 'away', 'A5', { foulType: 'technical' }),
    ev(1, 'PERIOD_END'),
    ev(2, 'PERIOD_START'),
    ev(2, 'FOUL', 'away', 'A5', { foulType: 'technical' }), // #45
    ev(2, 'FT_MADE', 'home', 'H22', { attemptOf: { n: 1, of: 1 }, context: 'technical' }), // #46
  ];
  const stats = playerStatsReducer(events);

  it('home +1 from the single technical FT', () => {
    expect(scoreReducer(events)).toMatchObject({ home: 1, away: 0 });
  });

  it('A5: technicals 2 → ejected, next-game suspension flagged', () => {
    expect(statsFor(stats, 'A5')).toMatchObject({
      technicals: 2,
      ejected: true,
      nextGameSuspension: true,
    });
  });

  it('[LEAGUE CLARIFICATION] defaults: technicals count toward neither the team-foul total nor the player six', () => {
    expect(teamFoulsReducer(events).teamFouls.away).toBe(0);
    expect(statsFor(stats, 'A5').fouls).toBe(0);
  });

  it('ejection ladder encoded as data: 2 FF1s eject; any FF2 ejects immediately', () => {
    reset();
    const ff1s = [
      ev(1, 'PERIOD_START'),
      ev(1, 'FOUL', 'away', 'A9', { foulType: 'flagrant1' }),
      ev(1, 'FOUL', 'away', 'A9', { foulType: 'flagrant1' }),
    ];
    expect(statsFor(playerStatsReducer(ff1s), 'A9')).toMatchObject({
      ejected: true,
      nextGameSuspension: true,
    });
    reset();
    const ff2 = [ev(1, 'PERIOD_START'), ev(1, 'FOUL', 'home', 'H7', { foulType: 'flagrant2' })];
    expect(statsFor(playerStatsReducer(ff2), 'H7')).toMatchObject({
      ejected: true,
      nextGameSuspension: true,
    });
    // one FF1 alone does not eject
    reset();
    const oneFf1 = [ev(1, 'PERIOD_START'), ev(1, 'FOUL', 'away', 'A9', { foulType: 'flagrant1' })];
    expect(statsFor(playerStatsReducer(oneFf1), 'A9').ejected).toBe(false);
  });
});

describe('Scenario 9 — overtime: fresh count, fast penalty', () => {
  reset();
  // Setup: away had 7 team fouls in Q4 (deep in the penalty).
  const q4 = [
    ev(4, 'PERIOD_START'),
    ...Array.from({ length: 7 }, (_, i) => personal(4, 'away', `A${(i % 3) + 1}`)),
    ev(4, 'PERIOD_END'),
  ];
  const otStart = [...q4, ev(5, 'PERIOD_START')]; // #102 — OT, jump ball

  it('after the 1st OT foul: away OT fouls 1, no penalty (Q4 count is gone)', () => {
    const tf = teamFoulsReducer([...otStart, personal(5, 'away', 'A22')]);
    expect(tf.teamFouls.away).toBe(1);
    expect(tf.bonus.home).toBe(false);
  });

  it('after the 2nd OT foul: home in the penalty (OT threshold is 2, not 5)', () => {
    const tf = teamFoulsReducer([
      ...otStart,
      personal(5, 'away', 'A22'),
      personal(5, 'away', 'A5'),
    ]);
    expect(tf.teamFouls.away).toBe(2);
    expect(tf.bonus.home).toBe(true);
  });

  it('trap-pair with S3: regulation still requires 5 — 2 fouls in Q2 is not a penalty', () => {
    reset();
    const regulation = [
      ev(2, 'PERIOD_START'),
      personal(2, 'away', 'A22'),
      personal(2, 'away', 'A5'),
    ];
    expect(teamFoulsReducer(regulation).bonus.home).toBe(false);
  });
});

describe('Scenario 16 — re-entry under penalty (playerStats slice)', () => {
  reset();
  const reentry = [
    ev(4, 'PERIOD_START'),
    // #90 — re-entering is itself a technical
    ev(4, 'SUB_IN', 'home', 'H22', { reason: 're-entry — team below 5 eligible', ruleException: true }),
  ];

  it('after #90: H22 charged 1 technical for the act of re-entering', () => {
    expect(statsFor(playerStatsReducer(reentry), 'H22').technicals).toBe(1);
  });

  // #95 — the wizard emits the base foul AND the compounding linked technical
  const afterCompound = [
    ...reentry,
    ev(4, 'FOUL', 'home', 'H22', { foulType: 'personal', shooting: false }),
    ev(4, 'FOUL', 'home', 'H22', { foulType: 'technical', source: 'reentryPenalty', linkedSeq: 3 }),
  ];

  it('after #95: personal fouls +1 AND technicals +1', () => {
    expect(statsFor(playerStatsReducer(afterCompound), 'H22')).toMatchObject({
      fouls: 1,
      technicals: 2,
    });
  });

  it('compounding technicals feed the same ejection ladder as any other technical', () => {
    // 1 re-entry tech + 1 compound tech = 2 → the standard 2-tech ejection applies
    expect(statsFor(playerStatsReducer(afterCompound), 'H22').ejected).toBe(true);
  });

  // ⚠ FLAGGED (see PR/summary, not silently resolved): by S16's own ladder
  // statement, H22 reaches 2 technicals at #95 and is ejected — yet the
  // scenario's narrative continues to #110 with her still playing. The
  // reducers below record whatever is in the log (the app records, it does
  // not enforce legality), so #110's stated counts are still asserted; the
  // contradiction is about whether #110 could legally occur, which needs
  // Krystal's ruling before the Phase 3 wizard blocks or allows it.
  const afterShootingCompound = [
    ...afterCompound,
    ev(4, 'FOUL', 'home', 'H22', {
      foulType: 'personal',
      shooting: true,
      shotValue: 2,
      made: false,
      fouledPlayer: 'A9',
    }),
    ev(4, 'FOUL', 'home', 'H22', { foulType: 'technical', source: 'reentryPenalty', linkedSeq: 5 }),
  ];

  it('after #110: personal fouls +1, technicals +1 (counts keep accruing as logged)', () => {
    expect(statsFor(playerStatsReducer(afterShootingCompound), 'H22')).toMatchObject({
      fouls: 2,
      technicals: 3,
    });
  });

  it('an ordinary SUB_IN (no ruleException) charges nothing', () => {
    reset();
    const normalSub = [
      ev(1, 'PERIOD_START'),
      ev(1, 'SUB_IN', 'home', 'H8', {}),
    ];
    expect(statsFor(playerStatsReducer(normalSub), 'H8').technicals).toBe(0);
  });
});
