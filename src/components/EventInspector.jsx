import { useMemo, useState } from 'react';
import { EVENT_TYPES, EVENT_TYPE_NAMES } from '../writers/eventTypes.js';
import { currentPeriod } from '../writers/appendEvent.js';
import { logReducer } from '../reducers/logReducer.js';

// Dev event inspector (Phase 1) — the raw-log debugger the project plan says
// to keep forever. Left: hand-append any taxonomy event. Right: play-by-play
// from logReducer over the append-only log, voided entries struck through,
// raw JSON one <details> away.

function templateFor(type, events) {
  const template = structuredClone(EVENT_TYPES[type].payloadTemplate);
  if (type === 'PERIOD_START') {
    template.period = (currentPeriod(events) ?? 0) + 1;
  } else if (type === 'PERIOD_END' || type === 'LAST_TWO_START') {
    template.period = currentPeriod(events) ?? 1;
  }
  return template;
}

export default function EventInspector({ game, onAppend }) {
  const { events, rosters } = game;
  const [type, setType] = useState('PERIOD_START');
  const [team, setTeam] = useState('home');
  const [playerId, setPlayerId] = useState('');
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(templateFor('PERIOD_START', events), null, 2));
  const [error, setError] = useState(null);

  const spec = EVENT_TYPES[type];
  const log = useMemo(() => logReducer(events, rosters), [events, rosters]);
  const teamPlayers = team === 'league' ? [] : (rosters[team]?.players ?? []);

  const pickType = (nextType) => {
    setType(nextType);
    setPayloadText(JSON.stringify(templateFor(nextType, events), null, 2));
    setError(null);
  };

  const append = () => {
    let payload;
    try {
      payload = payloadText.trim() === '' ? {} : JSON.parse(payloadText);
    } catch {
      setError('Payload is not valid JSON');
      return;
    }
    try {
      onAppend({
        type,
        team: spec.needsTeam ? team : null,
        playerId: spec.needsPlayer ? playerId || null : null,
        payload,
      });
      setError(null);
      // Re-seed the template so period-carrying types stay current.
      setPayloadText(JSON.stringify(templateFor(type, events), null, 2));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Append event <span className="font-normal normal-case">(dev writer)</span>
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Type</span>
            <select
              value={type}
              onChange={(e) => pickType(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5"
            >
              {EVENT_TYPE_NAMES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>

          {spec.needsTeam && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Team</span>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              >
                <option value="home">home — {rosters.home.name}</option>
                <option value="away">away — {rosters.away.name}</option>
                {type === 'TIMEOUT' && <option value="league">league (mandatory)</option>}
              </select>
            </label>
          )}

          {spec.needsPlayer && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Player</span>
              <select
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              >
                <option value="">—</option>
                {teamPlayers.map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {p.jersey != null ? `#${p.jersey} ` : ''}
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Payload (JSON)</span>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              rows={5}
              spellCheck={false}
              className="rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
            />
          </label>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="button"
            onClick={append}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
          >
            Append
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Event log <span className="font-normal normal-case">({events.length} events)</span>
        </h2>

        {log.length === 0 ? (
          <p className="text-sm text-slate-400">No events yet — append PERIOD_START to begin.</p>
        ) : (
          <ol className="flex max-h-[32rem] flex-col-reverse gap-1 overflow-y-auto">
            {log.map((entry, i) => (
              <li
                key={entry.seq}
                className={`rounded-lg px-2 py-1.5 text-sm ${entry.voided ? 'text-slate-400 line-through' : 'text-slate-700'}`}
              >
                <span className="mr-2 font-mono text-xs text-slate-400">#{entry.seq}</span>
                <span className="mr-2 font-mono text-xs text-slate-400">
                  {entry.period != null ? `P${entry.period}` : ''}
                </span>
                {entry.team && (
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{
                      backgroundColor: rosters[entry.team]?.color ?? '#94a3b8',
                    }}
                  />
                )}
                {entry.text}
                <details className="ml-6 inline-block align-middle">
                  <summary className="cursor-pointer text-xs text-slate-400">raw</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                    {JSON.stringify(events[i], null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
