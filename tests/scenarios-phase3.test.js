// Phase 3 fixtures: S8 (special 1-FT family), S10 (sudden death), S11
// (timeouts) slices from spec/test-scenarios.md, plus the reducers and the
// pure wizard module that the input UI drives.
import { describe, it, expect } from 'vitest';
import { onCourtReducer, onCourtAsOf } from '../src/reducers/onCourtReducer.js';
import { timeoutsReducer } from '../src/reducers/timeoutsReducer.js';
import { gamePhaseReducer } from '../src/reducers/gamePhaseReducer.js';
import { resolveFoul, buildFoulGroup, buildExcessiveTimeoutGroup } from '../src/writers/foulWizard.js';
import { appendEvents } from '../src/writers/appendEvent.js';
import { teamFoulsReducer } from '../src/reducers/teamFoulsReducer.js';

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

const rosters = {
  home: {
    name: 'Home',
    color: '#111111',
    starterIds: ['H1', 'H2', 'H3', 'H4', 'H5'],
    players: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1), position: 'G' })),
    coaches: [{ name: 'Home Coach', role: 'Head Coach' }],
  },
  away: {
    name: 'Away',
    color: '#222222',
    starterIds: ['A1', 'A2', 'A3', 'A4', 'A5'],
    players: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1), position: 'G' })),
    coaches: [{ name: 'Away Coach', role: 'Head Coach' }],
  },
};
const gameWith = (events) => ({ meta: {}, rosters, events });

describe('onCourtReducer', () => {
  reset();
  const events = [
    ev(1, 'PERIOD_START'),
    ev(1, 'SUB_OUT', 'home', 'H1'),
    ev(1, 'SUB_IN', 'home', 'H6'),
  ];

  it('starts with the setup starters, then follows SUB events', () => {
    const before = onCourtReducer([events[0]], rosters);
    expect(before.home.sort()).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
    const after = onCourtReducer(events, rosters);
    expect(after.home.sort()).toEqual(['H2', 'H3', 'H4', 'H5', 'H6']);
    expect(after.away).toHaveLength(5);
  });

  it('onCourtAsOf answers eligibility at a past moment (dry-run finding 1)', () => {
    const asOfBeforeSub = onCourtAsOf(events, rosters, 1);
    expect(asOfBeforeSub.home).toContain('H1');
    expect(asOfBeforeSub.home).not.toContain('H6');
  });

  it('SUB_IN with ruleException sets a persistent reentryUnderPenalty flag (S16)', () => {
    reset();
    const withReentry = [
      ev(4, 'PERIOD_START'),
      ev(4, 'SUB_IN', 'home', 'H7', { reason: 're-entry — team below 5 eligible', ruleException: true }),
    ];
    expect(onCourtReducer(withReentry, rosters).reentryUnderPenalty).toContain('H7');
  });
});

describe('Scenario 11 — timeouts', () => {
  reset();
  const q1 = [ev(1, 'PERIOD_START')];

  it('after #20 (home 30s in Q1): home remaining 1 in H1', () => {
    const events = [...q1, ev(1, 'TIMEOUT', 'home', null, { toType: 'thirty' })];
    const t = timeoutsReducer(events);
    expect(t.window).toBe('H1');
    expect(t.home.remaining).toBe(1);
    expect(t.away.remaining).toBe(2);
  });

  it('after #21 (league mandatory): charged to NEITHER team', () => {
    const events = [
      ...q1,
      ev(1, 'TIMEOUT', 'home', null, { toType: 'thirty' }),
      ev(1, 'TIMEOUT', 'league', null, { toType: 'mandatory' }),
    ];
    const t = timeoutsReducer(events);
    expect(t.home.remaining).toBe(1); // unchanged
    expect(t.away.remaining).toBe(2); // unchanged
    expect(t.mandatoryAvailableThisPeriod).toBe(false); // 1 per quarter, used
  });

  it('after #22 (home 30s in Q2, same half): home remaining 0', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'TIMEOUT', 'home', null, { toType: 'thirty' }),
      ev(1, 'PERIOD_END'),
      ev(2, 'PERIOD_START'),
      ev(2, 'TIMEOUT', 'home', null, { toType: 'thirty' }),
    ];
    expect(timeoutsReducer(events).home.remaining).toBe(0);
  });

  it('#23 (3rd of the half): the TIMEOUT flow emits the linked excessive pair, never the foul wizard', () => {
    const group = buildExcessiveTimeoutGroup({
      team: 'home',
      coachId: 'home-hc',
      ftResult: { made: true, shooterId: 'A1' },
    });
    expect(group.map((e) => e.type)).toEqual(['TIMEOUT', 'FOUL', 'FT_MADE']);
    expect(group[0].payload.toType).toBe('excessive');
    expect(group[1].payload).toMatchObject({ foulType: 'technical', source: 'excessiveTimeout' });
    expect(group[2].team).toBe('away'); // 1 FT to the opponent
  });

  it('halftime: both teams reset to 2 for the 2nd half; unused H1 timeouts vanish', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'TIMEOUT', 'home', null, { toType: 'thirty' }),
      ev(1, 'PERIOD_END'),
      ev(2, 'PERIOD_START'),
      ev(2, 'TIMEOUT', 'home', null, { toType: 'thirty' }),
      ev(2, 'PERIOD_END'),
      ev(3, 'PERIOD_START'),
    ];
    const t = timeoutsReducer(events);
    expect(t.window).toBe('H2');
    expect(t.home.remaining).toBe(2);
  });

  it('OT: exactly 1×30s per team regardless of what remained from the 2nd half (S9 slice)', () => {
    reset();
    const events = [
      ev(4, 'PERIOD_START'),
      ev(4, 'PERIOD_END'),
      ev(5, 'PERIOD_START'),
    ];
    const t = timeoutsReducer(events);
    expect(t.window).toBe('OT1');
    expect(t.home.remaining).toBe(1);
    expect(t.away.remaining).toBe(1);
  });
});

