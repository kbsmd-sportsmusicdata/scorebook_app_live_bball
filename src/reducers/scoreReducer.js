import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';

// Pure function over events[]: home/away totals + per-period splits.
// Replaces v1's sticky score bar + period summary (spec §3). Never caches —
// callers memoize at the React layer if they care (they won't need to at
// basketball event volumes).
//
// Returns { home, away, byPeriod: [{ period, home, away }] } with byPeriod in
// period order, including scoreless periods that have started.

function pointsFor(event) {
  if (event.type === 'SHOT_MADE') return event.payload.points;
  if (event.type === 'FT_MADE') return WPBA.freeThrowPoints;
  return 0;
}

export function scoreReducer(events) {
  const totals = { home: 0, away: 0 };
  const byPeriodMap = new Map();

  const periodEntry = (period) => {
    if (!byPeriodMap.has(period)) byPeriodMap.set(period, { period, home: 0, away: 0 });
    return byPeriodMap.get(period);
  };

  for (const event of activeEvents(events)) {
    if (event.period == null) continue; // malformed — appendEvent never emits this
    if (event.type === 'PERIOD_START') {
      periodEntry(event.period);
      continue;
    }
    const points = pointsFor(event);
    if (points > 0 && (event.team === 'home' || event.team === 'away')) {
      totals[event.team] += points;
      periodEntry(event.period)[event.team] += points;
    }
  }

  return {
    ...totals,
    byPeriod: [...byPeriodMap.values()].sort((a, b) => a.period - b.period),
  };
}
