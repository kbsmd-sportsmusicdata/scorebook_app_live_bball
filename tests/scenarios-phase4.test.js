// Phase 4 fixtures: S13 (deep undo/redo integrity) and S15 (correction vs
// undo). Pure undo primitives + reducer-verifying round-trips.
import { describe, it, expect } from 'vitest';
import { appendEvent, appendEvents } from '../src/writers/appendEvent.js';
import { popLastGroup, undoStepCount, describeLastGroup, groupsFromAndIncluding } from '../src/writers/undo.js';
import { scoreReducer } from '../src/reducers/scoreReducer.js';
import { teamFoulsReducer } from '../src/reducers/teamFoulsReducer.js';
import { playerStatsReducer, statsFor } from '../src/reducers/playerStatsReducer.js';
import { logReducer } from '../src/reducers/logReducer.js';
import { voidedSeqs } from '../src/reducers/voids.js';

const rosters = {
  home: {
    name: 'Home',
    color: '#111',
    starterIds: ['H1', 'H2', 'H3', 'H4', 'H5'],
    players: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1) })),
    coaches: [],
  },
  away: {
    name: 'Away',
    color: '#222',
    starterIds: ['A1', 'A2', 'A3', 'A4', 'A5'],
    players: ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1) })),
    coaches: [],
  },
};

const newGame = () => ({ meta: {}, rosters, events: [] });

describe('popLastGroup', () => {
  it('pops the last event when it has no group siblings', () => {
    const events = [
      { seq: 1, ts: 0, period: 1, type: 'PERIOD_START', team: null, playerId: null, payload: {}, groupSeq: 1 },
      { seq: 2, ts: 0, period: 1, type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 2 }, groupSeq: 2 },
    ];
    const [remaining, removed] = popLastGroup(events);
    expect(remaining).toHaveLength(1);
    expect(removed).toEqual([{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 2 } }]);
  });

  it('pops the whole trailing groupSeq run in one call — foul + FT events go together', () => {
    const events = [
      { seq: 1, ts: 0, period: 1, type: 'PERIOD_START', team: null, playerId: null, payload: {}, groupSeq: 1 },
      { seq: 2, ts: 0, period: 1, type: 'FOUL', team: 'away', playerId: 'A5', payload: { foulType: 'personal' }, groupSeq: 2 },
      { seq: 3, ts: 0, period: 1, type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 } }, groupSeq: 2 },
      { seq: 4, ts: 0, period: 1, type: 'FT_MISSED', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 2, of: 2 } }, groupSeq: 2 },
    ];
    const [remaining, removed] = popLastGroup(events);
    expect(remaining).toHaveLength(1);
    expect(removed.map((r) => r.type)).toEqual(['FOUL', 'FT_MADE', 'FT_MISSED']);
  });

  it('treats an ungrouped event (no groupSeq) as its own group via groupOf', () => {
    const events = [
      { seq: 1, ts: 0, period: 1, type: 'PERIOD_START', team: null, playerId: null, payload: {} }, // no groupSeq
      { seq: 2, ts: 0, period: 1, type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 2 } },
    ];
    const [, removed] = popLastGroup(events);
    expect(removed).toHaveLength(1);
  });
});

describe('Scenario 13 — deep undo/redo integrity', () => {
  // Script 12 mixed events across 8 undo-groups.
  const scripted = (() => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]); // 1
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]); // 2
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'away', playerId: 'A1', payload: { points: 2 } }]); // 3
    g = appendEvents(g, [
      // 4–6: foul+FT undo-group
      { type: 'FOUL', team: 'away', playerId: 'A2', payload: { foulType: 'personal', shooting: true, shotValue: 2, made: false, fouledPlayer: 'H1' } },
      { type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 }, context: 'shootingFoul' } },
      { type: 'FT_MISSED', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 2, of: 2 }, context: 'shootingFoul' } },
    ]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'away', playerId: 'A2', payload: { points: 2 } }]); // 7
    g = appendEvents(g, [{ type: 'SHOT_MISSED', team: 'home', playerId: 'H1', payload: { shotValue: 2 } }]); // 8
    g = appendEvents(g, [
      // 9–11: second foul+FT undo-group
      { type: 'FOUL', team: 'home', playerId: 'H2', payload: { foulType: 'personal', shooting: false } },
      { type: 'FT_MADE', team: 'away', playerId: 'A1', payload: { attemptOf: { n: 1, of: 2 }, context: 'bonus' } },
      { type: 'FT_MADE', team: 'away', playerId: 'A1', payload: { attemptOf: { n: 2, of: 2 }, context: 'bonus' } },
    ]);
    g = appendEvents(g, [{ type: 'TIMEOUT', team: 'home', payload: { toType: 'thirty' } }]); // 12
    return g;
  })();

  it('starts at 12 events across 8 undo-groups', () => {
    expect(scripted.events).toHaveLength(12);
    expect(undoStepCount(scripted.events)).toBe(8);
  });

  it("undo 6: foul+FT groups count as ONE step; every reducer matches fresh replay", () => {
    let events = scripted.events;
    const undoStack = [];
    for (let i = 0; i < 6; i++) {
      const [remaining, removed] = popLastGroup(events);
      events = remaining;
      undoStack.push(removed);
    }
    // 8 groups - 6 undos = 2 groups remaining: PERIOD_START + SHOT_MADE H1 3pts
    expect(undoStepCount(events)).toBe(2);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.seq)).toEqual([1, 2]);

    // Fresh replay: score is home 3 – away 0
    expect(scoreReducer(events)).toMatchObject({ home: 3, away: 0 });
    expect(statsFor(playerStatsReducer(events), 'H1').pts).toBe(3);

    // Redo 3 — reappending in reverse-of-undo order (stack pop) restores chronologically
    let redoStack = [...undoStack];
    let g = { ...scripted, events };
    for (let i = 0; i < 3; i++) {
      g = appendEvents(g, redoStack.pop());
    }
    // 3 groups back → events 1..7 (SHOT_MADE A1 seq 3 + foul-group seqs 4-6 + SHOT_MADE A2 seq 7)
    expect(g.events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // Reducers match a fresh replay of just seqs 1..7 of the original
    const original7 = scripted.events.slice(0, 7);
    expect(scoreReducer(g.events)).toEqual(scoreReducer(original7));
    expect(teamFoulsReducer(g.events)).toEqual(teamFoulsReducer(original7));
    expect(playerStatsReducer(g.events)).toEqual(playerStatsReducer(original7));

    // A new append after redo lands at seq 8, and (App-level) clears the redo buffer
    const withNew = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H3', payload: { points: 2 } }]);
    expect(withNew.events[withNew.events.length - 1].seq).toBe(8);
  });

  it('seqs stay gapless and monotonic through arbitrary undo/redo interleavings', () => {
    let events = scripted.events;
    const stack = [];
    for (let i = 0; i < 4; i++) {
      const [remaining, removed] = popLastGroup(events);
      events = remaining;
      stack.push(removed);
    }
    let g = { ...scripted, events };
    g = appendEvents(g, stack.pop());
    g = appendEvents(g, stack.pop());
    const seqs = g.events.map((e) => e.seq);
    expect(seqs).toEqual(seqs.slice().sort((a, b) => a - b));
    expect(seqs[0]).toBe(1);
    expect(seqs[seqs.length - 1]).toBe(seqs.length);
  });
});

