import { playerStatsReducer, statsFor, emptyStats } from './playerStatsReducer.js';

// Pure function over (events, rosters): print-ready per-player rows +
// per-team totals (spec §3). Replaces v1's print view. Includes bench
// players with zero stats so the roster is fully documented, per NCAA
// scorebook convention.

export function boxScoreReducer(events, rosters) {
  const stats = playerStatsReducer(events);
  const rowsBySide = { home: [], away: [] };
  const totalsBySide = { home: emptyStats(), away: emptyStats() };

  for (const side of ['home', 'away']) {
    for (const player of rosters?.[side]?.players ?? []) {
      const s = statsFor(stats, player.playerId);
      rowsBySide[side].push({
        playerId: player.playerId,
        name: player.name,
        jersey: player.jersey,
        position: player.position,
        pts: s.pts,
        fgm: s.fgm,
        fga: s.fga,
        ftm: s.ftm,
        fta: s.fta,
        fouls: s.fouls,
        technicals: s.technicals + s.reentryTechnicals,
        dq: s.dq,
        ejected: s.ejected,
        nextGameSuspension: s.nextGameSuspension,
      });
      // Team totals — pts/FG/FT and foul counts only; DQ/ejection are per-player
      const t = totalsBySide[side];
      t.pts += s.pts;
      t.fgm += s.fgm;
      t.fga += s.fga;
      t.ftm += s.ftm;
      t.fta += s.fta;
      t.fouls += s.fouls;
      t.technicals += s.technicals + s.reentryTechnicals;
    }
  }

  return { rows: rowsBySide, totals: totalsBySide };
}
