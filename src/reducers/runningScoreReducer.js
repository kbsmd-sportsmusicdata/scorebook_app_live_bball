import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';

// Pure function over events[]: the classic paper-scorebook running column —
// one row per scoring event, in log order, carrying who scored, how many
// points, and both teams' cumulative totals after the play. Missed shots and
// non-scoring events are excluded; voided events are skipped (S15).
//
// Row shape: { seq, ts, period, team, playerId, eventType, points, cumulative: { home, away } }

export function runningScoreReducer(events) {
  const rows = [];
  const totals = { home: 0, away: 0 };

  for (const event of activeEvents(events)) {
    let points = 0;
    if (event.type === 'SHOT_MADE') points = event.payload?.points ?? 0;
    else if (event.type === 'FT_MADE') points = WPBA.freeThrowPoints;
    if (points <= 0) continue;
    if (event.team !== 'home' && event.team !== 'away') continue;

    totals[event.team] += points;
    rows.push({
      seq: event.seq,
      ts: event.ts,
      period: event.period,
      team: event.team,
      playerId: event.playerId,
      eventType: event.type,
      points,
      cumulative: { ...totals },
    });
  }

  return rows;
}
