import { periodLabel } from '../reducers/periodLabel.js';

// Sticky score bar: totals + per-period splits, straight from scoreReducer.
// Bonus/penalty state lives here too (fix from Krystal's live testing): the
// FOULING team shows a red PENALTY chip next to its own team-foul count the
// moment its 5th foul lands, and the team that SHOOTS shows the green BONUS
// chip — both visible at the top of the screen, not buried in a lower panel.
export default function ScoreBar({ score, rosters, teamFouls }) {
  const other = (side) => (side === 'home' ? 'away' : 'home');
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-6">
        {['home', 'away'].map((side) => {
          // bonus[other(side)] true ⇒ THIS side's fouls crossed the threshold
          const inPenalty = teamFouls?.bonus?.[other(side)] ?? false;
          const shootsBonus = teamFouls?.bonus?.[side] ?? false;
          return (
            <div key={side} className="flex items-center gap-3">
              <span
                className="h-8 w-2 rounded-full"
                style={{ backgroundColor: rosters[side].color }}
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {rosters[side].name}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-slate-800">{score[side]}</span>
                  {teamFouls?.teamFouls && (
                    <span className="text-xs tabular-nums text-slate-400" title="team fouls this period">
                      TF {teamFouls.teamFouls[side]}
                    </span>
                  )}
                  {inPenalty && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Penalty
                    </span>
                  )}
                  {shootsBonus && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Bonus
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {score.byPeriod.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-sm tabular-nums">
            <thead>
              <tr className="text-slate-400">
                <th className="pr-3 text-left font-medium"> </th>
                {score.byPeriod.map((p) => (
                  <th key={p.period} className="px-2 text-center font-medium">
                    {periodLabel(p.period)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['home', 'away'].map((side) => (
                <tr key={side} className="text-slate-700">
                  <td className="pr-3 font-semibold" style={{ color: rosters[side].color }}>
                    {rosters[side].name}
                  </td>
                  {score.byPeriod.map((p) => (
                    <td key={p.period} className="px-2 text-center">
                      {p[side]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
