import { WPBA } from '../rules/wpba.js';
import { timeoutsReducer, timeoutWindow } from '../reducers/timeoutsReducer.js';
import { activeEvents } from '../reducers/voids.js';
import { currentPeriod } from '../writers/appendEvent.js';

// Full timeouts breakdown (S11). Shows remaining per team in the current
// allotment window (H1, H2, or OT), running list of team timeouts used, and
// whether the league mandatory timeout for the current quarter is still
// available. Reads all rule numbers from WPBA config.

function used30s(events, window) {
  const list = [];
  for (const event of activeEvents(events)) {
    if (event.type !== 'TIMEOUT') continue;
    if (event.payload?.toType !== 'thirty') continue;
    if (timeoutWindow(event.period) !== window) continue;
    list.push(event);
  }
  return list;
}

function mandatoryUsedThisPeriod(events, period) {
  const list = [];
  for (const event of activeEvents(events)) {
    if (event.type !== 'TIMEOUT') continue;
    if (event.payload?.toType !== 'mandatory') continue;
    if (event.period !== period) continue;
    list.push(event);
  }
  return list;
}

export default function TimeoutsPanel({ game }) {
  const t = timeoutsReducer(game.events);
  const period = currentPeriod(game.events);
  const active = activeEvents(game.events);
  const allotment = t.window?.startsWith('OT')
    ? WPBA.timeouts.overtimePerTeam.thirtySecond
    : WPBA.timeouts.perTeamPerHalf.thirtySecond;
  const windowLabel = t.window == null ? '—' : t.window === 'H1' ? '1st half' : t.window === 'H2' ? '2nd half' : t.window;
  const teamUsed = { home: 0, away: 0 };
  for (const event of used30s(active, t.window)) {
    if (event.team === 'home' || event.team === 'away') teamUsed[event.team] += 1;
  }
  const mandatoryList = period == null ? [] : mandatoryUsedThisPeriod(active, period);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Timeouts</h2>
        <span className="text-xs font-semibold text-slate-400">{windowLabel}</span>
      </div>
      <div className="flex flex-col gap-2">
        {['home', 'away'].map((side) => (
          <div key={side} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
            <span className="text-sm font-semibold" style={{ color: game.rosters[side].color }}>
              {game.rosters[side].name}
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: allotment }, (_, i) => {
                const isUsed = i < teamUsed[side];
                return (
                  <span
                    key={i}
                    className={`inline-block h-3 w-6 rounded-sm ${isUsed ? 'bg-slate-300' : ''}`}
                    style={!isUsed ? { backgroundColor: game.rosters[side].color } : undefined}
                    title={isUsed ? 'used' : 'available'}
                  />
                );
              })}
              <span className="ml-2 text-xs font-semibold tabular-nums text-slate-500">
                {t[side].remaining}/{allotment}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
          <span className="font-semibold text-slate-600">League mandatory (60s)</span>
          <span className={t.mandatoryAvailableThisPeriod ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
            {t.mandatoryAvailableThisPeriod
              ? 'available this quarter'
              : mandatoryList.length > 0
                ? 'taken'
                : period == null
                  ? '—'
                  : 'unavailable'}
          </span>
        </div>
      </div>
    </section>
  );
}
