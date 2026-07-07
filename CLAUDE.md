# CLAUDE.md — Scorebook v2 Agent Brief

This file is read automatically at the start of every Claude Code session in this repo. It is the standing brief — the rules below apply to every phase, every file, every session, unless Krystal explicitly overrides one in the moment.

---

## What this project is

An event-sourced basketball scorebook for the WPBA (Women's Professional Basketball Association), rebuilt from a v1 single-file React app. Personal practice tool for live scoring on tablet/laptop — no auth, no multi-user, no production backend required for the MVP.

**Read `spec/README.md` first, in every new session, before touching any file.** It indexes everything below and states the current build status. Then read in this order: `spec/project-plan.md` §1–4, `spec/test-scenarios.md`, `spec/diagrams/foul-wizard-flowchart.mermaid` + its dry-run trace, `spec/diagrams/*.mermaid`, `spec/csv-validation-report.md`.

---

## The one architectural rule that overrides all others

**Nothing stores computed state. Everything derives from `events[]`.**

A game is `{ meta, rosters, events: [] }`. Score, fouls, bonus status, box score, standings — every one of these is a pure function over the event list, recomputed on read, never cached as its own piece of state. If you find yourself writing `const [bonusActive, setBonusActive] = useState(...)` — stop. That value must come from a reducer reading `events`, not from stored state. This is not a style preference; it's the entire point of the rebuild, and violating it silently reintroduces every bug class v1 had.

Undo = `events.pop()`. Correction (an official post-hoc change) ≠ undo — corrections append a `CORRECTION {voidsSeq}` event and leave the original visible-but-voided; they never mutate or delete array entries. See `test-scenarios.md` Scenario 15 for the distinction.

---

## Rules discipline — non-negotiable

Every game-rule constant (foul limits, bonus thresholds, timeout counts, OT structure, standings weights) lives in **one file**: `src/rules/wpba.js`, matching the `WPBA` config object in `spec/project-plan.md` §4. No reducer, component, or wizard branch may hardcode a rule number inline. If a number like `5`, `6`, `2`, or `30` appears in a conditional anywhere outside `src/rules/wpba.js`, that's a bug — pull it into config and reference it.

**Why this matters more than it sounds like it should:** v1 hardcoded disqualification at 5 fouls. WPBA disqualifies at 6. Any agent that copies v1 patterns, or leans on general basketball training data (NBA and NCAA both differ from WPBA in ways that matter here), will confidently reintroduce wrong numbers. The config file is the single point where a wrong assumption gets caught instead of silently shipped.

---

## Testing discipline — the process rule

`spec/test-scenarios.md` contains 16 scenarios with exact event sequences and expected reducer outputs, written **before any implementation code existed**. They are the acceptance criteria for every reducer.

> **If a test expectation seems wrong to you, STOP and flag it — do not silently change the test to match your implementation.**

These scenarios encode a licensed official rulebook (`WPBA_Rules_2026_FINAL.pdf`), resolved by a human against the source document. Your job is to satisfy them, not to talk yourself out of them. If you believe a scenario is actually wrong, say so explicitly and wait for confirmation before touching the test file.

Convert scenarios to Vitest fixtures under `tests/` as Phase 2 begins (event arrays are already fully written in the spec — this is a port, not new design work). Run the full suite after every phase, not just the phase's own new tests — reducers make regressions silent, and replay tests are the safety net.

---

## Known traps (condensed — full detail and test cases in `spec/test-scenarios.md`)

| # | Trap | Scenario |
|---|---|---|
| 1 | DQ at **6** fouls, not 5 (v1 bug) or 5 (NCAA habit) | S5 |
| 2 | Bonus triggers on 5th team foul **OR** 2nd team foul after `LAST_TWO_START` — in every quarter | S1, S2 |
| 3 | Offensive fouls: personal foul only, never a team foul, never FTs | S6 |
| 4 | OT is NOT a Q4 extension — fresh foul count, penalty on the **2nd** OT team foul, jump-ball start | S9 |
| 5 | Double OT is sudden death — first score of any kind ends the game | S10 |
| 6 | And-one = exactly 1 FT, never 2, never stacked with bonus | S4 |
| 7 | Technical = 1 FT by any player in the game, resume at POI side-out (except excessive-timeout tech, which also flips possession) | S7 |
| 8 | Re-entry-under-penalty: a returning DQ'd player's re-entry is itself a technical, and *every* subsequent foul she commits compounds a technical on top of the base foul — apply as a wrapper around the wizard's output, not a branch inside it | S16 |
| 9 | Delayed-assessment fouls (flops, techs "at the next neutral opportunity") can be whistled after an intervening sub — shooter eligibility must be evaluated as of the violation's actual moment, not "who's on court now" | dry-run trace, finding 1 |
| 10 | The excessive-timeout technical's entry point is the `TIMEOUT` flow (which already knows the count is zero), never the general `FOUL` wizard | dry-run trace, finding 2 |

---

## Open items — do not silently resolve these; they need Krystal's input or league confirmation

- `[LEAGUE CLARIFICATION]` Do technicals count toward team fouls and/or a player's 6-foul limit? Config currently defaults both to `false`. (S7)
- `[LEAGUE CLARIFICATION]` Does OT scoring affect the Q4 quarter-point award? Config currently assumes OT affects only the 3-point game-win award. (S12)
- `[LEAGUE CLARIFICATION]` (candidate, not yet in test-scenarios.md) Do FF1/FF2 flagrant fouls count toward the 6-foul disqualification total in addition to their own 2-FF1/1-FF2 ejection ladder?
- Two players in the roster CSV (Rokia Doumbia, Tamia Ugass — Oakland Swish) are missing jersey numbers. Recommended fix: parser falls back to a slugified `full_name` as the ID key when jersey is blank. See `spec/csv-validation-report.md`.

If you hit one of these mid-implementation, implement against the stated default, add a `// [LEAGUE CLARIFICATION]` comment at the exact line, and move on — don't block on it.

---

## Tech stack

React (Vite), Tailwind, papaparse (roster CSV), Vitest (tests). Real-time layer (Firestore or Supabase) is Phase 6 only — everything before that is local-first and must work with zero network dependency.

## Folder structure

```
src/
├── rules/        wpba.js — the ONE source of rule constants
├── reducers/      pure functions over events[]
├── components/
└── writers/       appendEvent() and anything that writes to the log (taps, keyboard shortcuts, future automated feeds)
spec/              read-only reference — the pre-implementation spec set
tests/             Vitest fixtures ported from spec/test-scenarios.md
```

## Phase sequence (full detail in `spec/project-plan.md` §6)

- [x] **Phase 0** — Scaffold + roster CSV ingestion (apply the jersey-number parser fallback here) — *the `team_color` column was missing from the CSV as first committed; official 2026 colors (from Krystal, 2026-07-07) are now in the CSV, with `src/data/teamColors.js` as a same-valued fallback*
- [x] **Phase 1** — Event log core (`appendEvent`, taxonomy, `scoreReducer`, `logReducer`, dev event inspector)
- [ ] **Phase 2** — `src/rules/wpba.js` + foul/bonus reducers, verified against all 16 test scenarios first
- [ ] **Phase 3** — Input UI: foul wizard (per `foul-wizard-flowchart.mermaid`, with the two dry-run fixes applied), substitution UI
- [ ] **Phase 4** — Undo/redo + `CORRECTION` events
- [ ] **Phase 5** — Derived views: running score, timeouts, quarter-points standings, box score, JSON export
- [ ] **Phase 6** — Real-time second screen (stretch)
- [ ] **Phase 7** — Polish (keyboard shortcuts, sounds, dark mode)

**Update the checkboxes above as phases complete.** This is the fastest way for a new session to know where the project actually stands without Krystal re-explaining it.

## When unsure

Stop and ask, rather than guessing and shipping. This project has already caught several "confidently wrong" mistakes during the spec phase (v1's foul-count bug, an OT-carryover assumption that would've been backwards, a foul-wizard entry point that pointed at the wrong flow) — all *before* any code existed, because verification happened before implementation. Keep that ordering: verify against `spec/`, then write code, not the reverse.