describe('Scenario 15 — correction vs. undo', () => {
  it('CORRECTION voids the target: reducers treat it as absent, but the event stays in the log', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);
    g = appendEvents(g, [{ type: 'CORRECTION', payload: { voidsSeq: 2, reason: 'ref waved off' } }]);

    expect(g.events).toHaveLength(3); // event #2 is NOT removed
    expect(voidedSeqs(g.events).has(2)).toBe(true);
    expect(scoreReducer(g.events)).toMatchObject({ home: 0, away: 0 });

    const log = logReducer(g.events, rosters);
    const shotEntry = log.find((e) => e.seq === 2);
    expect(shotEntry.voided).toBe(true);
    expect(shotEntry.text).toContain('made a 3-point shot');
    const correctionEntry = log.find((e) => e.seq === 3);
    expect(correctionEntry.text).toContain('Correction: voids event #2');
    expect(correctionEntry.text).toContain('ref waved off');
  });

  it('undo removes an event outright — no correction trace, no voided flag', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);

    const [remaining] = popLastGroup(g.events);
    expect(remaining).toHaveLength(1);
    expect(voidedSeqs(remaining).size).toBe(0);
    expect(scoreReducer(remaining)).toMatchObject({ home: 0, away: 0 });
  });

  it('undoing a CORRECTION un-voids the target (voidedSeqs recomputed from the log)', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);
    g = appendEvents(g, [{ type: 'CORRECTION', payload: { voidsSeq: 2, reason: 'ref waved off' } }]);

    const [afterUndo] = popLastGroup(g.events);
    // Correction gone → shot scores again
    expect(voidedSeqs(afterUndo).has(2)).toBe(false);
    expect(scoreReducer(afterUndo)).toMatchObject({ home: 3, away: 0 });
  });
});

describe('describeLastGroup / groupsFromAndIncluding', () => {
  let g = newGame();
  g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
  g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 2 } }]);
  g = appendEvents(g, [
    { type: 'FOUL', team: 'away', playerId: 'A2', payload: { foulType: 'personal', shooting: false } },
    { type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 }, context: 'bonus' } },
  ]);

  it('describeLastGroup returns log strings for the group that would be undone', () => {
    const lines = describeLastGroup(g.events, rosters);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/personal foul/);
    expect(lines[1]).toMatch(/free throw 1 of 2/);
  });

  it('groupsFromAndIncluding counts distinct groups from a seq to the end', () => {
    // Seq 2 is its own group; the trailing foul group has 2 events sharing groupSeq.
    // "From seq 2 to end" spans 2 groups.
    expect(groupsFromAndIncluding(g.events, 2)).toBe(2);
    expect(groupsFromAndIncluding(g.events, 3)).toBe(1); // just the foul group
    expect(groupsFromAndIncluding(g.events, 999)).toBe(0);
  });
});

describe('appendEvent (single) plays nicely with popLastGroup even without an explicit groupSeq', () => {
  it('a single event committed via appendEvent has no groupSeq; popLastGroup falls back to seq', () => {
    let g = newGame();
    g = appendEvent(g, { type: 'PERIOD_START', payload: { period: 1 } });
    g = appendEvent(g, { type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 2 } });
    expect(g.events[1].groupSeq).toBeUndefined();
    const [remaining, removed] = popLastGroup(g.events);
    expect(remaining).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });
});
