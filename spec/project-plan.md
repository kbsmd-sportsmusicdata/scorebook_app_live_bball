# Scorebook v2 — Project Plan
## Event-Sourced Basketball Scoring App (Vibe-Coded Build)

**Author:** Krystal Beasley
**Date:** July 2026
**Status:** Planning
**Predecessor:** `scorebook.jsx` (v1) — single-file React app with state-based scoring, per-player tracking, fouls/bonus, undo, game log, and print view

---

## 1. Project Overview

### What we're building
A rebuilt interactive digital scorebook for basketball, modeled on the Official NCAA Women's Basketball Scorebook, but re-architected around an **append-only event log** — the same pattern used in the baseball code-along class. The app remains a personal practice tool for live scoring on tablet/laptop, now with a cleaner foundation that makes new features cheap to add.

### Why rebuild instead of extend v1
v1 stores *state* (score, foul counts, stat totals) and mutates it with each tap. That works, but every new feature requires new state, new update logic, and new undo handling. v2 stores *events* and computes everything else.

**The analogy:** v1 is like keeping a running total on a whiteboard — every action erases and rewrites numbers, and if you make a mistake three actions ago, untangling it is painful. v2 is like the actual paper scorebook you're modeling: an official scorer never erases; she records each event in sequence, and the score, fouls, and box score are all *readable from the record itself*. If she made an error, she finds the entry and the whole picture corrects itself. The NCAA scorebook **is** an append-only event log on paper — this architecture is truer to the source material than v1 was.

### Success criteria
- All v1 features reproduced (setup, scoring, fouls/bonus/DQ, undo, log, print)
- All five deferred v1 features implemented (running score squares, timeouts, period summary, keyboard shortcuts, JSON export) — each as a pure function over the event log
- Rosters load automatically from `wpba_2026_rosters_master.csv`
- Undo/redo works at any depth with zero special-case code
- (Stretch) A second screen — spectator/scoreboard view — reading the same game document in real time

---

## 2. Core Architecture: The Append-Only Event Log

### The one rule
**Nothing stores computed state. Everything derives from `events[]`.**

A game is a single document:

```js
{
  gameId: "wpba-2026-07-11-wolves-swish",
  meta: {
    homeTeamId: 675231,
    awayTeamId: ...,
    rules: "WPBA",          // rules profile (see §4)
    createdAt: ...,
  },
  rosters: { home: [...], away: [...] },   // loaded from CSV
  events: [ /* append-only */ ]
}
```

### Event schema
Every event shares a common envelope:

```js
{
  seq: 42,                  // monotonic sequence number
  ts: 1720735012345,        // wall-clock timestamp
  period: 2,                // 1–4, 5+ = OT
  type: "SHOT_MADE",        // see taxonomy below
  team: "home",
  playerId: "675231-22",    // teamId-jersey composite
  payload: { points: 2 }    // type-specific details
}
```

### Basketball event taxonomy (v2 scope — RESOLVED)

| Category | Event types | Payload notes |
|---|---|---|
| Scoring | `SHOT_MADE`, `SHOT_MISSED` | `points: 2 \| 3` on made; missed shots carry the same shape minus `points`, plus `shotValue: 2 \| 3` so a miss and a make are structurally symmetric |
| Free throws | `FT_MADE`, `FT_MISSED` | `attemptOf: {n, of}` for 1-of-2 etc. |
| Fouls | `FOUL` | `foulType: personal \| technical \| flagrant1 \| flagrant2 \| offensive` |
| Clock/flow | `PERIOD_START`, `PERIOD_END`, `LAST_TWO_START`, `GAME_END` | `LAST_TWO_START` is a scorer-tapped marker (app has no game clock); mirrors the refs directing the scoreboard at the 2:00 mark, and arms the WPBA last-2:00 penalty + timeout rules |
| Timeouts | `TIMEOUT` | `toType: full \| thirty` |
| Substitution | `SUB_IN`, `SUB_OUT` | — |
| Possession | `POSSESSION_ARROW_FLIP` | — |
| Admin | `CORRECTION` | `voidsSeq: n` — marks an earlier event void without deleting it (official-scorer style correction, distinct from undo) |
| *(post-MVP, reserved)* | `REBOUND`, `ASSIST` | **Out of MVP scope, but not out of the schema.** `SHOT_MADE`/`SHOT_MISSED` payloads reserve an optional `assistedBy: playerId \| null` field from day one, and `SHOT_MISSED` reserves an optional `reboundedBy: {playerId, type: offensive \| defensive} \| null` field — both `null` until Phase 7 lights them up. This costs nothing now and avoids a schema migration later. |

