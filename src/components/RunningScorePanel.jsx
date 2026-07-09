import { runningScoreReducer } from '../reducers/runningScoreReducer.js';
import { periodLabel } from '../reducers/periodLabel.js';

// The paper-scorebook running column, digitalized. Two side-by-side lists of
// scoring events with the cumulative totals after each score. Grouped by
// period (the classic layout has a header before each quarter). New rows push
// to the bottom; the panel scrolls independently.

function playerName(rosters, side, playerId) {
  const p = rosters[side].players.find((x) => x.playerId === playerId);
  if (!p) return playerId ?? '?';
  if (p.jersey != null) return `#${p.jersey}`;
  if (!p.name) return '?'; // per the scorer-log convention: obviously broken beats plausible
  return p.name.split(/\s+/).map((s) => s[0]).join('');
}

export default function RunningScorePanel({ game }) {
  const rows = runningScoreReducer(game.events);
  const byPeriod = new Map();
  for (const row of rows) {
    if (!byPeriod.has(row.period)) byPeriod.set(row.period, []);
    byPeriod.get(row.period).push(row);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Running score</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No made shots yet.</p>
      ) : (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
          {[...byPeriod.entries()].map(([period, periodRows]) => (
            <div key={period}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {periodLabel(period)}
              </div>
              <ol className="flex flex-col gap-0.5 text-sm tabular-nums">
                {periodRows.map((row) => {
                  const isHome = row.team === 'home';
                  const teamColor = game.rosters[row.team].color;
                  return (
                    <li key={row.seq} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <span className="text-right font-semibold" style={{ color: isHome ? teamColor : '#94a3b8' }}>
                        {isHome ? (
                          <>
                            <span className="font-mono">{row.cumulative.home}</span>{' '}
                            <span className="text-xs text-slate-500">
                              {playerName(game.rosters, 'home', row.playerId)} +{row.points}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                      <span className="text-xs text-slate-300">|</span>
                      <span className="font-semibold" style={{ color: !isHome ? teamColor : '#94a3b8' }}>
                        {!isHome ? (
                          <>
                            <span className="font-mono">{row.cumulative.away}</span>{' '}
                            <span className="text-xs text-slate-500">
                              {playerName(game.rosters, 'away', row.playerId)} +{row.points}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
