import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';

// Pure function over events[]: team fouls THIS period + bonus flags (spec §3).
// Verified against Scenarios 1, 2, 3, 4, 6, 7, 9 in spec/test-scenarios.md.
//
// Returns:
//   {
//     period,                    // current period (null before the opener)
//     lastTwoArmed,              // LAST_TWO_START tapped this period
//     teamFouls: { home, away }, // fouls COMMITTED by each team this period
//     bonus: { home, away },     // bonus.home === home SHOOTS the penalty FTs
//   }                            //   (i.e. away's fouls crossed the threshold)

function countsTowardTeamFouls(payload) {
  switch (payload?.foulType) {
    case 'offensive':
      return WPBA.offensiveFoulCountsTowardTeamFouls; // S6: personal yes, team NO
    case 'technical':
      return WPBA.technicals.countsTowardTeamFouls; // [LEAGUE CLARIFICATION] default false
    case 'flagrant1':
    case 'flagrant2':
      return WPBA.flagrant.countsTowardTeamFouls;
    case 'special':
      // S8 family — per-kind convention from config (unverified against the
      // rulebook's team-foul language; see the config comment)
      return WPBA.specialFouls.kinds[payload?.specialKind]?.countsTowardTeamFouls ?? true;
    default:
      return true; // personal (shooting or not — S4)
  }
}

export function teamFoulsReducer(events) {
  let period = null;
  let fouls = { home: 0, away: 0 };
  let lastTwoArmed = false;

  for (const event of activeEvents(events)) {
    switch (event.type) {
      case 'PERIOD_START':
        period = event.period;
        if (WPBA.teamFoulsResetEachPeriod) fouls = { home: 0, away: 0 };
        lastTwoArmed = false; // S3: a prior quarter's marker never leaks forward
        break;
      case 'LAST_TWO_START':
        lastTwoArmed = true;
        break;
      case 'FOUL':
        if ((event.team === 'home' || event.team === 'away') && countsTowardTeamFouls(event.payload)) {
          fouls[event.team] += 1;
        }
        break;
      default:
        break;
    }
  }

  // Dual trigger, OR-ed (S2): the period-type threshold (regulation 5 / OT 2 —
  // the S3+S9 trap pair), or the last-2:00 threshold once the marker is armed.
  const isOvertime = period != null && period > WPBA.periods;
  const baseThreshold = isOvertime ? WPBA.overtime.teamFoulPenaltyAt : WPBA.bonus.atTeamFouls;
  const overLimit = (committedBy) =>
    fouls[committedBy] >= baseThreshold ||
    (lastTwoArmed && fouls[committedBy] >= WPBA.bonus.lastTwoMinutes.atTeamFouls);

  return {
    period,
    lastTwoArmed,
    teamFouls: { ...fouls },
    bonus: { home: overLimit('away'), away: overLimit('home') },
  };
}
