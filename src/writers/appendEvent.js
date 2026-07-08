import { isKnownEventType } from './eventTypes.js';

// The single write path (spec/project-plan.md §5, input flexibility principle).
// Every writer — tap UI, dev inspector, keyboard shortcuts, future automated
// feeds, replay-from-JSON — goes through this function. Downstream reducers
// never know which writer appended an event.
//
// Pure: returns a NEW game object with the event appended; never mutates the
// input. The log is append-only — undo (Phase 4) is events.pop() at the state
// layer, and corrections append CORRECTION events rather than editing history.

// Current period is derived from the log (last PERIOD_START), never stored.
export function currentPeriod(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'PERIOD_START') return events[i].period;
  }
  return null; // before the opening PERIOD_START
}

let now = () => Date.now();
// Test seam: lets fixtures pin timestamps without stubbing globals.
export function _setClock(fn) {
  now = fn ?? (() => Date.now());
}

export function appendEvent(game, { type, team = null, playerId = null, period, payload = {}, groupSeq = null }) {
  if (!isKnownEventType(type)) {
    throw new Error(`Unknown event type: ${type}`);
  }

  const events = game.events;
  const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0;

  // PERIOD_START carries the period it opens (from payload.period); everything
  // else is stamped with the period derived from the log so far.
  const resolvedPeriod =
    period ?? (type === 'PERIOD_START' ? payload.period : null) ?? currentPeriod(events);

  if (resolvedPeriod == null) {
    throw new Error(`Cannot append ${type} before the opening PERIOD_START (no period in the log)`);
  }

  const event = {
    seq: lastSeq + 1,
    ts: now(),
    period: resolvedPeriod,
    type,
    team,
    playerId,
    payload,
  };
  if (groupSeq != null) event.groupSeq = groupSeq;

  return { ...game, events: [...events, event] };
}

// Batch write for wizard flows: appends inputs in order, all stamped with one
// shared groupSeq (the first event's seq). Spec convention: "one undo removes
// the foul and all its FT events together" — Phase 4's undo pops whole groups.
export function appendEvents(game, inputs) {
  const firstSeq = game.events.length > 0 ? game.events[game.events.length - 1].seq + 1 : 1;
  let next = game;
  for (const input of inputs) {
    next = appendEvent(next, { ...input, groupSeq: firstSeq });
  }
  return next;
}
