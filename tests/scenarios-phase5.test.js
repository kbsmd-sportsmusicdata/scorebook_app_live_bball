// Phase 5 fixtures: S11 (timeouts panel display), S12 (7-point standings),
// S14 (export → wipe → import round-trip), plus the new derived-view
// reducers and their edge cases.
import { describe, it, expect } from 'vitest';
import { runningScoreReducer } from '../src/reducers/runningScoreReducer.js';
import { boxScoreReducer } from '../src/reducers/boxScoreReducer.js';
import { quarterPointsReducer } from '../src/reducers/quarterPointsReducer.js';
import { timeoutsReducer } from '../src/reducers/timeoutsReducer.js';
import { scoreReducer } from '../src/reducers/scoreReducer.js';
import { teamFoulsReducer } from '../src/reducers/teamFoulsReducer.js';
import { playerStatsReducer, statsFor } from '../src/reducers/playerStatsReducer.js';
import { logReducer } from '../src/reducers/logReducer.js';
import { gamePhaseReducer } from '../src/reducers/gamePhaseReducer.js';
import { onCourtReducer } from '../src/reducers/onCourtReducer.js';
import { appendEvents } from '../src/writers/appendEvent.js';
import { createGame } from '../src/writers/createGame.js';
import { exportGame, toJson, importGame, fileNameFor } from '../src/writers/exportGame.js';

const rosters = {
  home: {
    teamId: '675230',
    name: 'Home',
    color: '#111',
    starterIds: ['H1', 'H2', 'H3', 'H4', 'H5'],
    players: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1), position: 'G' })),
    coaches: [{ name: 'HC', role: 'Head Coach', coachId: '675230-coach-hc' }],
  },
  away: {
    teamId: '675231',
    name: 'Away',
    color: '#222',
    starterIds: ['A1', 'A2', 'A3', 'A4', 'A5'],
    players: ['A1', 'A2', 'A3', 'A4', 'A5'].map((id) => ({ playerId: id, name: id, jersey: id.slice(1), position: 'G' })),
    coaches: [{ name: 'AC', role: 'Head Coach', coachId: '675231-coach-ac' }],
  },
};

const newGame = () => ({
  gameId: 'wpba-test',
  meta: { homeTeamId: '675230', awayTeamId: '675231', rules: 'WPBA', createdAt: 0 },
  rosters,
  events: [],
});

describe('runningScoreReducer', () => {
  it('emits one row per scoring event, carrying both cumulative totals', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MISSED', team: 'home', playerId: 'H1', payload: { shotValue: 2 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'away', playerId: 'A1', payload: { points: 2 } }]);
    g = appendEvents(g, [{ type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 }, context: 'bonus' } }]);
    const rows = runningScoreReducer(g.events);
    expect(rows.map((r) => r.points)).toEqual([3, 2, 1]);
    expect(rows.map((r) => r.cumulative)).toEqual([
      { home: 3, away: 0 },
      { home: 3, away: 2 },
      { home: 4, away: 2 },
    ]);
    expect(rows.map((r) => r.team)).toEqual(['home', 'away', 'home']);
  });

  it('a CORRECTION-voided basket does not appear as a running-score row (S15)', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'away', playerId: 'A1', payload: { points: 2 } }]);
    g = appendEvents(g, [{ type: 'CORRECTION', payload: { voidsSeq: 2, reason: 'ref waved off' } }]);
    const rows = runningScoreReducer(g.events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ team: 'away', points: 2, cumulative: { home: 0, away: 2 } });
  });
});