### MVP scope decision (Reference Checkpoint #1 — RESOLVED)

**Missed shots are IN the MVP.** `SHOT_MISSED` joins `SHOT_MADE` as a first-class event from Phase 1 onward — this is a deliberate expansion beyond v1, which only ever recorded makes. The rationale: shooting percentage is meaningless without attempts, and the WPBA rulebook itself requires knowing shot value on misses anyway (a missed 3-point attempt with a shooting foul awards 3 FTs, not 2 — see `test-scenarios.md` Scenario 4's contrast case). The data is already needed for foul resolution; formalizing it as its own event just makes it queryable everywhere else too (shooting %, box score, spray-chart-if-ever-wanted).

**Rebounds and assists are OUT of the MVP**, deliberately deferred to a later phase — but the schema above reserves their attachment points now so adding them later is additive, not a migration. Practically: the Phase 3 input wizard does not prompt for "who rebounded that?" or "who assisted?" in the MVP build; those prompts get added as an optional follow-up step in a later phase without touching any event already in the log.

### Why undo becomes trivial
Undo = `events.pop()`. Redo = re-append from a redo buffer. Multi-step undo = pop N. The v1 history modal becomes a thin UI over slicing the array. No compensating logic, ever. This alone justifies the rebuild.

---

## 3. Derived State: Reducers Over the Log

Every screen is a **pure function**: `f(events, rosters, rules) → view data`. Target list:

| Reducer | Produces | Replaces v1 feature |
|---|---|---|
| `scoreReducer` | Home/away totals, per-period splits | Sticky score bar + period summary |
| `playerStatsReducer` | Per-player PTS, FGM/FGA (now derivable — misses are events), FTM/FTA, fouls, foul dots, DQ flag | Player rows |
| `teamFoulsReducer` | Team fouls *this period*, bonus flag | Foul counters + BONUS badge |
| `runningScoreReducer` | Sequence of cumulative scores with scorer attribution | **New: running score squares** — the classic scorebook column, and the most naturally event-log-shaped feature in the whole app |
| `timeoutsReducer` | Remaining timeouts per team | **New: timeout tracking** |
| `onCourtReducer` | Current five per team (from SUB events) | New — enables lineup validation |
| `logReducer` | Human-readable play-by-play strings | Game log sheet |
| `boxScoreReducer` | Print-ready stat tables | Print view |
| `exportReducer` | Full game JSON | **New: JSON export** — nearly free: it's just the document itself |
| `quarterPointsReducer` | WPBA 7-point standings result: 3 pts for the game win + 1 pt per quarter won (0.5 each for tied quarters) | **New — league requirement.** The rulebook says quarter points are recorded *in the scorebook* for standings, so this is literally an official-scorer duty in this league. It's also the poster child for the architecture: standings points are a pure function over period scores, which are a pure function over events |

**Implementation rule for the AI agent:** reducers must be pure, take the full event list, and never cache between calls (memoize at the React layer with `useMemo` if perf demands it — it won't at basketball event volumes, ~150–300 events/game).

> 📺 **REFERENCE CHECKPOINT #2 — Box score & running score layout.** Pull up a Genius Sports box score output (any NCAA women's game on stats sites powered by Genius) and a photo of a filled-in paper running-score column. The running score squares are the trickiest UI element to get right digitally — seeing how pro tools render cumulative scoring (and where they *deviate* from paper) will save design churn.

---

## 4. Rules Profile — WPBA (the "AI confidently wrong" firewall)

The code-along instructor's key lesson: **your domain expertise is the QA layer.**

**⚠ Rules source resolved (July 2026):** the authoritative rulebook is `WPBA_Rules_2026_FINAL.pdf` (in project files) — a FIBA/WNBA hybrid, **not** NCAA women's rules. This changes several values from the original draft of this plan, and it exposes a latent v1 bug: **v1 auto-disqualifies at 5 fouls; WPBA players foul out on their SIXTH foul.** Any agent that "helpfully" copies v1 logic inherits that bug — a perfect real-world example of why the rules profile must be an explicit config object, not scattered assumptions.

```js
const WPBA = {
  periods: 4, periodMinutes: 10, halftimeMinutes: 12, shotClockSeconds: 24,

  playerFoulLimit: 6,                        // fouls out on the SIXTH personal foul
  teamFoulsResetEachPeriod: true,

  bonus: {
    atTeamFouls: 5,                          // 2 FTs on the team's 5th foul of the quarter...
    lastTwoMinutes: { atTeamFouls: 2 },      // ...OR its 2nd team foul in the last 2:00 of ANY quarter
    freeThrows: 2,                           // always two shots; no one-and-one anywhere
    // Rulebook note: on the 1st team foul inside 2:00, refs direct the scoreboard
    // to display "4" under team fouls — our LAST_TWO_START event is the digital twin of that moment
  },

  offensiveFoulCountsTowardTeamFouls: false, // explicit: personal foul yes, team foul NO, never FTs

  technicals: {
    freeThrows: 1,                           // shot by any player in the game at the time
    resume: "POI, direct side-out",
    ejectionAt: 2,                           // 2 techs = ejection AND next-game suspension
    excessiveTimeout: "technical + loss of possession",
    floppingIsTechnical: true,               // STEM: secondary, theatrical, exaggerated movements
  },

  flagrant: {
    FF1: { freeThrows: 2, possession: "FTLE, frontcourt", shotClock: "full reset", ejectionAt: 2 },
    FF2: { freeThrows: 2, possession: "FTLE, frontcourt", shotClock: "full reset", immediateEjection: true },
  },

  timeouts: {
    perTeamPerHalf: { thirtySecond: 2 },     // NO carryover 1st→2nd half, none into OT
    leagueMandatory: { perQuarter: 1, seconds: 60,
                       when: "first dead ball at 4:59 or under",
                       chargedTo: "neither team" },  // a team-called TO does NOT replace it
    overtimePerTeam: { thirtySecond: 1 },    // per OT period; advance rules apply
    advanceRule: "≤2:00 of Q4 or OT: after a 30s timeout, ball may be advanced to frontcourt (28-ft)",
  },

  overtime: {
    minutes: 3,
    startsWith: "jump ball, center circle (A/P arrow applies after the tip)",
    teamFoulPenaltyAt: 2,                    // FRESH count — penalty FTs on the 2nd team foul in OT
    lastTwoMinuteRulesFrom: "2:00 mark",     // the whole back 2/3 of OT runs under last-2:00 rules
    doubleOT: "SUDDEN DEATH — first team to score wins (shot clock still in use)",
  },

  standings: {                                // 7-point system — recorded in the scorebook
    gameWin: 3, quarterWin: 1, quarterTie: 0.5,
  },
};
```

### Known traps (updated against the actual rulebook)
1. **DQ at 6, not 5** — the v1-inheritance bug described above. NBA-trained agents will also reach for 6 but for the wrong reason; NCAA-trained assumptions reach for 5. Only the config wins.
2. **Dual bonus trigger** — 5th team foul of the quarter *or* 2nd team foul inside the last 2:00. The second trigger requires a `LAST_TWO_START` marker event (no game clock in the app), and it applies in **every** quarter, not just the 4th.
3. **Offensive fouls** — personal foul for the player, excluded from team fouls, never FTs even in the bonus. Now explicit in the rulebook; no longer a verify item.
4. **OT is NOT a Q4 extension** — unlike NCAA women's, WPBA overtime runs a *fresh* team-foul count with penalty on the **2nd** team foul, starts with a jump ball, and gives each team one new 30s timeout. Double OT is sudden death. An agent that generalizes "OT continues Q4" from NCAA training data fails here.
5. **Technicals** — 1 FT by any player in the game, resume at POI side-out; 2nd tech = ejection + next-game suspension. `[LEAGUE CLARIFICATION]` The rulebook doesn't state whether a technical adds to the team-foul (bonus) count or the player's 6 — ask the league; default the config to `false`/`false` and isolate it so a one-line change fixes it.
6. **The 1-FT special foul family** — transition take foul, away-from-the-play foul, flopping tech, and defensive 3-seconds all resolve as "one FT by an eligible player + possession/POI" with per-type eligibility quirks. MVP recommendation: one generic `FOUL {foulType: special, specialKind: ...}` payload with a shared 1-FT wizard branch, rather than four bespoke flows.
7. **Disqualified-player free throws** — when a player fouls out mid-FT-sequence, her coach chooses the substitute shooter and **that sub must remain in the game**. This couples the FT wizard to the substitution system — flag it in the Phase 3 spec.
8. **Substitution legality** — WPBA sub rules are elaborate (box location, unlimited on fouls, restrictions in last 2:00). Recommend: *record* subs, don't *enforce* legality — you're practicing scoring, not officiating.

**Process rule:** every one of these gets a written test case (see §7 and `scorebook-v2-test-scenarios.md`) *before* the AI implements the reducer. This is the basketball equivalent of the instructor catching bad baserunning logic.

---

## 5. Tech Stack & Real-Time Layer

| Layer | Choice | Rationale |
|---|---|---|
| UI | React (Vite project, multi-file this time) | v1's single-file was portable but is now cramped; event log architecture wants `reducers/`, `components/`, `rules/` separation |
| Styling | Tailwind | Matches v1 patterns, fast for tap-friendly big buttons |
| State | Event log in a single object; React context + `useReducer` locally | The log *is* the state |
| Real-time (Phase 6) | One Firestore document per game (or Supabase Realtime) | Mirrors the code-along: no hand-wired websockets — writer appends, all readers re-derive. Phone = input device, laptop/TV = display |
| Rosters | `wpba_2026_rosters_master.csv` parsed at setup (papaparse) | 8 WPBA teams, colors + logos + jerseys included — setup screen becomes a team *picker*, not a data-entry form |
| Persistence (pre-sync) | Export/import JSON; the game doc is self-contained | Local-first; sync is additive, not foundational |

**Input flexibility principle (from the code-along):** the tap UI is just one *writer*. Keep an `appendEvent(event)` function as the single write path so a future automated feed, keyboard shortcuts, or even a replay-from-JSON importer are all just alternate writers. Downstream screens never know the difference.

> 📺 **REFERENCE CHECKPOINT #3 — Input UX flow.** This is the highest-value reference. Watch a Genius Sports LiveStats operator tutorial (or SportsVisio's scoring flow) specifically for: (a) tap sequence for a made shot — player-first or action-first? (b) how fouls prompt follow-up questions (shooting foul? → how many FTs?), and (c) how they handle rapid-fire sequences (made 3 + timeout + sub). v1 was action-buttons-per-player-row; pro tools often use **action-first, then player** which is faster under live pressure. Decide before Phase 3.

---

## 6. Build Phases

Each phase ends with a working app. Vibe-coding cadence: write the phase spec → let the agent build → run the verification checklist → commit.

### Phase 0 — Scaffold & roster ingestion (½ session)
- Vite + React + Tailwind project structure: `/src/rules`, `/src/reducers`, `/src/components`, `/src/writers`
- Parse the WPBA CSV; setup screen = pick home/away from 8 teams, starters pre-selected (choose 5 from roster), team colors applied to UI
- ✅ Verify: both rosters render with correct numbers, positions, colors

### Phase 1 — Event log core (1 session)
- Event envelope, `appendEvent`, seq numbering, the full taxonomy from §2
- `scoreReducer` + `logReducer` only
- Dev-only "event inspector" panel showing the raw log (keep this forever — it's your debugger)
- ✅ Verify: hand-append 10 events in the inspector, score and log both correct

### Phase 2 — Rules profile + foul machinery (1 session)
- `WPBA` config object (§4); `teamFoulsReducer`, `playerStatsReducer` with foul dots and DQ
- **Write the §4 trap test cases first**, then implement
- ✅ Verify: all trap tests pass; 5th team foul flips BONUS; 2nd team foul after `LAST_TWO_START` also flips it; fouls reset at quarter boundaries but OT runs its own fresh 2-foul penalty count; player DQs at **6**

### Phase 3 — Input UI (1–2 sessions)
- Tap-friendly scoring surface (decision from Reference Checkpoint #3)
- Foul flow with follow-up prompts (foul type → shooting? → FT sequence)
- Substitution UI driven by `onCourtReducer`
- ✅ Verify: score a full simulated quarter without touching the inspector

### Phase 4 — Undo, corrections & history (½ session)
- Pop-based undo/redo; history modal = event list with tap-to-undo-to-here
- `CORRECTION` events for official-scorer-style voids (distinct from undo — undo is "I fat-fingered," correction is "the ref changed the call two minutes later")
- ✅ Verify: undo 15 deep and redo; state always matches recomputation

### Phase 5 — Derived views (1 session)
- Running score squares, timeouts panel, period-by-period summary strip, box score print view, JSON export/import
- ✅ Verify: export a game, wipe, import, everything identical (this round-trip test also proves the log is the complete source of truth)

### Phase 6 — Real-time second screen (1 session, stretch)
- Firestore doc; input device appends, display device subscribes + re-derives
- Spectator scoreboard component (big score, period, team fouls, bonus)
- ✅ Verify: phone taps a 3-pointer, laptop scoreboard updates within ~1s

### Phase 7 — Polish (ongoing)
- Keyboard shortcuts (just another writer), sounds/haptics, dark mode for gym lighting

---

## 7. Verification Playbook (your job, not the AI's)

Full detail lives in `scorebook-v2-test-scenarios.md` (exact event sequences + expected reducer outputs, written before any code). Seed set, updated to WPBA:

1. **Bonus trip:** 4 team fouls in Q1 → no bonus; 5th → BONUS on, 2 FTs prompted; no one-and-one anywhere.
2. **Last-2:00 trigger:** after `LAST_TWO_START`, the 2nd team foul of the quarter triggers the penalty even with a low foul count — in *any* quarter.
3. **Quarter reset:** BONUS on at end of Q1 → Q2 starts, team fouls 0, BONUS off; player fouls persist.
4. **And-one:** made 2 + shooting foul → score +2, ONE FT prompt, team foul +1.
5. **DQ:** player's **6th** foul → row disabled, sub prompt (sub shoots pending FTs and must remain in game), foul still counts toward team total.
6. **Offensive foul in the bonus:** player foul +1, team fouls unchanged, no FTs.
7. **OT:** fresh team-foul count, penalty on the 2nd OT team foul, jump-ball start, one 30s TO per team; 2OT sudden death ends the game on first score.
8. **Deep undo:** 12 events, undo 6, redo 3 → every reducer matches a fresh replay.
9. **Round-trip:** export mid-game → import → identical UI in every panel.
10. **Quarter points:** final score + period splits → correct 7-point-system standings output (3/1/0.5).

Run the full set at the end of every phase — reducers make regressions silent, so replay tests are your safety net.

---

## 8. Reference-App Checklist (consolidated)

| # | What to observe | Source | Feeds into |
|---|---|---|---|
| 1 | Event granularity — what actions do pros capture? | Genius Sports LiveStats (free FIBA download), SportsVisio demos | §2 taxonomy, MVP scope line |
| 2 | Box score & running score presentation | Genius-powered NCAA stats pages; paper scorebook photos | Phase 5 layouts |
| 3 | Input flow: action-first vs player-first, foul follow-up prompts | LiveStats operator training videos (YouTube) | Phase 3 UX decision |
| 4 | Spectator/scoreboard screen composition | Any LiveStats companion display; SportsVisio live view | Phase 6 |
| 5 | How pros handle corrections after the fact | LiveStats "edit action" workflow | Phase 4 CORRECTION design |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| AI writes NBA/men's rules confidently | Rules profile object + trap tests written before implementation (§4, §7) |
| Scope creep toward full stat-tracking (rebounds, assists, misses) | MVP scope = v1 parity + the five deferred features; taxonomy designed for later expansion |
| Multi-file structure loses v1's portability | JSON export makes any game self-contained; the app itself can still build to a single static bundle |
| Real-time layer complexity | It's Phase 6 and strictly additive — everything works local-first without it |
