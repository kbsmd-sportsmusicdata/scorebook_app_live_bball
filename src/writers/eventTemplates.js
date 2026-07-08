import { EVENT_TYPES } from './eventTypes.js';
import { currentPeriod } from './appendEvent.js';

// Log-aware payload templates for the dev event inspector. These are writer
// ergonomics only — they pre-fill the payload editor with the most likely
// intent given the log so far; the scorer can always edit before appending.

export function templateFor(type, events) {
  const template = structuredClone(EVENT_TYPES[type].payloadTemplate);
  const last = events.length > 0 ? events[events.length - 1] : null;

  switch (type) {
    case 'PERIOD_START':
      template.period = (currentPeriod(events) ?? 0) + 1;
      break;
    case 'PERIOD_END':
    case 'LAST_TWO_START':
      template.period = currentPeriod(events) ?? 1;
      break;
    case 'CORRECTION':
      // Default to voiding the MOST RECENT event, not #1 — the overwhelmingly
      // common intent. (True pop-style undo, with per-step confirmation, is
      // Phase 4; a CORRECTION voids-in-place and never removes.)
      template.voidsSeq = last ? last.seq : 1;
      break;
    case 'FT_MADE':
    case 'FT_MISSED':
      // Continue an in-progress FT sequence: after "1 of 2", default to
      // "2 of 2" with the same context. attemptOf.n is the attempt NUMBER in
      // the awarded sequence — made/missed is the event type, so a split pair
      // logs as FT_MADE{1 of 2} then FT_MISSED{2 of 2}.
      if (
        last &&
        (last.type === 'FT_MADE' || last.type === 'FT_MISSED') &&
        last.payload?.attemptOf &&
        last.payload.attemptOf.n < last.payload.attemptOf.of
      ) {
        template.attemptOf = {
          n: last.payload.attemptOf.n + 1,
          of: last.payload.attemptOf.of,
        };
        if (last.payload.context != null) template.context = last.payload.context;
      }
      break;
    default:
      break;
  }
  return template;
}
