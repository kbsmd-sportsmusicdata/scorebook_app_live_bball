import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';

// Pure function over events[]: per-player PTS, FGM/FGA, FTM/FTA, fouls,
// technicals/flagrants, DQ and ejection flags (spec §3). Verified against
// Scenarios 1, 3, 4, 5, 6, 7, 16 in spec/test-scenarios.md.
//
// Returns { [playerId]: stats }. Use statsFor(stats, playerId) to read a
// player who has no events yet (all-zero stats).

export const emptyStats = () => ({
  pts: 0,
  fgm: 0,
  fga: 0,
  ftm: 0,
  fta: 0,
  fouls: 0, // count toward the 6-foul DQ limit
  technicals: 0,
  flagrant1: 0,
  flagrant2: 0,
  dq: false,
  ejected: false,
  nextGameSuspension: false,
});

export const statsFor = (stats, playerId) => stats[playerId] ?? emptyStats();

// The ejection ladder, derived in ONE place (dry-run trace finding 4): every
// consumer — reducers, wizard branches, UI — must call this, never re-derive.
// 2 technicals, 2 FF1s, or any FF2 (immediateEjection) → ejected + suspension.
export function isEjected(stats) {
  return (
    stats.technicals >= WPBA.technicals.ejectionAt ||
    stats.flagrant1 >= WPBA.flagrant.FF1.ejectionAt ||
    (WPBA.flagrant.FF2.immediateEjection && stats.flagrant2 > 0)
  );
}

// How much a foul adds to the player's count-toward-six.
function countsTowardSix(foulType) {
  switch (foulType) {
    case 'technical':
      return WPBA.technicals.countsTowardPlayerSix ? 1 : 0; // [LEAGUE CLARIFICATION] default false
    case 'flagrant1':
    case 'flagrant2':
      return WPBA.flagrant.countsTowardPlayerSix ? 1 : 0; // [LEAGUE CLARIFICATION] default false
    default:
      return 1; // personal AND offensive (S6: an offensive foul is a personal foul)
  }
}

export function playerStatsReducer(events) {
  const stats = {};
  const forPlayer = (playerId) => {
    if (!stats[playerId]) stats[playerId] = emptyStats();
    return stats[playerId];
  };

  for (const event of activeEvents(events)) {
    if (!event.playerId) continue;
    const s = forPlayer(event.playerId);

    switch (event.type) {
      case 'SHOT_MADE':
        s.pts += event.payload?.points ?? 0;
        s.fgm += 1;
        s.fga += 1;
        break;
      case 'SHOT_MISSED':
        s.fga += 1;
        break;
      case 'FT_MADE':
        s.pts += WPBA.freeThrowPoints;
        s.ftm += 1;
        s.fta += 1;
        break;
      case 'FT_MISSED':
        s.fta += 1;
        break;
      case 'FOUL': {
        const foulType = event.payload?.foulType;
        if (foulType === 'technical') s.technicals += 1;
        else if (foulType === 'flagrant1') s.flagrant1 += 1;
        else if (foulType === 'flagrant2') s.flagrant2 += 1;
        s.fouls += countsTowardSix(foulType);
        break;
      }
      case 'SUB_IN':
        // S16: re-entering under penalty is itself a technical foul, charged
        // the moment she steps back on court — no separate FOUL event exists.
        if (event.payload?.ruleException) s.technicals += 1;
        break;
      default:
        break;
    }
  }

  for (const s of Object.values(stats)) {
    s.dq = s.fouls >= WPBA.playerFoulLimit; // at SIX — S5; v1's 5 was the bug
    s.ejected = isEjected(s);
    s.nextGameSuspension = s.ejected; // every ejection carries one (S7)
  }

  return stats;
}
