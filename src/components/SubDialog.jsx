import { useState } from 'react';
import { WPBA } from '../rules/wpba.js';
import { onCourtReducer } from '../reducers/onCourtReducer.js';
import { playerStatsReducer, statsFor } from '../reducers/playerStatsReducer.js';
import { Modal, PlayerChip } from './ui.jsx';

// Substitution flow (Phase 3), driven by onCourtReducer. Records subs, does
// not police legality (§4 note 8) — with ONE exception it must know about:
// S16 re-entry-under-penalty. When a team has no eligible bench left, the most
// recently disqualified (not ejected) player may return; that SUB_IN carries
// ruleException and is itself a technical (charged by playerStatsReducer).

export default function SubDialog({ game, onCommitGroup, onClose }) {
  const { rosters } = game;
  const onCourt = onCourtReducer(game.events, rosters);
  const stats = playerStatsReducer(game.events);
  const [team, setTeam] = useState(null);
  const [outId, setOutId] = useState(null);

  const pick = (side) => {
    setTeam(side);
    setOutId(null);
  };

  if (!team) {
    return (
      <Modal title="Substitution — which team?" onClose={onClose}>
        <div className="flex gap-2">
          {['home', 'away'].map((side) => (
            <button key={side} type="button" onClick={() => pick(side)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: rosters[side].color }}>
              {rosters[side].name}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  const roster = rosters[team];
  const playerById = (id) => roster.players.find((p) => p.playerId === id) ?? { playerId: id, name: id, jersey: null };
  const bench = roster.players.filter((p) => !onCourt[team].includes(p.playerId));
  const eligibleBench = bench.filter((p) => {
    const s = statsFor(stats, p.playerId);
    return !s.dq && !s.ejected;
  });

  // S16 exception: no eligible bench → the LAST player who fouled out (not
  // ejected) may re-enter. "Last" = the DQ'd player whose 6th foul appears
  // latest in the log.
  let reentryCandidate = null;
  if (eligibleBench.length === 0) {
    let bestSeq = -1;
    for (const p of bench) {
      const s = statsFor(stats, p.playerId);
      if (!s.dq || s.ejected) continue;
      let count = 0;
      for (const event of game.events) {
        if (event.type === 'FOUL' && event.playerId === p.playerId) {
          count += 1;
          if (count === WPBA.playerFoulLimit && event.seq > bestSeq) {
            bestSeq = event.seq;
            reentryCandidate = p.playerId;
          }
        }
      }
    }
  }

  if (!outId) {
    return (
      <Modal title={`Sub out — ${roster.name}`} onClose={onClose}>
        <div className="flex flex-wrap gap-1.5">
          {onCourt[team].map((id) => (
            <PlayerChip key={id} player={playerById(id)} color={roster.color} onClick={() => setOutId(id)} note={statsFor(stats, id).dq ? 'DQ' : undefined} />
          ))}
        </div>
      </Modal>
    );
  }

  const commitSub = (inId, ruleException) => {
    const subIn = ruleException
      ? { type: 'SUB_IN', team, playerId: inId, payload: { reason: 're-entry — team below 5 eligible', ruleException: true } }
      : { type: 'SUB_IN', team, playerId: inId, payload: {} };
    onCommitGroup([{ type: 'SUB_OUT', team, playerId: outId, payload: {} }, subIn]);
    onClose();
  };

  return (
    <Modal title={`Sub in for ${playerById(outId).name}`} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        {bench.map((p) => {
          const s = statsFor(stats, p.playerId);
          const isReentry = p.playerId === reentryCandidate;
          const blocked = (s.dq || s.ejected) && !isReentry;
          return (
            <PlayerChip
              key={p.playerId}
              player={p}
              color={roster.color}
              disabled={blocked}
              note={s.ejected ? 'EJECTED' : s.dq ? (isReentry ? 'RE-ENTRY' : 'DQ') : undefined}
              onClick={() => commitSub(p.playerId, isReentry)}
            />
          );
        })}
      </div>
      {reentryCandidate && (
        <p className="mt-3 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          No eligible bench remains — {playerById(reentryCandidate).name} (last to foul out, not ejected) may re-enter.
          Re-entering is itself a technical, and every foul she commits from now on compounds a technical (S16).
        </p>
      )}
    </Modal>
  );
}
