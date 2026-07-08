import { WPBA } from '../rules/wpba.js';
import { activeEvents } from './voids.js';

// Pure function over events[]: where the game is in its lifecycle, per the
// game-phase state diagram (Regulation → OT → 2OT sudden death → Ended).
//
//   phase: 'pregame' | 'live' | 'break' | 'ended'
//   suddenDeath: true while live in period ≥ periods+2 — S10: the FIRST score
//   of any kind ends the game (a made FT counts, an offensive foul does not).

export function gamePhaseReducer(events) {
  let phase = 'pregame';
  let period = null;

  for (const event of activeEvents(events)) {
    if (event.type === 'PERIOD_START') {
      phase = 'live';
      period = event.period;
    } else if (event.type === 'PERIOD_END') {
      phase = 'break';
    } else if (event.type === 'GAME_END') {
      phase = 'ended';
    }
  }

  return {
    phase,
    period,
    suddenDeath: phase === 'live' && period != null && period >= WPBA.periods + 2,
  };
}