describe('Scenario 12 — quarter points (7-point standings)', () => {
  const scriptedRegulation = (Q1H, Q1A, Q2H, Q2A, Q3H, Q3A, Q4H, Q4A) => {
    let g = newGame();
    const shots = (team, points) => ({ type: 'SHOT_MADE', team, playerId: team === 'home' ? 'H1' : 'A1', payload: { points } });
    const twos = (team, total) => Array.from({ length: total / 2 }, () => shots(team, 2));
    const quarter = (n, home, away) => {
      g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: n } }]);
      if (home > 0) g = appendEvents(g, twos('home', home));
      if (away > 0) g = appendEvents(g, twos('away', away));
      g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: n } }]);
    };
    quarter(1, Q1H, Q1A);
    quarter(2, Q2H, Q2A);
    quarter(3, Q3H, Q3A);
    quarter(4, Q4H, Q4A);
    return g;
  };

  it('S12 exact scoring — 62–58 with the stated per-period splits', () => {
    // Direct-construct an events log with the exact per-period totals from S12.
    let g = newGame();
    const commitScore = (period, team, total) => {
      // Fill with 2-pointers until 1 or 0 remaining; if remainder, add a 1-point FT
      let remaining = total;
      while (remaining >= 2) {
        g = appendEvents(g, [{ type: 'SHOT_MADE', team, playerId: team === 'home' ? 'H1' : 'A1', payload: { points: 2 } }]);
        remaining -= 2;
      }
      while (remaining > 0) {
        g = appendEvents(g, [{ type: 'FT_MADE', team, playerId: team === 'home' ? 'H1' : 'A1', payload: { attemptOf: { n: 1, of: 1 }, context: 'bonus' } }]);
        remaining -= 1;
      }
    };
    // Q1: home 18 – away 12
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    commitScore(1, 'home', 18);
    commitScore(1, 'away', 12);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 1 } }]);
    // Q2: home 10 – away 15
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 2 } }]);
    commitScore(2, 'home', 10);
    commitScore(2, 'away', 15);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 2 } }]);
    // Q3: 14–14
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 3 } }]);
    commitScore(3, 'home', 14);
    commitScore(3, 'away', 14);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 3 } }]);
    // Q4: 20–17
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 4 } }]);
    commitScore(4, 'home', 20);
    commitScore(4, 'away', 17);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 4 } }]);

    // Sanity: totals match
    const score = scoreReducer(g.events);
    expect(score).toMatchObject({
      home: 62,
      away: 58,
      byPeriod: [
        { period: 1, home: 18, away: 12 },
        { period: 2, home: 10, away: 15 },
        { period: 3, home: 14, away: 14 },
        { period: 4, home: 20, away: 17 },
      ],
    });

    const qp = quarterPointsReducer(g.events);
    // Home: 3 game win + 1 (Q1) + 0 (Q2) + 0.5 (Q3 tie) + 1 (Q4) = 5.5
    // Away: 0 game win + 0 + 1 + 0.5 + 0 = 1.5
    expect(qp.home).toMatchObject({ quarterPoints: 2.5, gameWinPoints: 3, total: 5.5 });
    expect(qp.away).toMatchObject({ quarterPoints: 1.5, gameWinPoints: 0, total: 1.5 });
    expect(qp.home.total + qp.away.total).toBe(7);
  });

  it('sanity invariant: home.total + away.total === 7 for any completed game', () => {
    const g = scriptedRegulation(2, 0, 4, 8, 6, 6, 10, 4);
    const qp = quarterPointsReducer(g.events);
    expect(qp.home.total + qp.away.total).toBe(7);
  });

  it("OT does NOT add quarter points (Krystal default): a game where regulation ended tied and home wins in OT", () => {
    let g = newGame();
    // Regulation tied 20-20 with even quarters: Q1 5-5, Q2 5-5, Q3 5-5, Q4 5-5
    const twos = (team) => ({ type: 'SHOT_MADE', team, playerId: team === 'home' ? 'H1' : 'A1', payload: { points: 2 } });
    const oneFt = (team) => ({ type: 'FT_MADE', team, playerId: team === 'home' ? 'H1' : 'A1', payload: { attemptOf: { n: 1, of: 1 }, context: 'bonus' } });
    for (let p = 1; p <= 4; p++) {
      g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: p } }]);
      g = appendEvents(g, [twos('home'), twos('home'), oneFt('home')]); // 5 home
      g = appendEvents(g, [twos('away'), twos('away'), oneFt('away')]); // 5 away
      g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: p } }]);
    }
    // OT: home wins by 3
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 5 } }]);
    g = appendEvents(g, [twos('home')]);
    g = appendEvents(g, [oneFt('home')]);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 5 } }]);

    const qp = quarterPointsReducer(g.events);
    // Regulation quarters all tied → 0.5 each per quarter × 4 = 2 each
    expect(qp.home.quarterPoints).toBe(2);
    expect(qp.away.quarterPoints).toBe(2);
    // Home wins overall → 3 game-win points
    expect(qp.home.gameWinPoints).toBe(3);
    expect(qp.away.gameWinPoints).toBe(0);
    expect(qp.home.total + qp.away.total).toBe(7);
    // Explicitly: no P5 entry in the per-quarter breakdown
    expect(qp.home.quarters).not.toHaveProperty('5');
  });
});

describe('boxScoreReducer', () => {
  it('produces per-team totals matching scoreReducer and lists every rostered player', () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H2', payload: { points: 2 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'away', playerId: 'A1', payload: { points: 2 } }]);
    const box = boxScoreReducer(g.events, rosters);
    expect(box.totals.home.pts).toBe(5);
    expect(box.totals.away.pts).toBe(2);
    expect(box.rows.home).toHaveLength(rosters.home.players.length); // all 6, including bench
    const h6 = box.rows.home.find((p) => p.playerId === 'H6');
    expect(h6).toMatchObject({ pts: 0, fgm: 0, fga: 0, fouls: 0 });
  });
});

