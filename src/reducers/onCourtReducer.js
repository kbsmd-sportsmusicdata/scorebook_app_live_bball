import { activeEvents } from './voids.js';

// Pure function over (events, rosters): the current five per team, from the
// setup starters plus SUB_IN/SUB_OUT. A DQ'd player is NOT auto-removed —
// she leaves via a logged SUB_OUT like everyone else (S5: auto-removal with
// no SUB event in the log is explicitly wrong).
//
// Also tracks the S16 reentryUnderPenalty flag: set by a SUB_IN carrying
// ruleException, and it persists for the rest of the game (it never clears,
// even across her later subs).
//
// onCourtAsOf answers "who was on court as of seq N" for delayed-assessment
// fouls (dry-run finding 1): flops/techs whistled after an intervening sub
// must evaluate shooter eligibility at the violation's actual moment.

export function onCourtAsOf(events, rosters, asOfSeq = Infinity) {
  const onCourt = {
    home: new Set(rosters.home.starterIds ?? []),
    away: new Set(rosters.away.starterIds ?? []),
  };
  const reentryUnderPenalty = new Set();

  for (const event of activeEvents(events)) {
    if (event.seq > asOfSeq) break;
    if (event.team !== 'home' && event.team !== 'away') continue;
    if (event.type === 'SUB_IN') {
      onCourt[event.team].add(event.playerId);
      if (event.payload?.ruleException) reentryUnderPenalty.add(event.playerId);
    } else if (event.type === 'SUB_OUT') {
      onCourt[event.team].delete(event.playerId);
    }
  }

  return {
    home: [...onCourt.home],
    away: [...onCourt.away],
    reentryUnderPenalty: [...reentryUnderPenalty],
  };
}

export function onCourtReducer(events, rosters) {
  return onCourtAsOf(events, rosters, Infinity);
}
