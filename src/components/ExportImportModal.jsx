import { useState } from 'react';
import { toJson, importGame, fileNameFor } from '../writers/exportGame.js';
import { Modal } from './ui.jsx';

// JSON export/import (S14). The exported document is only { gameId, meta,
// rosters, events }; a fresh reload + import must reproduce every panel
// identically — proving the log is the complete source of truth.

export default function ExportImportModal({ game, onImport, onClose }) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState(null);
  const [copied, setCopied] = useState(false);
  const exported = toJson(game);

  const download = () => {
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameFor(game);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handleImport = () => {
    try {
      const restored = importGame(importText);
      if (!window.confirm('Import replaces the current game (undo/redo history is lost). Continue?')) return;
      onImport(restored);
    } catch (e) {
      setImportError(e.message);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      setImportText(text);
      setImportError(null);
    } catch (e) {
      setImportError(e.message);
    }
  };

  return (
    <Modal title="Export / Import" onClose={onClose}>
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Export ({game.events.length} events)</h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={copy}
              className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Download .json
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={exported}
          className="h-40 w-full resize-none rounded border border-slate-200 bg-slate-50 p-2 font-mono text-[10px]"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          Only <code>gameId</code>, <code>meta</code>, <code>rosters</code>, <code>events</code> — no derived fields.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Import</h3>
        <div className="mb-2 flex items-center gap-2 text-xs">
          <label className="cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">
            Choose file
            <input type="file" accept=".json,application/json" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
          </label>
          <span className="text-slate-400">or paste JSON below</span>
        </div>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          placeholder="Paste a scorebook JSON here"
          className="h-32 w-full resize-none rounded border border-slate-200 p-2 font-mono text-[10px]"
        />
        {importError && <p className="mt-1 text-xs font-medium text-red-600">{importError}</p>}
        <button
          type="button"
          disabled={importText.trim() === ''}
          onClick={handleImport}
          className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
        >
          Import (replaces current game)
        </button>
      </section>
    </Modal>
  );
}
