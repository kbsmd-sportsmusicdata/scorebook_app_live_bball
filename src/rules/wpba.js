// THE one source of rule constants (CLAUDE.md rules discipline).
// Phase 2 fills this out to match the full WPBA config object in
// spec/project-plan.md §4 — do not add constants anywhere else.
//
// playersOnCourt and freeThrowPoints are not keys in the §4 object, but they
// are game-rule numbers, so they live here rather than inline in any
// component or reducer.

export const WPBA = {
  periods: 4,
  periodMinutes: 10,

  playersOnCourt: 5,
  freeThrowPoints: 1, // a made free throw scores 1 (scoreReducer)

  timeouts: {
    // §4 shape, partially filled — Phase 2 completes it (perTeamPerHalf,
    // overtimePerTeam, advanceRule).
    leagueMandatory: { perQuarter: 1, seconds: 60, chargedTo: 'neither team' },
  },
};
