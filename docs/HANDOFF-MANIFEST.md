# Scorebook v2 — Repo Handoff Bundle

This zip mirrors the root of the Phase 0 repo. Unzip it directly into an empty repo folder and every file lands where it belongs — no reshuffling needed.

```
(repo root)
├── CLAUDE.md                          ← read automatically by Claude Code every session
├── docs/
│   └── v1-vs-v2-comparison.md         ← your learning notebook; Claude Code fills in its half as reducers land
└── spec/                              ← read-only pre-implementation reference (do not edit once code starts)
    ├── README.md
    ├── project-plan.md
    ├── test-scenarios.md
    ├── csv-validation-report.md
    └── diagrams/
        ├── foul-wizard-flowchart.mermaid
        ├── foul-wizard-dry-run-trace.md
        ├── game-phase-state-diagram.mermaid
        └── player-foul-lifecycle.mermaid
```

## What's NOT in this bundle (add these yourself before or during Phase 0)

- `wpba_2026_rosters_master.csv` — currently a Claude project file, not yet in the repo. Copy it in at repo root (or wherever Phase 0's CSV-ingestion code expects it — confirm the path in the Phase 0 prompt).
- `WPBA_Rules_2026_FINAL.pdf` — the source rulebook. Not required by the code itself (its contents are already fully resolved into `spec/project-plan.md` §4 and `spec/test-scenarios.md`), but worth keeping in the repo (e.g. `spec/WPBA_Rules_2026_FINAL.pdf`) as the paper trail back to the original source, in case any `[LEAGUE CLARIFICATION]` item needs re-checking later.
- `package.json`, `vite.config.js`, and everything else Phase 0 scaffolding generates — this bundle is documentation only, zero code.

## Three-file mental model

| File/folder | Role | Who edits it, and when |
|---|---|---|
| `CLAUDE.md` | Standing agent brief — architecture rule, rules discipline, traps, phase checklist | Claude Code updates the phase checkboxes as work completes; everything else is stable unless Krystal changes direction |
| `spec/` | Frozen pre-implementation reference | Nobody edits after Phase 0 starts — if a scenario turns out wrong, that's a flagged conversation, not a silent edit |
| `docs/` | Living notebook | Grows throughout the build — comparison doc now, likely joined by other running notes later |
