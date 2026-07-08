// The full v2 event taxonomy from spec/project-plan.md §2 (MVP scope RESOLVED:
// SHOT_MISSED is in; REBOUND/ASSIST are reserved payload fields, not events).
//
// Every event shares the envelope:
//   { seq, ts, period, type, team, playerId, payload }
// team is 'home' | 'away' | 'league' (mandatory timeouts) | null (clock/admin).
//
// `payloadTemplate` seeds the dev event inspector's payload editor — it is
// documentation-by-example, not validation. Reducers are the source of truth
// for payload semantics, verified against spec/test-scenarios.md.

export const EVENT_TYPES = {
  // Scoring — misses carry shotValue so a miss and a make are structurally
  // symmetric (a missed 3 with a shooting foul awards 3 FTs — Scenario 4).
  // assistedBy / reboundedBy are reserved-but-null until a post-MVP phase.
  SHOT_MADE: {
    category: 'scoring',
    needsTeam: true,
    needsPlayer: true,
    payloadTemplate: { points: 2, assistedBy: null },
  },
  SHOT_MISSED: {
    category: 'scoring',
    needsTeam: true,
    needsPlayer: true,
    payloadTemplate: { shotValue: 2, assistedBy: null, reboundedBy: null },
  },

  // Free throws. attemptOf: { n, of } — n is the ATTEMPT NUMBER within the
  // awarded sequence and of is the total attempts awarded; whether the attempt
  // was made or missed is carried by the EVENT TYPE, never by attemptOf.
  //   FT_MADE   {attemptOf: {n:1, of:2}}  = "attempt 1 of 2 — made"
  //   FT_MISSED {attemptOf: {n:2, of:2}}  = "attempt 2 of 2 — missed"
  // So a player splitting a pair logs two events: FT_MADE{1 of 2} then
  // FT_MISSED{2 of 2}. It NEVER means "made 1 out of 2 total" — totals
  // (FTM/FTA) are derived by playerStatsReducer, not stored in payloads.
  // context ties the attempt to what produced it (bonus | andOne | technical | ...).
  FT_MADE: {
    category: 'freeThrow',
    needsTeam: true,
    needsPlayer: true,
    payloadTemplate: { attemptOf: { n: 1, of: 2 }, context: 'bonus' },
  },
  FT_MISSED: {
    category: 'freeThrow',
    needsTeam: true,
    needsPlayer: true,
    payloadTemplate: { attemptOf: { n: 1, of: 2 }, context: 'bonus' },
  },

  // Fouls — foulType: personal | technical | flagrant1 | flagrant2 | offensive.
  // Shooting fouls add { shooting, shotValue, made, fouledPlayer } per the
  // scenario event arrays; delayed-assessment fouls may carry
  // eligibilityBasis: { asOfSeq } (dry-run finding 1, wired up in Phase 2).
  FOUL: {
    category: 'foul',
    needsTeam: true,
    needsPlayer: true,
    payloadTemplate: { foulType: 'personal', shooting: false },
  },

  // Clock/flow — the app has no game clock; LAST_TWO_START is the scorer's
  // tap at the 2:00 mark that arms the last-two-minutes rules (Scenario 2).
  PERIOD_START: { category: 'clock', needsTeam: false, needsPlayer: false, payloadTemplate: {} },
  PERIOD_END: { category: 'clock', needsTeam: false, needsPlayer: false, payloadTemplate: {} },
  LAST_TWO_START: { category: 'clock', needsTeam: false, needsPlayer: false, payloadTemplate: {} },
  GAME_END: { category: 'clock', needsTeam: false, needsPlayer: false, payloadTemplate: {} },

  // Timeouts — toType: thirty | mandatory (league, charged to neither team)
  // | excessive (emitted by the TIMEOUT flow with its linked technical —
  // dry-run finding 2; wired up in Phase 3).
  TIMEOUT: {
    category: 'timeout',
    needsTeam: true,
    needsPlayer: false,
    payloadTemplate: { toType: 'thirty' },
  },

  // Substitution
  SUB_IN: { category: 'substitution', needsTeam: true, needsPlayer: true, payloadTemplate: {} },
  SUB_OUT: { category: 'substitution', needsTeam: true, needsPlayer: true, payloadTemplate: {} },

  // Possession
  POSSESSION_ARROW_FLIP: {
    category: 'possession',
    needsTeam: false,
    needsPlayer: false,
    payloadTemplate: {},
  },

  // Admin — CORRECTION marks an earlier event void without deleting it
  // (official-scorer style, distinct from undo — Scenario 15).
  CORRECTION: {
    category: 'admin',
    needsTeam: false,
    needsPlayer: false,
    payloadTemplate: { voidsSeq: 1, reason: '' },
  },
};

export const EVENT_TYPE_NAMES = Object.keys(EVENT_TYPES);

export function isKnownEventType(type) {
  return Object.hasOwn(EVENT_TYPES, type);
}
