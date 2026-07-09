import { WPBA } from '../rules/wpba.js';
import { boxScoreReducer } from '../reducers/boxScoreReducer.js';
import { scoreReducer } from '../reducers/scoreReducer.js';
import { periodLabel } from '../reducers/periodLabel.js';
import { Modal } from './ui.jsx';

// Box score modal + print view. Class hooks (print-container) coordinate with
// index.css so window.print() renders only this table, not the app chrome.

function pct(m, a) {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : '—';
}

function TeamTable({ team, rows, totals }) {
  return (
    <div className="print-container">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: team.color }}>
        {team.name}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-2 font-medium">#</th>
              <th className="py-1 pr-2 font-medium">Player</th>
              <th className="py-1 pr-2 text-right font-medium">PTS</th>
              <th className="py-1 pr-2 text-right font-medium">FGM/FGA</th>
              <th className="py-1 pr-2 text-right font-medium">FG%</th>
              <th className="py-1 pr-2 text-right font-medium">FTM/FTA</th>
              <th className="py-1 pr-2 text-right font-medium">FT%</th>
              <th className="py-1 pr-2 text-right font-medium">PF</th>
              <th className="py-1 pr-2 text-right font-medium">T</th>
              <th className="py-1 pr-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.playerId}
                className={`border-b border-slate-100 ${row.dq || row.ejected ? 'text-slate-400' : ''}`}
              >
                <td className="py-1 pr-2 font-mono">{row.jersey ?? '—'}</td>
                <td className={`py-1 pr-2 font-medium ${row.dq || row.ejected ? 'line-through' : ''}`}>{row.name}</td>
                <td className="py-1 pr-2 text-right font-semibold">{row.pts}</td>
                <td className="py-1 pr-2 text-right">
                  {row.fgm}/{row.fga}
                </td>
                <td className="py-1 pr-2 text-right text-xs text-slate-500">{pct(row.fgm, row.fga)}</td>
                <td className="py-1 pr-2 text-right">
                  {row.ftm}/{row.fta}
                </td>
                <td className="py-1 pr-2 text-right text-xs text-slate-500">{pct(row.ftm, row.fta)}</td>
                <td className={`py-1 pr-2 text-right ${row.fouls >= WPBA.playerFoulLimit - 1 ? 'font-semibold text-red-600' : ''}`}>
                  {row.fouls}
                </td>
                <td className="py-1 pr-2 text-right">{row.technicals > 0 ? row.technicals : ''}</td>
                <td className="py-1 pr-2 text-left text-xs">
                  {row.ejected ? `Ejected${row.nextGameSuspension ? ' + suspension' : ''}` : row.dq ? 'DQ' : ''}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
              <td className="py-1 pr-2"></td>
              <td className="py-1 pr-2 uppercase tracking-wide">Totals</td>
              <td className="py-1 pr-2 text-right">{totals.pts}</td>
              <td className="py-1 pr-2 text-right">
                {totals.fgm}/{totals.fga}
              </td>
              <td className="py-1 pr-2 text-right text-xs">{pct(totals.fgm, totals.fga)}</td>
              <td className="py-1 pr-2 text-right">
                {totals.ftm}/{totals.fta}
              </td>
              <td className="py-1 pr-2 text-right text-xs">{pct(totals.ftm, totals.fta)}</td>
              <td className="py-1 pr-2 text-right">{totals.fouls}</td>
              <td className="py-1 pr-2 text-right">{totals.technicals > 0 ? totals.technicals : ''}</td>
              <td className="py-1 pr-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BoxScoreModal({ game, onClose }) {
  const box = boxScoreReducer(game.events, game.rosters);
  const score = scoreReducer(game.events);

  return (
    <Modal title="Box score" onClose={onClose}>
      <div className="print-container flex flex-col gap-4">
        <header className="print-container flex items-baseline justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              {game.rosters.home.name} {score.home} — {score.away} {game.rosters.away.name}
            </div>
            <div className="font-mono text-xs text-slate-400">{game.gameId}</div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print
          </button>
        </header>

        {score.byPeriod.length > 0 && (
          <div className="print-container overflow-x-auto">
            <table className="text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pr-3 font-medium"></th>
                  {score.byPeriod.map((p) => (
                    <th key={p.period} className="px-2 text-center font-medium">
                      {periodLabel(p.period)}
                    </th>
                  ))}
                  <th className="pl-2 text-center font-medium">Final</th>
                </tr>
              </thead>
              <tbody>
                {['home', 'away'].map((side) => (
                  <tr key={side}>
                    <td className="pr-3 font-semibold" style={{ color: game.rosters[side].color }}>
                      {game.rosters[side].name}
                    </td>
                    {score.byPeriod.map((p) => (
                      <td key={p.period} className="px-2 text-center">
                        {p[side]}
                      </td>
                    ))}
                    <td className="pl-2 text-center font-bold">{score[side]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TeamTable team={game.rosters.home} rows={box.rows.home} totals={box.totals.home} />
        <TeamTable team={game.rosters.away} rows={box.rows.away} totals={box.totals.away} />
      </div>
    </Modal>
  );
}
