import { useMemo, useState } from 'react';
import { logReducer } from '../reducers/logReducer.js';
import { voidedSeqs } from '../reducers/voids.js';
import { groupOf, groupsFromAndIncluding } from '../writers/undo.js';
import { periodLabel } from '../reducers/periodLabel.js';
import { Modal } from './ui.jsx';

// Phase 4 history sheet. Two per-event actions:
//   1. Undo to here — pops all groups from the tapped event forward (each
//      group lands on the redo stack, so a single Redo brings back the
//      most-recently-undone group).
//   2. Void (CORRECTION) — appends a CORRECTION event marking the target
//      seq void without removing anything. Distinct from undo (S15): the
//      voided event stays in the log, struck through, with the reason
//      visible on the CORRECTION entry.
//
// The list is newest-first, matching the dev inspector's convention and how
// scorers actually scan for a mistake.

export default function HistoryModal({ game, onUndoToSeq, onCorrect, onClose }) {
  const { events, rosters } = game;
  const log = useMemo(() => logReducer(events, rosters), [events, rosters]);
  const voided = useMemo(() => voidedSeqs(events), [events]);
  const [correctingSeq, setCorrectingSeq] = useState(null);
  const [reason, setReason] = useState('');

  const submitCorrection = () => {
    const trimmed = reason.trim();
    if (!trimmed) return; // required — CORRECTION is an official-scorer act, not a silent void
    onCorrect(correctingSeq, trimmed);
    setCorrectingSeq(null);
    setReason('');
  };

  return (
    <Modal title={`History — ${events.length} event${events.length === 1 ? '' : 's'}`} onClose={onClose}>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        // Render newest-first in the DOM so tab order matches visual order (a11y);
        // flex-col-reverse would visually flip but leave DOM/tab order stale.
        <ol className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1">
          {[...log].reverse().map((entry) => {
            const isVoidingTarget = entry.type === 'CORRECTION';
            const targetIsAlreadyVoided = voided.has(entry.seq);
            const groupsToUndo = groupsFromAndIncluding(events, entry.seq);
            const isCorrecting = correctingSeq === entry.seq;

            return (
              <li
                key={entry.seq}
                className={`flex flex-col gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm ${entry.voided ? 'text-slate-400 line-through' : 'text-slate-700'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">#{entry.seq}</span>
                  <span className="font-mono text-xs text-slate-400">{periodLabel(entry.period)}</span>
                  {entry.team && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: rosters[entry.team]?.color ?? '#94a3b8' }}
                    />
                  )}
                  <span className="flex-1">{entry.text}</span>
                </div>
                {!isCorrecting && (
                  <div className="flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => onUndoToSeq(entry.seq, groupsToUndo)}
                      className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 hover:bg-slate-200"
                      title={`Removes ${groupsToUndo} undo group${groupsToUndo === 1 ? '' : 's'} from here to the end (each lands on the redo stack)`}
                    >
                      Undo to here ({groupsToUndo})
                    </button>
                    {!isVoidingTarget && !targetIsAlreadyVoided && !entry.voided && (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectingSeq(entry.seq);
                          setReason('');
                        }}
                        className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-200"
                        title="Append a CORRECTION event marking this void — event stays in the log, struck through"
                      >
                        Void (correction)
                      </button>
                    )}
                  </div>
                )}
                {isCorrecting && (
                  <div className="flex items-center gap-1 rounded bg-amber-50 p-2 text-xs">
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (required — e.g. ref waved off the shot)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && reason.trim()) submitCorrection();
                        if (e.key === 'Escape') {
                          setCorrectingSeq(null);
                          setReason('');
                        }
                      }}
                      className="min-w-0 flex-1 rounded border border-amber-300 px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={submitCorrection}
                      disabled={!reason.trim()}
                      className="rounded bg-amber-500 px-2 py-1 font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Void
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCorrectingSeq(null);
                        setReason('');
                      }}
                      className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
