import { Modal } from './ui.jsx';

// Krystal's confirm-subsequent-undo flow, reworked as a STEPPER after live
// testing showed the open/close-per-step modal read as the app cancelling
// the undo (and tablet ghost-taps could dismiss it instantly):
//   1st Undo tap after any commit  → immediate, no confirmation
//   2nd+ Undo tap (uninterrupted)  → this dialog opens and STAYS OPEN:
//     each [Undo] pops one group and the preview refreshes to the next one,
//     so undoing N steps is N taps in one place. Backdrop taps never dismiss
//     (static modal) — only Done or ✕ close it.
//
// description: log lines for the group the next Undo would remove (live,
// recomputed by the parent on every pop). stepsRemaining: undo steps left.

export default function UndoConfirmModal({ description, stepsRemaining, undoneCount, onConfirm, onCancel }) {
  const empty = !description || description.length === 0;
  return (
    <Modal title="Undo — confirm" onClose={onCancel} isStatic>
      <p className="mb-2 text-sm text-slate-700">
        {empty ? 'Nothing left to undo.' : 'Next undo removes:'}
      </p>
      <ul className="mb-3 flex flex-col gap-1">
        {(description ?? []).map((line, i) => (
          <li key={i} className="rounded bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
            {line}
          </li>
        ))}
      </ul>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>{stepsRemaining} undo step{stepsRemaining === 1 ? '' : 's'} remaining</span>
        {undoneCount > 0 && <span className="font-semibold text-emerald-700">{undoneCount} undone this session</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={empty}
          className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
