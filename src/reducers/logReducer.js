import { WPBA } from '../rules/wpba.js';
import { periodLabel } from './periodLabel.js';
import { voidedSeqs } from './voids.js';

// Pure function over events[]: human-readable play-by-play entries (the game
// log sheet, spec §3). Unlike scoreReducer, voided events are NOT dropped —
// they come back flagged `voided: true` so the UI renders them struck-through
// (Scenario 15: visible-but-voided, never erased).
//
// Returns [{ seq, ts, period, team, type, text, voided }] in log order.

function playerLookup(rosters) {
  const byId = new Map();
  for (const side of ['home', 'away']) {
    for (const player of rosters?.[side]?.players ?? []) {
      byId.set(player.playerId, player);
    }
    for (const coach of rosters?.[side]?.coaches ?? []) {
      if (coach.coachId) byId.set(coach.coachId, { name: `${coach.name} (${coach.role})`, jersey: null });
    }
  }
  return byId;
}

function describe(event, { players, teamNames }) {
  const { type, team } = event;
  const payload = event.payload ?? {}; // never crash rendering the log on a malformed event
  const teamName = teamNames[team] ?? '';
  const player = players.get(event.playerId);
  const who = player
    ? `${player.jersey != null ? `#${player.jersey} ` : ''}${player.name} (${teamName})`
    : event.playerId
      ? `${event.playerId} (${teamName})`
      : teamName;

  switch (type) {
    // '?' for a missing point value on purpose: this is a scorer's record, so
    // an obviously-broken entry beats a fabricated plausible one.
    case 'SHOT_MADE':
      return `${who} made a ${payload.points ?? '?'}-point shot`;
    case 'SHOT_MISSED':
      return `${who} missed a ${payload.shotValue ?? '?'}-point attempt`;
    case 'FT_MADE':
    case 'FT_MISSED': {
      const result = type === 'FT_MADE' ? 'made' : 'missed';
      const { n, of } = payload.attemptOf ?? {};
      const attempt = n != null && of != null ? ` ${n} of ${of}` : '';
      const context = payload.context ? ` (${payload.context})` : '';
      return `${who} ${result} free throw${attempt}${context}`;
    }
    case 'FOUL': {
      const shooting = payload.shooting ? ', shooting' : '';
      const kind = payload.specialKind ? ` (${payload.specialKind})` : '';
      const source =
        payload.source === 'excessiveTimeout'
          ? ' (excessive timeout)'
          : payload.source === 'reentryPenalty'
            ? ' (re-entry penalty, compounds the base foul)'
            : '';
      return `${payload.foulType} foul${kind}${shooting}${source} on ${who}`;
    }
    case 'PERIOD_START':
      return `Start of ${periodLabel(event.period)}`;
    case 'PERIOD_END':
      return `End of ${periodLabel(event.period)}`;
    case 'LAST_TWO_START':
      return `Last two minutes of ${periodLabel(event.period)} — penalty rules armed`;
    case 'GAME_END':
      return 'Game over';
    case 'TIMEOUT':
      if (payload.toType === 'mandatory') {
        return `League mandatory timeout (${WPBA.timeouts.leagueMandatory.seconds}s)`;
      }
      if (payload.toType === 'excessive') {
        return `Excessive timeout — ${teamName}`;
      }
      return `30-second timeout — ${teamName}`;
    case 'SUB_IN':
      if (payload.ruleException) return `${who} RE-ENTERS UNDER PENALTY (technical charged)`;
      if (payload.mustRemain) return `${who} checks in (FT substitute — must remain in game)`;
      return `${who} checks in`;
    case 'SUB_OUT':
      return `${who} checks out`;
    case 'POSSESSION_ARROW_FLIP':
      return 'Possession arrow flips';
    case 'CORRECTION': {
      const reason = payload.reason ? ` — ${payload.reason}` : '';
      return `Correction: voids event #${payload.voidsSeq}${reason}`;
    }
    default:
      return type;
  }
}

export function logReducer(events, rosters) {
  const context = {
    players: playerLookup(rosters),
    teamNames: {
      home: rosters?.home?.name ?? 'Home',
      away: rosters?.away?.name ?? 'Away',
      league: 'League',
    },
  };
  const voided = voidedSeqs(events);

  return events.map((event) => ({
    seq: event.seq,
    ts: event.ts,
    period: event.period,
    team: event.team,
    type: event.type,
    text: describe(event, context),
    voided: voided.has(event.seq),
  }));
}
