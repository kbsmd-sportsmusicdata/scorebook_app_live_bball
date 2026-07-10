import { WPBA } from '../rules/wpba.js';
import { quarterPointsReducer } from '../reducers/quarterPointsReducer.js';
import { periodLabel } from '../reducers/periodLabel.js';
import { Modal } from './ui.jsx';

// The WPBA 7-point standings sheet (S12). Renders quarter-by-quarter with the
// standings award per quarter, plus the 3-point game-win award at the bottom.

export default function StandingsModal({ game, onClose }) {
  const qp = quarterPointsReducer(game.events);
  const quarters = Array.from({ length: WPBA.periods }, (_, i) => i + 1);

  const quarterAwardText = (h, a) => {
    if (h == null || a == null) return '—';
    if (h > a) return `${game.rosters.home.name} +${WPBA.standings.quarterWin}`;
    if (a > h) return `${game.rosters.away.name} +${WPBA.standings.quarterWin}`;
    return `Tied — ${WPBA.standings.quarterTie} each`;
  };

  return (
    <Modal title="7-point standings" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        Recorded in the scorebook for the league standings. {WPBA.standings.gameWin} for the game win,{' '}
        {WPBA.standings.quarterWin} per regulation quarter won, {WPBA.standings.quarterTie} each for a tied quarter. Totals always sum to{' '}
        {WPBA.standings.gameWin + WPBA.periods * WPBA.standings.quarterWin}.
      </p>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-1 font-medium">Quarter</th>
            <th className="py-1 text-right font-medium" style={{ color: game.rosters.home.color }}>
              {game.rosters.home.name}
            </th>
            <th className="py-1 text-right font-medium" style={{ color: game.rosters.away.color }}>
              {game.rosters.away.name}
            </th>
            <th className="py-1 text-right font-medium">Award</th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => {
            const h = qp.home.quarters[q];
            const a = qp.away.quarters[q];
            return (
              <tr key={q} className="border-b border-slate-100">
                <td className="py-1 font-semibold">{periodLabel(q)}</td>
                <td className="py-1 text-right">{h ?? '—'}</td>
                <td className="py-1 text-right">{a ?? '—'}</td>
                <td className="py-1 text-right text-xs text-slate-600">{quarterAwardText(h, a)}</td>
              </tr>
            );
          })}
          <tr className="border-b border-slate-200 bg-slate-50">
            <td className="py-1 font-semibold">Quarter points</td>
            <td className="py-1 text-right font-bold">{qp.home.quarterPoints}</td>
            <td className="py-1 text-right font-bold">{qp.away.quarterPoints}</td>
            <td className="py-1"></td>
          </tr>
          <tr className="border-b border-slate-200">
            <td className="py-1 font-semibold">Game win ({WPBA.standings.gameWin} pts)</td>
            <td className="py-1 text-right">{qp.home.gameWinPoints}</td>
            <td className="py-1 text-right">{qp.away.gameWinPoints}</td>
            <td className="py-1 text-right text-xs text-slate-600">
              {qp.home.gameWinPoints > qp.away.gameWinPoints
                ? `${game.rosters.home.name} +${WPBA.standings.gameWin}`
                : qp.away.gameWinPoints > qp.home.gameWinPoints
                  ? `${game.rosters.away.name} +${WPBA.standings.gameWin}`
                  : 'No decision yet'}
            </td>
          </tr>
          <tr>
            <td className="py-2 text-sm font-bold uppercase tracking-wide">Standings total</td>
            <td className="py-2 text-right text-lg font-bold">{qp.home.total}</td>
            <td className="py-2 text-right text-lg font-bold">{qp.away.total}</td>
            <td className="py-2 text-right text-xs text-slate-500">
              Σ = {qp.home.total + qp.away.total} (invariant: {WPBA.standings.gameWin + WPBA.periods * WPBA.standings.quarterWin})
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-slate-400">
        [LEAGUE CLARIFICATION] Default: OT scoring counts toward the game-win award only; Q4's quarter point is judged at end of regulation.
      </p>
    </Modal>
  );
}