describe('Scenario 10 — double-OT sudden death', () => {
  reset();
  const to2OT = [
    ev(5, 'PERIOD_START'),
    ev(5, 'PERIOD_END'), // OT ends tied
    ev(6, 'PERIOD_START'), // 2OT
  ];

  it('gamePhaseReducer arms suddenDeath in period 6', () => {
    expect(gamePhaseReducer(to2OT)).toMatchObject({ phase: 'live', period: 6, suddenDeath: true });
    expect(gamePhaseReducer([ev(5, 'PERIOD_START')]).suddenDeath).toBe(false);
  });

  it('GAME_END ends the game; input surfaces read phase=ended', () => {
    const ended = [
      ...to2OT,
      ev(6, 'SHOT_MADE', 'away', 'A2', { points: 2 }),
      ev(6, 'GAME_END'),
    ];
    expect(gamePhaseReducer(ended).phase).toBe('ended');
  });
});

describe('foul wizard resolution (flowchart branches)', () => {
  reset();
  const baseEvents = [ev(1, 'PERIOD_START')];

  it('S6 offensive: no FTs, possession flips', () => {
    const r = resolveFoul(
      { team: 'home', playerId: 'H1', foulType: 'offensive' },
      { game: gameWith(baseEvents) },
    );
    expect(r.freeThrows).toBeNull();
    expect(r.possession).toMatch(/side-out/);
  });

  it('S1: non-shooting foul prompts FTs only once the penalty (incl. this foul) is reached', () => {
    reset();
    const fouls = (n) => [
      ev(1, 'PERIOD_START'),
      ...Array.from({ length: n }, (_, i) => ev(1, 'FOUL', 'away', `A${(i % 4) + 1}`, { foulType: 'personal', shooting: false })),
    ];
    // this would be away's 4th foul — no penalty
    const fourth = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'personal', shooting: false, fouledPlayer: 'H1' },
      { game: gameWith(fouls(3)) },
    );
    expect(fourth.freeThrows).toBeNull();
    // this would be the 5th — 2 FTs, bonus
    const fifth = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'personal', shooting: false, fouledPlayer: 'H1' },
      { game: gameWith(fouls(4)) },
    );
    expect(fifth.freeThrows).toMatchObject({ count: 2, context: 'bonus' });
  });

  it('S4 and-one: exactly 1 FT; missed 3-point attempt: exactly 3 FTs', () => {
    const andOne = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'personal', shooting: true, made: true, fouledPlayer: 'H1' },
      { game: gameWith(baseEvents) },
    );
    expect(andOne.freeThrows.count).toBe(1);
    const missedThree = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'personal', shooting: true, made: false, shotValue: 3, fouledPlayer: 'H1' },
      { game: gameWith(baseEvents) },
    );
    expect(missedThree.freeThrows.count).toBe(3);
  });

  it('S7 technical: 1 FT, shooter pool = opposing players on court', () => {
    const r = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'technical' },
      { game: gameWith(baseEvents) },
    );
    expect(r.freeThrows).toMatchObject({ count: 1, shooterRule: 'anyInGame' });
    expect(r.freeThrows.pool.sort()).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
    expect(r.possession).toMatch(/does NOT flip/);
  });

  it('S8: every special kind resolves to exactly 1 FT with its own possession outcome', () => {
    for (const [kind, expected] of [
      ['transitionTake', /retains/],
      ['awayFromPlay', /POI/],
      ['defensive3s', /FTLE/],
    ]) {
      const r = resolveFoul(
        { team: 'away', playerId: 'A5', foulType: 'special', specialKind: kind },
        { game: gameWith(baseEvents) },
      );
      expect(r.freeThrows.count).toBe(1);
      expect(r.possession).toMatch(expected);
    }
  });

  it('S8 flop (dry-run finding 1): shooter pool evaluated AS OF the violation, surviving an intervening sub', () => {
    reset();
    const events = [
      ev(4, 'PERIOD_START'), // seq 1
      ev(4, 'SUB_OUT', 'home', 'H1'), // seq 2 — sub happens AFTER the flop occurred
      ev(4, 'SUB_IN', 'home', 'H6'), // seq 3
    ];
    const r = resolveFoul(
      { team: 'away', playerId: 'A5', foulType: 'special', specialKind: 'flop', asOfSeq: 1 },
      { game: gameWith(events) },
    );
    expect(r.foulPayload).toMatchObject({ foulType: 'technical', eligibilityBasis: { asOfSeq: 1 } });
    expect(r.freeThrows.pool).toContain('H1'); // on court at the violation
    expect(r.freeThrows.pool).not.toContain('H6'); // subbed in after it
  });

  it('S16 wrapper: a flagged committer compounds a linked technical AFTER the base resolution', () => {
    reset();
    const events = [
      ev(4, 'PERIOD_START'),
      ev(4, 'SUB_IN', 'home', 'H7', { ruleException: true }),
    ];
    const answers = { team: 'home', playerId: 'H7', foulType: 'personal', shooting: false, fouledPlayer: 'A1' };
    const resolution = resolveFoul(answers, { game: gameWith(events) });
    expect(resolution.reentryWrapper).toBe(true);
    const group = buildFoulGroup({
      answers,
      resolution,
      ftResults: [],
      reentryFt: { made: false, shooterId: 'A1' },
    });
    expect(group.map((e) => e.type)).toEqual(['FOUL', 'FOUL', 'FT_MISSED']);
    expect(group[1].payload).toMatchObject({ foulType: 'technical', source: 'reentryPenalty' });
  });

  it('S5 DQ-shooter variant: the pre-FT sub is logged BEFORE the FT events, mustRemain flagged', () => {
    const answers = { team: 'away', playerId: 'A5', foulType: 'personal', shooting: true, made: false, shotValue: 2, fouledPlayer: 'H1' };
    const resolution = resolveFoul(answers, { game: gameWith([ev(1, 'PERIOD_START')]) });
    const group = buildFoulGroup({
      answers,
      resolution,
      preFtSub: { team: 'home', out: 'H1', in: 'H6' },
      ftResults: [
        { made: true, shooterId: 'H6' },
        { made: false, shooterId: 'H6' },
      ],
    });
    expect(group.map((e) => e.type)).toEqual(['FOUL', 'SUB_OUT', 'SUB_IN', 'FT_MADE', 'FT_MISSED']);
    expect(group[2].payload.mustRemain).toBe(true);
    expect(group[3].payload.attemptOf).toEqual({ n: 1, of: 2 });
    expect(group[4].payload.attemptOf).toEqual({ n: 2, of: 2 });
  });
});

describe('appendEvents undo-groups', () => {
  it('stamps every event in a batch with the first seq as groupSeq', () => {
    let game = { meta: {}, rosters, events: [] };
    game = appendEvents(game, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    game = appendEvents(game, [
      { type: 'FOUL', team: 'away', playerId: 'A5', payload: { foulType: 'personal', shooting: false } },
      { type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 }, context: 'bonus' } },
      { type: 'FT_MISSED', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 2, of: 2 }, context: 'bonus' } },
    ]);
    const [, foul, ft1, ft2] = game.events;
    expect(foul.groupSeq).toBe(2);
    expect(ft1.groupSeq).toBe(2);
    expect(ft2.groupSeq).toBe(2);
    expect(game.events[0].groupSeq).toBe(1);
  });

  it('special fouls respect their per-kind team-foul convention', () => {
    reset();
    const events = [
      ev(1, 'PERIOD_START'),
      ev(1, 'FOUL', 'away', 'A5', { foulType: 'special', specialKind: 'transitionTake' }),
      ev(1, 'FOUL', 'away', 'A5', { foulType: 'special', specialKind: 'defensive3s' }),
    ];
    expect(teamFoulsReducer(events).teamFouls.away).toBe(1); // take counts, def-3s does not
  });
});
