import { WPBA } from '../rules/wpba.js';
import { teamFoulsReducer } from '../reducers/teamFoulsReducer.js';
import { onCourtAsOf } from '../reducers/onCourtReducer.js';

// The foul wizard's decision logic, pure and UI-free, implementing
// spec/diagrams/foul-wizard-flowchart.mermaid with both dry-run fixes:
//   1. delayed-assessment fouls carry eligibilityBasis {asOfSeq} and their
//      shooter pool is evaluated as of that seq, not "now";
//   2. the excessive-timeout technical is NOT reachable from here — its only
//      entry point is the TIMEOUT flow (resolveExcessiveTimeout below).
// The S16 re-entry wrapper is applied AROUND the branch output, never as a
// branch inside it.
//
// resolveFoul(answers, ctx) → {
//   foulPayload,           // payload for the FOUL event
//   freeThrows: { count, shooterRule, defaultShooterId, pool, context },
//   possession,            // display string for the scorer, not an event
//   reentryWrapper,        // true → commit must append the linked technical
// }
//
// answers: { team, playerId, foulType, specialKind?, shooting?, made?,
//            shotValue?, fouledPlayer?, asOfSeq? }
// ctx: { game } (events + rosters)

const opponent = (team) => (team === 'home' ? 'away' : 'home');

function shooterPool(game, team, { asOfSeq } = {}) {
  const onCourt = onCourtAsOf(game.events, game.rosters, asOfSeq ?? Infinity);
  return onCourt[team];
}

export function resolveFoul(answers, { game }) {
  const { team, playerId, foulType } = answers;
  const shootingTeam = opponent(team);
  const base = { foulType };
  const onCourtNow = onCourtAsOf(game.events, game.rosters);
  const reentryWrapper = onCourtNow.reentryUnderPenalty.includes(playerId);

  let resolution;

  if (foulType === 'offensive') {
    // O1/O2 — S6: player foul only, no team foul, no FTs even in the bonus
    resolution = {
      foulPayload: base,
      freeThrows: null,
      possession: 'Possession flips — side-out',
    };
  } else if (foulType === 'personal' && !answers.shooting) {
    // P2 — penalty derived (never stored), INCLUDING the foul being committed
    const current = teamFoulsReducer(game.events);
    const period = current.period;
    const isOvertime = period != null && period > WPBA.periods;
    const foulsAfter = current.teamFouls[team] + 1;
    const inPenalty =
      foulsAfter >= (isOvertime ? WPBA.overtime.teamFoulPenaltyAt : WPBA.bonus.atTeamFouls) ||
      (current.lastTwoArmed && foulsAfter >= WPBA.bonus.lastTwoMinutes.atTeamFouls);
    resolution = {
      foulPayload: { ...base, shooting: false },
      freeThrows: inPenalty
        ? {
            count: WPBA.bonus.freeThrows,
            shooterRule: 'fouledPlayer',
            defaultShooterId: answers.fouledPlayer ?? null,
            pool: shooterPool(game, shootingTeam),
            context: 'bonus',
          }
        : null,
      possession: inPenalty ? 'Free throws (penalty)' : 'No FTs — side-out',
    };
  } else if (foulType === 'personal' && answers.shooting && answers.made) {
    // P5/P6 — and-one: basket already logged by the scorer; exactly 1 FT
    resolution = {
      foulPayload: { ...base, shooting: true, andOne: true, fouledPlayer: answers.fouledPlayer },
      freeThrows: {
        count: WPBA.andOneFreeThrows,
        shooterRule: 'fouledPlayer',
        defaultShooterId: answers.fouledPlayer,
        pool: shooterPool(game, shootingTeam),
        context: 'andOne',
      },
      possession: 'Basket counts + 1 FT',
    };
  } else if (foulType === 'personal' && answers.shooting) {
    // P7/P8/P9 — missed attempt: FTs equal the shot value (a missed 3 = 3 FTs).
    // No SHOT_MISSED is logged — a missed attempt with a shooting foul is not
    // a field-goal attempt; the value rides on the foul payload (S4 contrast, S5).
    resolution = {
      foulPayload: {
        ...base,
        shooting: true,
        shotValue: answers.shotValue,
        made: false,
        fouledPlayer: answers.fouledPlayer,
      },
      freeThrows: {
        count: answers.shotValue,
        shooterRule: 'fouledPlayer',
        defaultShooterId: answers.fouledPlayer,
        pool: shooterPool(game, shootingTeam),
        context: 'shootingFoul',
      },
      possession: 'Free throws',
    };
  } else if (foulType === 'technical') {
    // T3 — S7: 1 FT by any opposing player in the game; POI direct side-out.
    // (T1/T2 excessive-timeout is deliberately unreachable from this wizard.)
    resolution = {
      foulPayload: base,
      freeThrows: {
        count: WPBA.technicals.freeThrows,
        shooterRule: 'anyInGame',
        defaultShooterId: null,
        pool: shooterPool(game, shootingTeam),
        context: 'technical',
      },
      possession: 'Resume at POI — direct side-out (possession does NOT flip)',
    };
  } else if (foulType === 'flagrant1' || foulType === 'flagrant2') {
    // F2/F3
    const cfg = foulType === 'flagrant1' ? WPBA.flagrant.FF1 : WPBA.flagrant.FF2;
    resolution = {
      foulPayload: { ...base, fouledPlayer: answers.fouledPlayer ?? null },
      freeThrows: {
        count: cfg.freeThrows,
        shooterRule: 'fouledPlayer',
        defaultShooterId: answers.fouledPlayer ?? null,
        pool: shooterPool(game, shootingTeam),
        context: foulType,
      },
      possession: `${cfg.possession} — shot clock: ${cfg.shotClock}`,
    };
  } else if (foulType === 'special') {
    const kind = WPBA.specialFouls.kinds[answers.specialKind];
    if (kind?.treatAsTechnical) {
      // SP3 — flop resolves as a technical, with dry-run fix 1: shooter must
      // have been in the game AT THE TIME OF THE VIOLATION.
      const asOfSeq = answers.asOfSeq ?? (game.events.length > 0 ? game.events[game.events.length - 1].seq : 0);
      resolution = {
        foulPayload: { foulType: 'technical', specialKind: 'flop', eligibilityBasis: { asOfSeq } },
        freeThrows: {
          count: WPBA.technicals.freeThrows,
          shooterRule: 'inGameAtViolation',
          defaultShooterId: null,
          pool: shooterPool(game, shootingTeam, { asOfSeq }),
          context: 'technical',
        },
        possession: 'POI',
      };
    } else {
      // SP1/SP2/SP4 — shared 1-FT resolution, per-kind possession outcome
      resolution = {
        foulPayload: { ...base, specialKind: answers.specialKind },
        freeThrows: {
          count: WPBA.specialFouls.freeThrows,
          shooterRule: 'anyInGame',
          defaultShooterId: null,
          pool: shooterPool(game, shootingTeam),
          context: 'special',
        },
        possession: kind?.possession ?? 'POI',
      };
    }
  } else {
    throw new Error(`Unresolvable foul answers: ${JSON.stringify(answers)}`);
  }

  return { ...resolution, reentryWrapper };
}