describe('Scenario 14 — export → import round-trip', () => {
  const scriptedHalfCoveringEveryTaxonomyType = () => {
    let g = newGame();
    g = appendEvents(g, [{ type: 'PERIOD_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'SHOT_MADE', team: 'home', playerId: 'H1', payload: { points: 3, assistedBy: null } }]);
    g = appendEvents(g, [{ type: 'SHOT_MISSED', team: 'away', playerId: 'A1', payload: { shotValue: 2, assistedBy: null, reboundedBy: null } }]);
    g = appendEvents(g, [
      // foul + FT sequence — verifies groupSeq round-trips
      { type: 'FOUL', team: 'away', playerId: 'A2', payload: { foulType: 'personal', shooting: true, shotValue: 2, made: false, fouledPlayer: 'H1' } },
      { type: 'FT_MADE', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 1, of: 2 }, context: 'shootingFoul' } },
      { type: 'FT_MISSED', team: 'home', playerId: 'H1', payload: { attemptOf: { n: 2, of: 2 }, context: 'shootingFoul' } },
    ]);
    g = appendEvents(g, [{ type: 'TIMEOUT', team: 'home', payload: { toType: 'thirty' } }]);
    g = appendEvents(g, [{ type: 'TIMEOUT', team: 'league', payload: { toType: 'mandatory' } }]);
    g = appendEvents(g, [
      { type: 'SUB_OUT', team: 'home', playerId: 'H1', payload: {} },
      { type: 'SUB_IN', team: 'home', playerId: 'H6', payload: {} },
    ]);
    g = appendEvents(g, [{ type: 'LAST_TWO_START', payload: { period: 1 } }]);
    g = appendEvents(g, [{ type: 'POSSESSION_ARROW_FLIP', payload: {} }]);
    g = appendEvents(g, [{ type: 'CORRECTION', payload: { voidsSeq: 2, reason: 'ref waved off the 3' } }]);
    g = appendEvents(g, [{ type: 'PERIOD_END', payload: { period: 1 } }]);
    return g;
  };

  const source = scriptedHalfCoveringEveryTaxonomyType();

  it('exportGame produces ONLY { gameId, meta, rosters, events } — no derived fields', () => {
    // Even if the caller sneaks a cached-state field onto the game object, export strips it
    const contaminated = { ...source, score: { home: 999 }, byPeriod: [{ home: 42 }] };
    const exported = exportGame(contaminated);
    expect(Object.keys(exported).sort()).toEqual(['events', 'gameId', 'meta', 'rosters']);
    expect(exported).not.toHaveProperty('score');
    expect(exported).not.toHaveProperty('byPeriod');
  });

  it('toJson → parse → importGame produces a game whose reducers match the source exactly', () => {
    const json = toJson(source);
    const restored = importGame(json);

    for (const reducer of [scoreReducer, teamFoulsReducer, playerStatsReducer, gamePhaseReducer]) {
      expect(reducer(restored.events)).toEqual(reducer(source.events));
    }
    for (const reducer of [logReducer, boxScoreReducer]) {
      expect(reducer(restored.events, restored.rosters)).toEqual(reducer(source.events, source.rosters));
    }
    expect(onCourtReducer(restored.events, restored.rosters)).toEqual(onCourtReducer(source.events, source.rosters));
    expect(quarterPointsReducer(restored.events)).toEqual(quarterPointsReducer(source.events));
    expect(runningScoreReducer(restored.events)).toEqual(runningScoreReducer(source.events));
    expect(timeoutsReducer(restored.events)).toEqual(timeoutsReducer(source.events));
  });

  it('importGame rejects a malformed document with an actionable error', () => {
    expect(() => importGame('{}')).toThrow(/missing meta/);
    expect(() => importGame(JSON.stringify({ meta: {}, rosters: {}, events: [] }))).toThrow(/rosters\.home/);
    expect(() => importGame(JSON.stringify({ meta: {}, rosters: { home: {}, away: {} }, events: 'oops' }))).toThrow(/events must be an array/);
    expect(() => importGame('not-json')).toThrow();
  });

  it('createGame + exportGame round-trip preserves the setup document', () => {
    const setupGame = createGame({
      home: { team: { ...rosters.home }, starterIds: rosters.home.starterIds },
      away: { team: { ...rosters.away }, starterIds: rosters.away.starterIds },
    });
    const restored = importGame(toJson(setupGame));
    expect(restored.gameId).toBe(setupGame.gameId);
    expect(restored.rosters.home.starterIds).toEqual(setupGame.rosters.home.starterIds);
  });

  it('fileNameFor uses gameId and is safe for filesystems', () => {
    const name = fileNameFor(source);
    expect(name).toMatch(/^wpba-test--\d{4}-\d{2}-\d{2}T/);
    expect(name).toMatch(/\.json$/);
    expect(name).not.toMatch(/[/\\:]/);
  });

  it('fileNameFor sanitizes hostile characters in gameId', () => {
    const evil = { gameId: '../../../etc/passwd:leak?' };
    const name = fileNameFor(evil);
    expect(name).not.toMatch(/[/\\:?]/);
    expect(name).not.toContain('..');
    expect(name).toMatch(/\.json$/);
  });
});
