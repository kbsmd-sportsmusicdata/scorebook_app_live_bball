import { Modal } from './ui.jsx';

// Krystal's requested "confirm subsequent undo" flow (Phase 4):
//   1st Undo tap after any commit  → immediate, no confirmation
//   2nd+ Undo tap (uninterrupted)  → this dialog previews what's next
// Any commit, redo, or dialog cancel clears the "pending confirm" state.

export default function UndoConfirmModal({ description, onConfirm, onCancel }) {
  return (
    <Modal title="Undo — confirm" onClose={onCancel}>
      <p className="mb-3 text-sm text-slate-700">Undo of the next most recent event(s):</p>
      <ul className="mb-4 flex flex-col gap-1">
        {(description ?? []).map((line, i) => (
          <li key={i} className="rounded bg-slate-50 px-2 py-1 text-sm text-slate-700">
            {line}
          </li>
        ))}
        {(!description || description.length === 0) && (
          <li className="rounded bg-slate-50 px-2 py-1 text-sm text-slate-500">Nothing left to undo.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!description || description.length === 0}
          className="flex-1 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
