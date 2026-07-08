import { useState } from 'react';
import { WPBA } from '../rules/wpba.js';
import { timeoutsReducer } from '../reducers/timeoutsReducer.js';
import { teamFoulsReducer } from '../reducers/teamFoulsReducer.js';
import { onCourtReducer } from '../reducers/onCourtReducer.js';
import { gamePhaseReducer } from '../reducers/gamePhaseReducer.js';
import { buildExcessiveTimeoutGroup } from '../writers/foulWizard.js';
import { slugify } from '../data/parseRosters.js';
import { Modal, PlayerChip } from './ui.jsx';

// Timeout flow (Phase 3). This flow — never the foul wizard — is the entry
// point for the excessive-timeout technical (dry-run finding 2): it already
// knows the remaining count is zero before anything is tapped, so it offers
// the conversion itself and emits the linked TIMEOUT + FOUL pair.

export default function TimeoutDialog({ game, onCommitGroup, onClose }) {
  const { rosters } = game;
  const timeouts = timeoutsReducer(game.events);
  const phase = gamePhaseReducer(game.events);
  const { lastTwoArmed } = teamFoulsReducer(game.events);
  const onCourt = onCourtReducer(game.events, rosters);
  const [excessiveTeam, setExcessiveTeam] = useState(null);
  const [ftShooter, setFtShooter] = useState(null);
  const [advance, setAdvance] = useState(false);

  // ≤2:00 of Q4 or OT: after a 30s timeout the ball may be advanced (record-keeping only)
  const advanceOffered = lastTwoArmed && phase.period != null && phase.period >= WPBA.periods;

  const headCoachId = (side) => {
    const hc = rosters[side].coaches.find((c) => c.role === 'Head Coach');
    return hc?.coachId ?? `${rosters[side].teamId}-coach-${slugify(hc?.name ?? 'head-coach')}`;
  };

  const takeThirty = (side) => {
    if (timeouts[side].remaining <= 0) {
      setExcessiveTeam(side); // offer the conversion — the flow already knows
      return;
    }
    onCommitGroup([{ type: 'TIMEOUT', team: side, payload: { toType: 'thirty', ...(advance ? { advance: true } : {}) } }]);
    onClose();
  };

  if (excessiveTeam) {
    const shootingSide = excessiveTeam === 'home' ? 'away' : 'home';
    const commitExcessive = (ftResult) => {
      onCommitGroup(
        buildExcessiveTimeoutGroup({ team: excessiveTeam, coachId: headCoachId(excessiveTeam), ftResult }),
      );
      onClose();
    };
    return (
      <Modal title="No timeouts remaining" onClose={onClose}>
        <p className="mb-3 text-sm text-slate-700">
          <span className="font-bold" style={{ color: rosters[excessiveTeam].color }}>{rosters[excessiveTeam].name}</span>{' '}
          has no 30-second timeouts left in this {timeouts.window?.startsWith('OT') ? 'overtime' : 'half'}. Record as an{' '}
          <span className="font-bold">excessive timeout</span>? That is a technical on the head coach — 1 FT to the
          opponent <span className="font-bold">plus loss of possession</span> (the one technical that flips it).
        </p>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">FT shooter (any player in the game)</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {onCourt[shootingSide].map((id) => {
            const p = rosters[shootingSide].players.find((x) => x.playerId === id) ?? { name: id, jersey: null };
            return <PlayerChip key={id} player={p} color={rosters[shootingSide].color} selected={ftShooter === id} onClick={() => setFtShooter(id)} />;
          })}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!ftShooter} onClick={() => commitExcessive({ made: true, shooterId: ftShooter })} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            FT Made
          </button>
          <button type="button" disabled={!ftShooter} onClick={() => commitExcessive({ made: false, shooterId: ftShooter })} className="flex-1 rounded-xl bg-slate-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            FT Missed
          </button>
          <button type="button" onClick={() => commitExcessive(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
            Record FT later
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Timeout" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {['home', 'away'].map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => takeThirty(side)}
            className="flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:border-slate-400"
          >
            <span style={{ color: rosters[side].color }}>{rosters[side].name} — 30s</span>
            <span className={`text-xs font-semibold ${timeouts[side].remaining === 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {timeouts[side].remaining} left this {timeouts.window?.startsWith('OT') ? 'OT' : 'half'}
              {timeouts[side].remaining === 0 && ' — excessive!'}
            </span>
          </button>
        ))}
        <button
          type="button"
          disabled={!timeouts.mandatoryAvailableThisPeriod}
          onClick={() => {
            onCommitGroup([{ type: 'TIMEOUT', team: 'league', payload: { toType: 'mandatory' } }]);
            onClose();
          }}
          className="flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 hover:border-slate-400 disabled:opacity-40"
        >
          <span>League mandatory (60s)</span>
          <span className="text-xs font-semibold text-slate-500">
            {timeouts.mandatoryAvailableThisPeriod ? 'first dead ball ≤4:59 — charged to neither team' : 'already taken this quarter'}
          </span>
        </button>
        {advanceOffered && (
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
            Ball advanced to frontcourt (28-ft) — the ≤2:00 advance rule (record-keeping only)
          </label>
        )}
      </div>
    </Modal>
  );
}
