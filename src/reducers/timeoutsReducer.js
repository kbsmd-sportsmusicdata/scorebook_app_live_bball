import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';
import { currentPeriod } from '../writers/appendEvent.js';

// Pure function over events[]: 30-second timeouts remaining per team in the
// CURRENT allotment window (S11). Landed in Phase 3 rather than Phase 5
// because the excessive-timeout technical's entry point is the TIMEOUT flow,
// which must know the remaining count is zero (dry-run finding 2).
//
// Allotment windows: 1st half (Q1–Q2) and 2nd half (Q3–Q4) each grant
// perTeamPerHalf.thirtySecond with NO carryover; every OT period grants its
// own overtimePerTeam.thirtySecond. League mandatory timeouts are charged to
// neither team; excessive timeouts never decrement (there was nothing left).

export function timeoutWindow(period) {
  if (period == null) return null;
  if (period > WPBA.periods) return `OT${period - WPBA.periods}`;
  return period <= WPBA.periods / 2 ? 'H1' : 'H2';
}

export function timeoutsReducer(events) {
  const active = activeEvents(events);
  const period = currentPeriod(active);
  const window = timeoutWindow(period);
  const allotment =
    window == null
      ? 0
      : window.startsWith('OT')
        ? WPBA.timeouts.overtimePerTeam.thirtySecond
        : WPBA.timeouts.perTeamPerHalf.thirtySecond;

  const used = { home: 0, away: 0 };
  let mandatoryUsedThisPeriod = 0;

  for (const event of active) {
    if (event.type !== 'TIMEOUT') continue;
    if (event.payload?.toType === 'thirty' && timeoutWindow(event.period) === window) {
      if (event.team === 'home' || event.team === 'away') used[event.team] += 1;
    }
    if (event.payload?.toType === 'mandatory' && event.period === period) {
      mandatoryUsedThisPeriod += 1;
    }
  }

  return {
    window,
    home: { remaining: Math.max(0, allotment - used.home) },
    away: { remaining: Math.max(0, allotment - used.away) },
    mandatoryAvailableThisPeriod: period != null && mandatoryUsedThisPeriod < WPBA.timeouts.leagueMandatory.perQuarter,
  };
}
