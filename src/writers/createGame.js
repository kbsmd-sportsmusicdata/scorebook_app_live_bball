// Game-document factory (spec/project-plan.md §2): a game is { meta, rosters,
// events: [] } and NOTHING else — every other value is derived from events.
// starterIds is setup input (who the scorer picked), not derived state; the
// on-court five during play is Phase 2's onCourtReducer over SUB events.

export function createGame({ home, away, rulesProfile = 'WPBA' }) {
  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Local date, not UTC — an evening game must not get tomorrow's gameId.
  const dateStamp = new Date().toLocaleDateString('en-CA');

  return {
    gameId: `wpba-${dateStamp}-${slug(home.team.name)}-${slug(away.team.name)}`,
    meta: {
      homeTeamId: home.team.teamId,
      awayTeamId: away.team.teamId,
      rules: rulesProfile,
      createdAt: Date.now(),
    },
    rosters: {
      home: { ...home.team, starterIds: home.starterIds },
      away: { ...away.team, starterIds: away.starterIds },
    },
    events: [],
  };
}
