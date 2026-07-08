import { logReducer } from '../reducers/logReducer.js';

// Phase 4 undo primitives. These are pure — App-level state combines them
// with a redo stack, and any new commit clears that stack (the standard
// undo/redo semantic).
//
// One undo step = one undo-group. A group is the run of trailing events
// sharing the same groupSeq (stamped by appendEvents in the wizard/scoring
// flows). A single ungrouped event is its own group (groupSeq falls back to
// seq), so this works for hand-appended dev-inspector events too.

export function groupOf(event) {
  return event.groupSeq ?? event.seq;
}

// Returns [remainingEvents, removedInputs]. removedInputs are shaped for
// re-appending via appendEvents (seq/ts/period get freshly derived on redo).
// A no-op (empty events) returns [events, []].
export function popLastGroup(events) {
  if (events.length === 0) return [events, []];
  const target = groupOf(events[events.length - 1]);
  let start = events.length;
  while (start > 0 && groupOf(events[start - 1]) === target) start -= 1;
  const removed = events.slice(start).map((e) => ({
    type: e.type,
    team: e.team,
    playerId: e.playerId,
    payload: e.payload,
  }));
  return [events.slice(0, start), removed];
}

// Distinct groupSeqs in the log — i.e. the number of undo steps available.
export function undoStepCount(events) {
  const seen = new Set();
  for (const event of events) seen.add(groupOf(event));
  return seen.size;
}

// Human-readable description of the group popLastGroup would remove — feeds
// the "Undo: confirm undo of..." modal (Krystal's requested subsequent-tap
// confirmation).
export function describeLastGroup(events, rosters) {
  if (events.length === 0) return null;
  const target = groupOf(events[events.length - 1]);
  const group = events.filter((e) => groupOf(e) === target);
  return logReducer(group, rosters).map((entry) => entry.text);
}

// Count of distinct groups from and including the group containing targetSeq
// to the end — how many undo steps a "tap-to-here" would take.
export function groupsFromAndIncluding(events, targetSeq) {
  const anchor = events.find((e) => e.seq === targetSeq);
  if (!anchor) return 0;
  const target = groupOf(anchor);
  const groups = new Set();
  for (const event of events) {
    if (groupOf(event) >= target) groups.add(groupOf(event));
  }
  return groups.size;
}
