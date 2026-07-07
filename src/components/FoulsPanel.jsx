import { WPBA } from '../rules/wpba.js';
import { statsFor } from '../reducers/playerStatsReducer.js';
import { periodLabel } from '../reducers/periodLabel.js';

// Phase 2 derived view: team fouls this period + BONUS badge, and per-player
// foul dots with DQ/ejection flags. Pure render over reducer output.

function FoulDots({ count }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" title={`${count} fouls`}>
      {Array.from({ length: WPBA.playerFoulLimit }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            // per the player-lifecycle diagram: warn at fouls 4–5, red at 6 (DQ)
            i < count ? (count >= WPBA.playerFoulLimit ? 'bg-red-600' : i >= WPBA.playerFoulLimit - 3 ? 'bg-amber-500' : 'bg-slate-600') : 'bg-slate-200'
          }`}
        />
      ))}
    </span>
  );
}

export default function FoulsPanel({ teamFouls, playerStats, rosters }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {['home', 'away'].map((side) => {
        const team = rosters[side];
        return (
          <section
            key={side}
            className="rounded-2xl bg-white p-4 shadow-sm"
            style={{ borderTop: `4px solid ${team.color}` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: team.color }}>
                {team.name}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">
                  Team fouls{teamFouls.period != null ? ` (${periodLabel(teamFouls.period)})` : ''}:
                </span>
                <span className="font-bold tabular-nums text-slate-800">
                  {teamFouls.teamFouls[side]}
                </span>
                {teamFouls.bonus[side] && (
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Bonus
                  </span>
                )}
                {teamFouls.lastTwoArmed && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600" title="LAST_TWO_START armed this period">
                    2:00
                  </span>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-1 font-medium">Player</th>
                  <th className="pb-1 font-medium">Fouls</th>
                  <th className="pb-1 text-center font-medium">T</th>
                  <th className="pb-1 text-right font-medium">PTS</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((p) => {
                  const s = statsFor(playerStats, p.playerId);
                  const out = s.dq || s.ejected;
                  return (
                    <tr key={p.playerId} className={out ? 'text-slate-400' : 'text-slate-700'}>
                      <td className="py-1">
                        <span className={out ? 'line-through' : ''}>
                          {p.jersey != null ? `#${p.jersey} ` : ''}
                          {p.name}
                        </span>
                        {s.dq && !s.ejected && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            DQ
                          </span>
                        )}
                        {s.ejected && (
                          <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                            Ejected
                          </span>
                        )}
                      </td>
                      <td className="py-1">
                        <FoulDots count={s.fouls} />
                      </td>
                      <td
                        className="py-1 text-center tabular-nums"
                        title={s.reentryTechnicals > 0 ? `${s.technicals} conduct + ${s.reentryTechnicals} re-entry` : undefined}
                      >
                        {s.technicals + s.reentryTechnicals > 0 ? s.technicals + s.reentryTechnicals : ''}
                      </td>
                      <td className="py-1 text-right font-semibold tabular-nums">{s.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
