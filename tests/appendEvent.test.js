import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appendEvent, currentPeriod, _setClock } from '../src/writers/appendEvent.js';

const emptyGame = () => ({ meta: {}, rosters: {}, events: [] });

beforeEach(() => _setClock(() => 1720735012345));
afterEach(() => _setClock(null));

describe('appendEvent', () => {
  it('assigns gapless, monotonic seq starting at 1', () => {
    let game = emptyGame();
    game = appendEvent(game, { type: 'PERIOD_START', payload: { period: 1 } });
    game = appendEvent(game, { type: 'SHOT_MADE', team: 'home', playerId: '675230-3', payload: { points: 2 } });
    game = appendEvent(game, { type: 'PERIOD_END', payload: { period: 1 } });
    expect(game.events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('never mutates the input game (append-only, pure)', () => {
    const game = emptyGame();
    const next = appendEvent(game, { type: 'PERIOD_START', payload: { period: 1 } });
    expect(game.events).toHaveLength(0);
    expect(next.events).toHaveLength(1);
    expect(next).not.toBe(game);
  });

  it('stamps envelope fields: ts, period, team, playerId', () => {
    let game = emptyGame();
    game = appendEvent(game, { type: 'PERIOD_START', payload: { period: 2 } });
    game = appendEvent(game, { type: 'FOUL', team: 'away', playerId: '675231-22', payload: { foulType: 'personal', shooting: false } });
    const foul = game.events[1];
    expect(foul).toMatchObject({
      seq: 2,
      ts: 1720735012345,
      period: 2,
      type: 'FOUL',
      team: 'away',
      playerId: '675231-22',
    });
  });

  it('derives period from the latest PERIOD_START (never stored)', () => {
    let game = emptyGame();
    game = appendEvent(game, { type: 'PERIOD_START', payload: { period: 1 } });
    game = appendEvent(game, { type: 'PERIOD_END', payload: { period: 1 } });
    game = appendEvent(game, { type: 'PERIOD_START', payload: { period: 5 } }); // OT
    game = appendEvent(game, { type: 'SHOT_MADE', team: 'home', playerId: 'x', payload: { points: 3 } });
    expect(currentPeriod(game.events)).toBe(5);
    expect(game.events[3].period).toBe(5);
  });

  it('rejects unknown event types', () => {
    expect(() => appendEvent(emptyGame(), { type: 'REBOUND' })).toThrow(/Unknown event type/);
  });

  it('rejects events before the opening PERIOD_START', () => {
    expect(() =>
      appendEvent(emptyGame(), { type: 'SHOT_MADE', team: 'home', playerId: 'x', payload: { points: 2 } }),
    ).toThrow(/PERIOD_START/);
  });
});
