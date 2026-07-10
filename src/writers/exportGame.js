// JSON round-trip for the game document (S14). The exported shape is the
// canonical { gameId, meta, rosters, events } and NOTHING ELSE — S14 asserts
// "no derived fields in the JSON (scores/totals present = someone cached
// state)." The redo stack lives alongside the game in App state, not inside
// the document, so it is intentionally lost on export/import.

// Whitelist of top-level keys allowed in the exported document. Anything
// else that leaks into game state gets stripped on export — the JSON stays
// pure event log by construction, not by discipline.
const EXPORT_KEYS = ['gameId', 'meta', 'rosters', 'events'];

export function exportGame(game) {
  const out = {};
  for (const key of EXPORT_KEYS) out[key] = game[key];
  return out;
}

export function toJson(game) {
  return JSON.stringify(exportGame(game), null, 2);
}

export function importGame(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object') throw new Error('Import: not a JSON object');
  if (!data.meta || typeof data.meta !== 'object') throw new Error('Import: missing meta');
  if (!data.rosters || !data.rosters.home || !data.rosters.away) {
    throw new Error('Import: missing rosters.home / rosters.away');
  }
  if (!Array.isArray(data.events)) throw new Error('Import: events must be an array');

  const game = {};
  for (const key of EXPORT_KEYS) game[key] = data[key];
  return game;
}

export function fileNameFor(game) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Strip anything that isn't a filesystem-safe identifier char — belt and
  // braces alongside createGame's slugify, since a hand-imported doc could
  // carry any gameId string.
  const safeId = String(game.gameId ?? 'game').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeId}--${stamp}.json`;
}
