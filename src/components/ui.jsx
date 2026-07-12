// Tiny shared primitives for the Phase 3 input dialogs.

// static: when true, tapping the backdrop does NOT dismiss — only the ✕ or an
// explicit button. Use for confirmations, where a stray tap (or a tablet
// "ghost tap" from the tap that opened the modal) must never eat the dialog.
export function Modal({ title, onClose, children, static: isStatic = false }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={isStatic ? undefined : onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ChoiceButton({ onClick, disabled, accent, children, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full flex-col items-start rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
      style={accent ? { borderColor: accent } : undefined}
    >
      <span className="text-sm font-semibold text-slate-800">{children}</span>
      {sub && <span className="mt-0.5 text-xs text-slate-500">{sub}</span>}
    </button>
  );
}

export function PlayerChip({ player, color, onClick, disabled, selected, note }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition
        ${selected ? 'text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}
        ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
      style={selected ? { backgroundColor: color, borderColor: color } : undefined}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${selected ? 'bg-white/25 text-white' : 'text-white'}`}
        style={selected ? undefined : { backgroundColor: color }}
      >
        {player.jersey ?? '—'}
      </span>
      <span className="max-w-[9rem] truncate">{player.name}</span>
      {note && <span className="text-[10px] font-bold uppercase opacity-80">{note}</span>}
    </button>
  );
}
