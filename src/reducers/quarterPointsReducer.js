import { WPBA } from '../rules/wpba.js';
import { scoreReducer } from './scoreReducer.js';

// Pure function over events[]: WPBA 7-point standings system (S12).
// - 3 standings points for the game win (includes any OT scoring, per the
//   Krystal-flagged default; only Q1-Q4 count for the quarter points)
// - 1 standings point per REGULATION quarter won
// - 0.5 each for a tied regulation quarter
//
// [LEAGUE CLARIFICATION] Krystal's default: OT scoring affects only the
// game-win 3 points; Q4's quarter point is judged at end of regulation.
// Changing this is a one-liner: include OT in the byPeriod loop below.
//
// Sanity property: totals always sum to exactly 3 + 4 = 7.

export function quarterPointsReducer(events) {
  const score = scoreReducer(events);

  const result = {
    home: { quarters: {}, quarterPoints: 0, gameWinPoints: 0, total: 0 },
    away: { quarters: {}, quarterPoints: 0, gameWinPoints: 0, total: 0 },
  };

  for (const p of score.byPeriod) {
    if (p.period > WPBA.periods) continue; // OT/2OT do not add quarter points
    result.home.quarters[p.period] = p.home;
    result.away.quarters[p.period] = p.away;
    if (p.home > p.away) result.home.quarterPoints += WPBA.standings.quarterWin;
    else if (p.away > p.home) result.away.quarterPoints += WPBA.standings.quarterWin;
    else {
      result.home.quarterPoints += WPBA.standings.quarterTie;
      result.away.quarterPoints += WPBA.standings.quarterTie;
    }
  }

  if (score.home > score.away) result.home.gameWinPoints = WPBA.standings.gameWin;
  else if (score.away > score.home) result.away.gameWinPoints = WPBA.standings.gameWin;

  result.home.total = result.home.quarterPoints + result.home.gameWinPoints;
  result.away.total = result.away.quarterPoints + result.away.gameWinPoints;

  return result;
}
