import { useState } from 'react';
import { WPBA } from '../rules/wpba.js';
import { periodLabel } from '../reducers/periodLabel.js';
import { PlayerChip } from './ui.jsx';

// The tap-friendly scoring surface (Phase 3). Input model is ACTION-FIRST,
// then player — the pro-tool pattern from Reference Checkpoint #3: under live
// pressure the scorer sees the action, then identifies the player. Tapping an
// action arms it; tapping an on-court player chip commits the event.
//
// Fouls, subs, and timeouts open their own flows (wizard/dialogs) — this
// surface only emits shot events and clock events directly.

const SHOT_ACTIONS = [
  { label: '2PT ✓', type: 'SHOT_MADE', payload: { points: 2, assistedBy: null } },
  { label: '2PT ✗', type: 'SHOT_MISSED', payload: { shotValue: 2, assistedBy: null, reboundedBy: null } },
  { label: '3PT ✓', type: 'SHOT_MADE', payload: { points: 3, assistedBy: null } },
  { label: '3PT ✗', type: 'SHOT_MISSED', payload: { shotValue: 3, assistedBy: null, reboundedBy: null } },
];

export default function ScoringSurface({
  game,
  phase,
  onCourt,
  playerStats,
  lastTwoArmed,
  onCommitGroup,
  onOpenFoul,
  onOpenSub,
  onOpenTimeout,
}) {
  const [armed, setArmed] = useState(null); // { team, actionIndex }
  const { rosters } = game;
  const playerById = (side, id) => rosters[side].players.find((p) => p.playerId === id) ?? { playerId: id, name: id, jersey: null };

  const tapPlayer = (team, playerId) => {
    if (!armed || armed.team !== team) return;
    const action = SHOT_ACTIONS[armed.actionIndex];
    onCommitGroup([{ type: action.type, team, playerId, payload: structuredClone(action.payload) }]);
    setArmed(null);
  };

  const nextPeriod = (phase.period ?? 0) + 1;

  if (phase.phase === 'ended') {
    return (
      <div className="rounded-2xl bg-slate-800 p-4 text-center text-white shadow-sm">
        <span className="text-sm font-bold uppercase tracking-wide">Game over</span>
        <p className="mt-1 text-xs text-slate-300">Input disabled — undo/corrections only (dev inspector below).</p>
      </div>
    );
  }

  if (phase.phase !== 'live') {
    return (
      <div className="flex items-center justify-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => onCommitGroup([{ type: 'PERIOD_START', payload: { period: nextPeriod } }])}
          className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700"
        >
          Start {periodLabel(nextPeriod)}
          {nextPeriod === WPBA.periods + 1 && ' (jump ball, fresh foul count)'}
          {nextPeriod >= WPBA.periods + 2 && ' — SUDDEN DEATH'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      {phase.suddenDeath && (
        <div className="rounded-lg bg-red-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
          Sudden death — first score of any kind wins
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {['home', 'away'].map((side) => {
          const team = rosters[side];
          return (
            <div key={side} className="rounded-xl border border-slate-200 p-3" style={{ borderTopColor: team.color, borderTopWidth: 3 }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: team.color }}>
                  {team.name}
                </span>
                <div className="flex gap-1">
                  {SHOT_ACTIONS.map((action, i) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => setArmed(armed?.team === side && armed?.actionIndex === i ? null : { team: side, actionIndex: i })}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                        armed?.team === side && armed?.actionIndex === i
                          ? 'text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      style={armed?.team === side && armed?.actionIndex === i ? { backgroundColor: team.color } : undefined}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {onCourt[side].map((id) => {
                  const stats = playerStats[id];
                  return (
                    <PlayerChip
                      key={id}
                      player={playerById(side, id)}
                      color={team.color}
                      onClick={() => tapPlayer(side, id)}
                      disabled={!armed || armed.team !== side}
                      note={stats?.dq ? 'DQ' : undefined}
                    />
                  );
                })}
              </div>
              {armed?.team === side && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {SHOT_ACTIONS[armed.actionIndex].label} armed — tap the player
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={onOpenFoul} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">
          Foul
        </button>
        <button type="button" onClick={onOpenSub} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-600">
          Sub
        </button>
        <button type="button" onClick={onOpenTimeout} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-600">
          Timeout
        </button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button
          type="button"
          disabled={lastTwoArmed}
          onClick={() => onCommitGroup([{ type: 'LAST_TWO_START', payload: { period: phase.period } }])}
          className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          title="Tap when the clock hits 2:00 — arms the last-two-minutes penalty rules"
        >
          {lastTwoArmed ? '2:00 armed' : 'Last 2:00'}
        </button>
        <button
          type="button"
          onClick={() => onCommitGroup([{ type: 'POSSESSION_ARROW_FLIP', payload: {} }])}
          className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Arrow ⇄
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onCommitGroup([{ type: 'PERIOD_END', payload: { period: phase.period } }])}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          End {periodLabel(phase.period)}
        </button>
      </div>
    </div>
  );
}
