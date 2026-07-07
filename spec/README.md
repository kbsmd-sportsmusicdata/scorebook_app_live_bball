# Scorebook v2 — Spec Set

Drop this folder into the root of the Phase 0 repo as `spec/`. Everything here was written **before any implementation code**, per the project's core process rule: rules are resolved and tests are written against the rulebook, not inferred from v1 or general basketball knowledge.

## Contents

```
spec/
├── README.md                          ← you are here
├── project-plan.md                    ← architecture, rules profile, tech stack, 6-phase build sequence
├── test-scenarios.md                  ← 16 trap test cases: exact event sequences + expected reducer outputs
├── csv-validation-report.md           ← pre-Phase-0 roster CSV check: 1 real fix needed
└── diagrams/
    ├── foul-wizard-flowchart.mermaid       ← Phase 3 input UX spec (one-time decision path)
    ├── foul-wizard-dry-run-trace.md        ← hand-traced chaotic possession; 2 real design fixes found
    ├── game-phase-state-diagram.mermaid    ← Regulation → OT → 2OT sudden death → Ended
    └── player-foul-lifecycle.mermaid       ← Bench → OnCourt → DQ → re-entry-under-penalty → Ejected
```

## Reading order for a coding agent

1. **`project-plan.md` §1–3** — architecture (append-only event log), event taxonomy (MVP scope now resolved — missed shots ARE tracked; rebounds/assists are reserved-but-deferred), reducer list
2. **`project-plan.md` §4** — the `WPBA` rules config object; this is the single source of truth for every rule constant. No foul/bonus/timeout/OT number should ever be hardcoded outside this object.
3. **`test-scenarios.md`** — all 16 scenarios, in full, before writing Phase 2 (rules/fouls) or Phase 3 (input wizard) code. Every reducer must pass every scenario that touches it.
4. **`diagrams/foul-wizard-flowchart.mermaid`** — this IS the Phase 3 spec. Each branch is annotated with its scenario number (S1, S2, S4, S5, S6, S7, S8, S9, S16) — trace a branch, find its test, implement, verify.
5. **`diagrams/foul-wizard-dry-run-trace.md`** — read this alongside the flowchart. It found two real design gaps (delayed-assessment foul eligibility timing; the excessive-timeout technical's correct entry point) that change the Phase 2/3 spec — see "Status" below.
6. **`diagrams/game-phase-state-diagram.mermaid`** and **`player-foul-lifecycle.mermaid`** — the only two genuinely persistent state machines in the app (game phase; a given player's foul standing). Everything else is derived fresh from the event log on every read — do not introduce additional stored state to "match" these diagrams.
7. **`csv-validation-report.md`** — read before Phase 0. One real fix needed (two players missing jersey numbers) plus a recommended parser fallback.

## Status

| Area | Status |
|---|---|
| Rules profile (WPBA) | ✅ Resolved against `WPBA_Rules_2026_FINAL.pdf` |
| Trap test scenarios | ✅ 16 scenarios written; 2 items flagged `[LEAGUE CLARIFICATION]` (Scenario 7: technicals vs. team-foul/6-foul count; Scenario 12: OT's effect on quarter points) — both isolated to one-line config defaults so an answer is a small patch, not a rewrite |
| MVP event scope | ✅ Resolved — `SHOT_MISSED` is in MVP; `REBOUND`/`ASSIST` are out-for-MVP with payload attachment points reserved in the schema now (see `project-plan.md` §2) |
| Diagrams | ✅ Foul wizard (flowchart) + game phase & player lifecycle (state diagrams) |
| Foul wizard dry-run | ✅ Traced; found 2 real fixes needed before Phase 3 code (see below), branch *order* itself held up |
| Roster CSV | ✅ Validated; 1 real fix needed before Phase 0 (2 players missing jersey numbers — see `csv-validation-report.md`) |
| Code | ⬜ Not started — Phase 0 (scaffold + roster ingestion) is next |

## Fixes the dry-run surfaced — apply during Phase 2/3, not optional polish

1. **Delayed-assessment foul eligibility timing.** Flops and technicals can be whistled *after* an intervening sub/timeout, which breaks the assumption that log order = event order for `onCourtReducer` lookups. Fix: add optional `eligibilityBasis: {asOfSeq: n}` to delayed-assessment foul payloads (Phase 2 schema addition).
2. **Excessive-timeout technical needs a different entry point.** It should never be reached by starting from the general "FOUL tapped" wizard — the `TIMEOUT` input flow already knows the remaining count is zero before any foul is tapped, and should auto-offer/emit the linked `TIMEOUT` + `FOUL{technical}` pair itself (Phase 3 spec addition).
3. A third, minor convention (who's "the committing player" on an excessive-timeout technical — default: head coach) and a code-hygiene note (derive ejection via one shared function, not three inline branch checks) are documented in the trace file but don't block anything.

## Process rule for every phase

> *"If a test expectation seems wrong to you, STOP and flag it — do not silently change the test to match your implementation."*

The rules profile and test scenarios encode a licensed official's rulebook, resolved by a human against the source PDF. An AI agent's job is to satisfy them, not to talk itself out of them.

## Known open items to close before Phase 2 code

- [ ] `[LEAGUE CLARIFICATION]` Do technicals count toward the team-foul (bonus) count and/or a player's 6-foul limit? (`test-scenarios.md` Scenario 7)
- [ ] `[LEAGUE CLARIFICATION]` Does OT scoring affect the Q4 quarter-point award, or only the game-win 3 points? (`test-scenarios.md` Scenario 12)
- [ ] *(candidate 3rd league question, surfaced by the dry-run, not yet added to test-scenarios.md)* Do FF1/FF2 flagrant fouls count toward a player's 6-foul disqualification total, in addition to their own separate 2-FF1/1-FF2 ejection ladder?
- [ ] Apply dry-run fixes #1 and #2 above during Phase 2/3 implementation
- [ ] Fix the roster CSV per `csv-validation-report.md` (or implement the parser fallback) before Phase 0
- [ ] Convert all 16 scenarios into executable Vitest fixtures (event arrays are already written — this is a mechanical port, not new design work)
