// CORRECTION {voidsSeq} marks an earlier event void without deleting it
// (Scenario 15: the official scorer never erases). Reducers must treat voided
// events as absent while the log itself keeps them, rendered struck-through.

// Set of seqs voided by CORRECTION events. Corrections are processed in log
// order; a correction that has itself been voided by an earlier-applied
// correction is ignored. (Correction-of-correction chains beyond that are a
// Phase 4 concern — the CORRECTION UX phase — and are intentionally not
// specified here.)
export function voidedSeqs(events) {
  const voided = new Set();
  for (const event of events) {
    if (event.type === 'CORRECTION' && !voided.has(event.seq) && event.payload?.voidsSeq != null) {
      voided.add(event.payload.voidsSeq);
    }
  }
  return voided;
}

// The events reducers should derive from: everything not voided.
export function activeEvents(events) {
  const voided = voidedSeqs(events);
  return events.filter((event) => !voided.has(event.seq));
}