// Assemble the full undo-group for a resolved foul: the FOUL event, its FT
// events (already recorded made/missed by the scorer in the wizard), any
// pre-FT substitution (DQ'd shooter variant, S5 — SUB_IN logged BEFORE the
// FTs, mustRemain honored by the UI), and — AFTER everything the branch
// produced — the S16 compounding technical plus its own FT, when the
// committing player is under the re-entry penalty.
export function buildFoulGroup({ answers, resolution, ftResults = [], preFtSub = null, reentryFt = null }) {
  const inputs = [];

  inputs.push({
    type: 'FOUL',
    team: answers.team,
    playerId: answers.playerId,
    payload: resolution.foulPayload,
  });

  if (preFtSub) {
    inputs.push(
      { type: 'SUB_OUT', team: preFtSub.team, playerId: preFtSub.out, payload: {} },
      { type: 'SUB_IN', team: preFtSub.team, playerId: preFtSub.in, payload: { mustRemain: true } },
    );
  }

  const shootingTeam = opponent(answers.team);
  ftResults.forEach((result, i) => {
    inputs.push({
      type: result.made ? 'FT_MADE' : 'FT_MISSED',
      team: shootingTeam,
      playerId: result.shooterId,
      payload: {
        attemptOf: { n: i + 1, of: ftResults.length },
        context: resolution.freeThrows?.context ?? 'penalty',
      },
    });
  });

  if (resolution.reentryWrapper) {
    // Wrapper around the wizard's output (trap 8): the compound technical is
    // appended after whatever the base foul resolved to. linkedSeq is filled
    // at commit time by the caller, since seqs are assigned on append.
    inputs.push({
      type: 'FOUL',
      team: answers.team,
      playerId: answers.playerId,
      payload: { foulType: 'technical', source: 'reentryPenalty' },
    });
    if (reentryFt) {
      inputs.push({
        type: reentryFt.made ? 'FT_MADE' : 'FT_MISSED',
        team: shootingTeam,
        playerId: reentryFt.shooterId,
        payload: { attemptOf: { n: 1, of: 1 }, context: 'technical' },
      });
    }
  }

  return inputs;
}

// The excessive-timeout technical's ONLY entry point (dry-run finding 2):
// called by the TIMEOUT flow once timeoutsReducer reports zero remaining.
// Emits the linked TIMEOUT + FOUL pair; committed by the head coach per the
// config convention. The 1 technical FT (+ loss of possession — the one tech
// that flips it) resolves in the same group when the scorer records it.
export function buildExcessiveTimeoutGroup({ team, coachId, ftResult = null }) {
  const inputs = [
    { type: 'TIMEOUT', team, payload: { toType: 'excessive' } },
    {
      type: 'FOUL',
      team,
      playerId: coachId,
      payload: { foulType: 'technical', source: 'excessiveTimeout' },
    },
  ];
  if (ftResult) {
    inputs.push({
      type: ftResult.made ? 'FT_MADE' : 'FT_MISSED',
      team: opponent(team),
      playerId: ftResult.shooterId,
      payload: { attemptOf: { n: 1, of: 1 }, context: 'technical' },
    });
  }
  return inputs;
}
