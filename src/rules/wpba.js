// THE one source of rule constants (CLAUDE.md rules discipline). This is the
// §4 WPBA config object from spec/project-plan.md, resolved against
// WPBA_Rules_2026_FINAL.pdf. No reducer, component, or wizard branch may
// hardcode a rule number inline — if a foul/bonus/timeout/OT number appears in
// a conditional outside this file, that's a bug.
//
// Keys not in §4 (playersOnCourt, freeThrowPoints, the countsToward* flags,
// excessiveTimeoutCommittedBy) are additions this file owns for the same
// reason: they are game-rule numbers/decisions, so they live here.

export const WPBA = {
  periods: 4,
  periodMinutes: 10,
  halftimeMinutes: 12,
  shotClockSeconds: 24,

  playersOnCourt: 5,
  freeThrowPoints: 1, // a made free throw scores 1 (scoreReducer)

  playerFoulLimit: 6, // fouls out on the SIXTH personal foul (v1 bug was 5 — S5)
  teamFoulsResetEachPeriod: true,

  bonus: {
    atTeamFouls: 5, // 2 FTs on the team's 5th foul of the quarter...
    lastTwoMinutes: { atTeamFouls: 2 }, // ...OR its 2nd team foul in the last 2:00 of ANY quarter (S2)
    freeThrows: 2, // always two shots; no one-and-one anywhere in this league
    // Rulebook note: on the 1st team foul inside 2:00, refs direct the scoreboard
    // to display "4" under team fouls — our LAST_TWO_START event is the digital
    // twin of that moment.
  },

  offensiveFoulCountsTowardTeamFouls: false, // explicit: personal foul yes, team foul NO, never FTs (S6)

  andOneFreeThrows: 1, // made basket + shooting foul = exactly ONE FT, never stacked with bonus (S4)

  // The S8 special 1-FT family (§4 recommendation #6: one generic payload,
  // shared 1-FT resolution, per-kind eligibility quirks). S8 specifies wizard
  // behavior (1 FT, shooter pool, possession) but NOT how these count toward
  // player/team foul totals — the countsToward* values below are conventions
  // to confirm with Krystal/league, isolated here so an answer is a one-line fix.
  specialFouls: {
    freeThrows: 1,
    kinds: {
      transitionTake: {
        shooter: 'anyInGame',
        possession: 'fouled team retains, side-out at POI',
        voidInLastTwoQ4OTAnd2OT: true, // does not apply late Q4/OT or in 2OT
        countsTowardPlayerSix: true, // convention — a take foul is a personal foul
        countsTowardTeamFouls: true, // convention
      },
      awayFromPlay: {
        shooter: 'anyInGame',
        possession: 'POI',
        countsTowardPlayerSix: true, // convention
        countsTowardTeamFouls: true, // convention
      },
      flop: { treatAsTechnical: true }, // floppingIsTechnical — resolves via the technical branch + its ladder
      defensive3s: {
        shooter: 'anyInGame',
        possession: 'offended team at FTLE',
        countsTowardPlayerSix: false, // convention — violation-like, NBA-style
        countsTowardTeamFouls: false, // convention
      },
    },
  },

  technicals: {
    freeThrows: 1, // shot by any player in the game at the time
    resume: 'POI, direct side-out',
    ejectionAt: 2, // 2 techs = ejection AND next-game suspension (S7)
    excessiveTimeout: 'technical + loss of possession',
    floppingIsTechnical: true, // STEM: secondary, theatrical, exaggerated movements
    // [LEAGUE CLARIFICATION] Rulebook is silent on whether a technical adds to
    // the team-foul (bonus) count or the player's 6-foul limit (S7). Defaults
    // below are false; a league answer is a one-line change here.
    countsTowardTeamFouls: false, // [LEAGUE CLARIFICATION]
    countsTowardPlayerSix: false, // [LEAGUE CLARIFICATION]
    // Implementation convention, not a league question (dry-run finding 3):
    // an excessive-timeout technical is attributed to the head coach.
    excessiveTimeoutCommittedBy: 'headCoach',
  },

  flagrant: {
    FF1: { freeThrows: 2, possession: 'FTLE, frontcourt', shotClock: 'full reset', ejectionAt: 2 },
    FF2: { freeThrows: 2, possession: 'FTLE, frontcourt', shotClock: 'full reset', immediateEjection: true },
    // [LEAGUE CLARIFICATION] (candidate — see CLAUDE.md open items) Do FF1/FF2
    // count toward the 6-foul DQ total in addition to their own ejection
    // ladder? Defaulting false, consistent with the technicals defaults above.
    countsTowardPlayerSix: false, // [LEAGUE CLARIFICATION]
    countsTowardTeamFouls: true, // flagrants are not offensive fouls; they count like personals
  },

  timeouts: {
    perTeamPerHalf: { thirtySecond: 2 }, // NO carryover 1st→2nd half, none into OT
    leagueMandatory: {
      perQuarter: 1,
      seconds: 60,
      when: 'first dead ball at 4:59 or under',
      chargedTo: 'neither team', // a team-called TO does NOT replace it
    },
    overtimePerTeam: { thirtySecond: 1 }, // per OT period; advance rules apply
    advanceRule: '≤2:00 of Q4 or OT: after a 30s timeout, ball may be advanced to frontcourt (28-ft)',
  },

  overtime: {
    minutes: 3,
    startsWith: 'jump ball, center circle (A/P arrow applies after the tip)',
    teamFoulPenaltyAt: 2, // FRESH count — penalty FTs on the 2nd team foul in OT (S9)
    lastTwoMinuteRulesFrom: '2:00 mark', // the whole back 2/3 of OT runs under last-2:00 rules
    doubleOT: 'SUDDEN DEATH — first team to score wins (shot clock still in use)', // S10
  },

  standings: {
    // 7-point system — recorded in the scorebook (S12)
    gameWin: 3,
    quarterWin: 1,
    quarterTie: 0.5,
  },
};
