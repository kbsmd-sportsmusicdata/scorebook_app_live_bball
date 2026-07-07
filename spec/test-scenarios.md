# Scorebook v2 — Trap Test Cases & Verification Scenarios
**Rules source:** `WPBA_Rules_2026_FINAL.pdf` (official league rulebook, in project files) — **RESOLVED**, replaces the earlier NCAA_W draft
**Status:** Written BEFORE implementation. Hand this file to the AI agent with each phase spec. Any implementation that fails these scenarios is wrong, no matter how confident it sounds.
**Remaining open item:** one `[LEAGUE CLARIFICATION]` in Scenario 7 (everything else is pinned to rulebook text).

---

## What changed vs. the NCAA draft of this file

| Rule | NCAA draft assumed | WPBA actual |
|---|---|---|
| Player disqualification | 5 fouls | **6 fouls** (⚠ v1 hardcodes 5 — inherited-bug trap) |
| Bonus trigger | 5th team foul/quarter only | 5th team foul **OR 2nd team foul in the last 2:00 of any quarter** |
| Overtime team fouls | carryover from Q4 | **fresh count; penalty on the 2nd OT team foul** |
| OT start / length | extension of Q4 | 3:00 period, **jump ball** start, last-2:00 rules from the 2:00 mark |
| Double OT | another OT period | **sudden death — first score wins** |
| Timeouts | unverified | 2×30s per team per half (no carryover); 1 league mandatory 60s per quarter (first dead ball ≤4:59, charged to neither team); 1×30s per team per OT; excessive TO = technical + loss of possession |
| Offensive foul → team fouls | assumed no, unverified | **confirmed NO** (rulebook: "personal fouls but are not added to the team foul total") |
| Technical penalty | unverified | **1 FT by any player in the game; resume at POI, direct side-out; 2 techs = ejection + next-game suspension** |

---

## Conventions

- Events: `#seq TYPE team player {payload}` — `H32` = home #32, `A5` = away #5
- Every scenario lists **expected reducer outputs**; reducers must produce exactly these values from the sequence
- "Fresh replay" = run every reducer against the full event list from scratch; never compare against cached state
- Foul wizards emit **undo-groups**: one undo removes the foul and all its FT events together (per LiveStats research)

---

## SCENARIO 1 — Standard bonus trip (5th team foul)

**Why:** Agents will confidently write NBA penalty rules or NCAA one-and-one logic. WPBA: two FTs on the team's 5th foul of the quarter. No one-and-one exists in this league.

```
#1  PERIOD_START         {period: 1}
#2  FOUL   away  A22     {foulType: personal, shooting: false}
#3  FOUL   away  A5      {foulType: personal, shooting: false}
#4  FOUL   away  A22     {foulType: personal, shooting: false}
#5  FOUL   away  A14     {foulType: personal, shooting: false}
```

**Expected after #5:** away team fouls (Q1): **4**; bonus: **false**; no FTs prompted for #2–#5.

```
#6  FOUL   away  A5      {foulType: personal, shooting: false}
#7  FT_MADE   home H10   {attemptOf: {n:1, of:2}, context: bonus}
#8  FT_MISSED home H10   {attemptOf: {n:2, of:2}, context: bonus}
```

**Expected after #8:**
| Reducer | Output |
|---|---|
| `teamFoulsReducer` | away: 5; **home IN THE BONUS** |
| `scoreReducer` | home 1 – away 0 |
| `playerStatsReducer` | H10: PTS 1, FTM 1, FTA 2 |
| Undo-group | one undo from here removes #6–#8 together |
| ❌ WRONG | one-and-one flow; bonus at 4; 1 FT awarded; "front end/back end" language anywhere |

---

## SCENARIO 2 — Last-2:00 penalty trigger (the WPBA-specific trap)

**Why:** Unique dual trigger: inside the last two minutes of **any** quarter, the penalty arrives on the team's **2nd** foul of that quarter even if they've committed far fewer than 5. The rulebook's tell: on the 1st team foul inside 2:00, refs direct the scoreboard to display "4" under team fouls. Our `LAST_TWO_START` event is the digital twin of that moment — the scorer taps it when the clock hits 2:00 (the app has no game clock).

```
#1  PERIOD_START     {period: 3}
#2  FOUL  away A22   {foulType: personal, shooting: false}      // away team foul 1
#3  LAST_TWO_START   {period: 3}                                 // clock hits 2:00
#4  FOUL  away A5    {foulType: personal, shooting: false}      // away team foul 2
```

**Expected after #4:**
| Reducer | Output |
|---|---|
| `teamFoulsReducer` | away team fouls: 2 — but **home is IN THE BONUS**; foul #4 prompts **2 FTs** |
| Display rule | after #3, on the next away foul the team-foul display may show the rulebook's "4" convention — design decision: show real count + BONUS badge, or mimic the scoreboard "4"; either way the *reducer* must know the true count |
| ❌ WRONG | trigger only in Q4 (it's every quarter); trigger at 2 fouls without `LAST_TWO_START`; forgetting that foul #2 (before the marker) still counts toward the 2 |

**Boundary case:** if a team already has 5+ fouls when `LAST_TWO_START` fires, nothing changes — they were already in the penalty. Both triggers are OR'd.

---

## SCENARIO 3 — Quarter reset

```
Setup: end of Scenario 1 (away: 5 team fouls, home in bonus, Q1)
#9   PERIOD_END    {period: 1}
#10  PERIOD_START  {period: 2}
#11  FOUL  away A22 {foulType: personal, shooting: false}
```

**Expected after #11:** away team fouls (Q2): **1**; bonus: **off**; A22 *personal* fouls: **3** (player fouls never reset); the `LAST_TWO_START` armed state from any prior quarter is also cleared.
**❌ WRONG:** resetting player fouls; carrying team fouls across quarters; resetting only at halftime.

---

## SCENARIO 4 — And-one

**Why:** Made basket + shooting foul = basket counts + **ONE** FT, regardless of bonus. (LiveStats has a dedicated And-1 workflow — known operator pain point.)

```
#1  PERIOD_START        {period: 1}
#2  SHOT_MADE home H32  {points: 2}
#3  FOUL      away A5   {foulType: personal, shooting: true, andOne: true, fouledPlayer: H32}
#4  FT_MADE   home H32  {attemptOf: {n:1, of:1}, context: andOne}
```

**Expected:** home 3 – away 0; H32: PTS 3, FTM 1/FTA 1; A5 fouls 1; away team fouls 1; exactly **1** FT prompted.
**❌ WRONG:** 2 FTs; voiding the basket; stacking bonus FTs.

**Contrast — missed 3-pt attempt, shooting foul:** wizard prompts **3 FTs** (`shotValue: 3, made: false`). Home scores per makes; FTA 3.

---

## SCENARIO 5 — Sixth-foul disqualification (+ the DQ free-throw rule)

**Why:** Two traps stacked. (a) **WPBA DQ is at 6 fouls** — v1 hardcodes 5, NCAA habits say 5; an agent copying v1 inherits the bug. (b) Rulebook: when a disqualified player owed free throws leaves, **her coach chooses the substitute to attempt them, and that sub must remain in the game.**

```
Setup: Q4. A14 has 5 personal fouls from earlier events. Away has 3 team fouls in Q4.
#80  FOUL  away A14  {foulType: personal, shooting: true, shotValue: 2, made: false, fouledPlayer: H10}
```

**Expected after #80:**
| Reducer | Output |
|---|---|
| `playerStatsReducer` | A14: fouls **6**, `dq: true`; foul-dot row shows 6 |
| `teamFoulsReducer` | away team fouls: 4 — the DQ foul still counts |
| Input UI | H10 shoots the 2 FTs (shooting foul → fouled player shoots); A14's action buttons disabled except `SUB_OUT`; sub prompt appears |
| ❌ WRONG | DQ at 5; DQ foul excluded from team count; auto-removing A14 with no SUB event in the log |

**DQ-shooter variant:** if the *disqualified* player was the one owed FTs (e.g., fouled, then T'd up and DQ'd before shooting — rare but real), the wizard must route: coach-chosen sub shoots, and the log must show `SUB_IN` **before** the FT events, with a `mustRemain: true` note the UI respects.

---

## SCENARIO 6 — Offensive foul in the bonus ✅ RESOLVED

**Why:** Rulebook is explicit: "Offensive fouls are personal fouls but are not added to the team foul total." And they never award FTs — even when the opponent is deep in the penalty. This is the single most common agent error in foul logic.

```
Setup: Q4, home has 6 team fouls (away in the bonus).
#77  FOUL  home H10  {foulType: offensive}
```

**Expected:** H10 personal fouls +1; home team fouls **unchanged at 6**; **no FT prompt**; possession flips to away (side-out).
**❌ WRONG:** awarding 2 bonus FTs; incrementing team fouls.

---

## SCENARIO 7 — Technical foul (and the ejection ladder)

**Why:** WPBA technical penalty is unusual: **one FT, shot by any player in the game at the time of the foul, then play resumes at the POI as a direct side-out** — the shooting team does NOT then get possession the way agents often assume from other rulebooks.

```
Setup: Q2. A5 has 1 prior technical (from Q1 events).
#45  FOUL     away A5   {foulType: technical}
#46  FT_MADE  home H22  {attemptOf: {n:1, of:1}, context: technical}   // any home player in the game
```

**Expected after #46:**
| Reducer | Output |
|---|---|
| `scoreReducer` | home +1 |
| `playerStatsReducer` | A5: technicals **2** → `ejected: true` (2 techs = ejection); flag `nextGameSuspension: true` in export |
| Input wizard | FT shooter picker limited to home players currently on court per `onCourtReducer` |
| Possession | resumes at POI side-out to the team that had it — NOT automatic possession to the shooting team |
| `[LEAGUE CLARIFICATION]` | does a technical add to the away *team-foul* (bonus) count, or A5's count toward 6? Rulebook is silent. Config defaults: `techCountsTowardTeamFouls: false`, `techCountsTowardPlayerSix: false` — isolated to one line each so a league answer is a one-line fix |
| ❌ WRONG | 2 FTs; forcing the fouled team to also receive possession; letting a bench player shoot |

**Ejection ladder (encode as data, test each):** 2 technicals → ejection; 2 FF1s → ejection; 1 FF2 → immediate ejection. Each also triggers next-game suspension. Excessive timeout = technical **+ loss of possession** (the one technical that DOES change possession — nasty exception, test it separately).

---

## SCENARIO 8 — The 1-FT special foul family (shared wizard branch)

**Why:** Transition take foul, away-from-the-play foul, flopping technical, and defensive 3-seconds all resolve the same shape: **one FT by an eligible player + ball at POI**, differing only in shooter eligibility and shot-clock treatment. Test the shared branch once, then eligibility per type:

| Type | Shooter | Ball after | Notes |
|---|---|---|---|
| Transition take foul | **any player in the game**, fouled team | retained, side-out at POI | does NOT apply in last 2:00 of Q4/OT or in 2OT |
| Away-from-the-play | any player in the game | POI | on throw-ins: any pre-release foul qualifies, entire game |
| Flopping (STEM) | a player **who was in the game at the time of the violation** | POI | assessed at next neutral opportunity |
| Defensive 3-seconds | any player in the game | possession to offended team at FTLE | shot clock: same or 14, whichever greater |

**Test:** for each, wizard prompts exactly 1 FT, correct shooter pool, correct possession outcome. **❌ WRONG:** any of these routed through the 2-FT bonus flow.

---

## SCENARIO 9 — Overtime: fresh count, fast penalty ✅ RESOLVED (and it's not what NCAA habits predict)

**Why:** WPBA OT is NOT an extension of Q4. It's a 3:00 period starting with a **jump ball**, a **fresh team-foul count with penalty FTs on the 2nd team foul**, one new 30s timeout per team (no carryover), and last-2:00 rules from the 2:00 mark — i.e., only the first minute of OT runs "normal."

```
Setup: end of Q4, tied 60–60. Away had 7 team fouls in Q4.
#101  PERIOD_END    {period: 4}
#102  PERIOD_START  {period: 5}         // OT — jump ball; A/P applies after tip
#103  FOUL  away A22 {foulType: personal, shooting: false}
```

**Expected after #103:** away team fouls (OT): **1** — no penalty yet (fresh count, Q4's 7 gone).

```
#104  FOUL  away A5  {foulType: personal, shooting: false}
```

**Expected after #104:** away team fouls (OT): **2** → **home in the penalty, 2 FTs prompted.**

| Also assert | |
|---|---|
| `timeoutsReducer` | each team: exactly 1×30s available in OT regardless of what remained from the 2nd half |
| `scoreReducer` | period splits gain an "OT" column; running total continuous |
| Period behavior | at OT's 2:00 mark, `LAST_TWO_START {period: 5}` arms last-2:00 rules — but note the OT 2-foul penalty threshold is already ≤ the last-2:00 threshold, so it changes timeout/advance/TTF behavior, not the bonus |
| ❌ WRONG | carrying Q4 team fouls into OT (the NCAA-trained answer); penalty at 5 in OT; granting leftover 2nd-half timeouts |

**Trap-pair note:** Scenarios 3 and 9 together force the correct generalization — "team fouls reset every period, and each period type carries its own penalty threshold from config (regulation: 5, OT: 2)." An agent that hardcodes either fails the other.

---

## SCENARIO 10 — Double overtime: sudden death

**Why:** Nothing in any mainstream rulebook prepares an agent for this: **2OT is first-team-to-score, shot clock in use.** The first scoring event ends the game.

```
Setup: OT ends tied 66–66.
#130  PERIOD_END    {period: 5}
#131  PERIOD_START  {period: 6}         // 2OT — sudden death
#132  SHOT_MADE away A22 {points: 2}
```

**Expected after #132:** score home 66 – away 68; **`GAME_END` auto-appended (or prompted) — the game is over**; all input disabled except undo/correction; `quarterPointsReducer` finalizes.
**Edge to test:** a made FT also wins (any score counts); an offensive foul does not.
**❌ WRONG:** playing out a timed 2OT period; requiring a 2-point margin.

---

## SCENARIO 11 — Timeouts ✅ RESOLVED (numbers pinned)

**Why:** All allotments now come from the rulebook; the reducer must read every number from the `WPBA` config (grep the reducer source: any timeout literal outside `rules/` = fail).

```
#20  TIMEOUT  home  {toType: thirty}                 // Q1, 7:12 game time
#21  TIMEOUT  league {toType: mandatory}             // first dead ball under 4:59, Q1
#22  TIMEOUT  home  {toType: thirty}                 // Q2
#23  TIMEOUT  home  {toType: thirty}                 // Q2 — home's 3rd of the half
```

**Expected:**
| After | Output |
|---|---|
| #20 | home 30s TOs remaining (1st half): 1 |
| #21 | charged to **neither team**; log entry "League mandatory timeout (60s)"; does NOT decrement either team; a team TO does not substitute for it |
| #22 | home remaining: 0 |
| #23 | **excessive timeout** → wizard converts to: `FOUL {foulType: technical, reason: excessiveTimeout}` + 1 FT to away + **loss of possession** (the exceptional tech) |
| Halftime | both teams reset to 2×30s for the 2nd half; unused 1st-half TOs vanish |
| ≤2:00 Q4/OT after a 30s TO | log offers the **advance** annotation (ball to frontcourt 28-ft) — record-keeping only, no state math |

---

## SCENARIO 12 — Quarter points (7-point standings system) — NEW

**Why:** The rulebook makes quarter points an explicit **scorebook duty**: quarter points are kept separately and recorded in the scorebook for standings. Awards: 3 standings points for the game win, 1 per quarter won, 0.5 each for tied quarters — teams are effectively playing four mini-games plus the game itself.

```
Scripted game, per-period scores derived from SHOT/FT events:
Q1: home 18–12   Q2: home 10–15   Q3: home 14–14   Q4: home 20–17
Final: home 62–58
```

**Expected `quarterPointsReducer` output:**
| Team | Game win | Q1 | Q2 | Q3 | Q4 | **Standings points** |
|---|---|---|---|---|---|---|
| Home | 3 | 1 | 0 | 0.5 | 1 | **5.5** |
| Away | 0 | 0 | 1 | 0.5 | 0 | **1.5** |

**Sanity property:** the two totals always sum to exactly **7**. Test with an OT game too — `[LEAGUE CLARIFICATION]` whether OT scoring folds into Q4's quarter point or the game win only; default: OT affects the game-win 3 points only, Q4's quarter point is judged at the end of regulation.
**❌ WRONG:** standings from W/L alone; whole points for ties; totals ≠ 7.

---

## SCENARIO 16 — Re-entry under penalty (surfaced by the player-lifecycle diagram)

**Why:** Diagramming the player foul lifecycle exposed a gap the scenario list hadn't caught. Rulebook substitution rules: if a team drops below 5 eligible players because everyone available has fouled out, the team may use the **last player who fouled out (not ejected)** to keep playing — but **every foul she commits from that point forward becomes a technical foul plus the penalty for the underlying foul type**, and **re-entering itself is a technical foul** the moment she steps back on court. This is a compounding-penalty state, not a single event, and it's exactly the kind of rule an agent will implement once and then forget applies to *every subsequent foul* for that player, not just her first one back.

### Setup
Q4. Home has only 5 eligible players left; H22 fouled out earlier (not ejected) and is the most recently disqualified. A 6th home player becomes unavailable (injury, hypothetically already out) such that home would drop below 5 on court without her.

### Event sequence
```
#90  SUB_IN   home  H22   {reason: "re-entry — team below 5 eligible", ruleException: true}
```

### Expected after #90
| Reducer | Output |
|---|---|
| `playerStatsReducer` | H22 immediately charged **1 technical foul** for the act of re-entering (not for any subsequent play) |
| `onCourtReducer` | H22 now on court, flagged `reentryUnderPenalty: true` — this flag persists for the rest of the game, it does not clear |
| Input UI | H22's foul button routes to a **different** wizard branch than every other player's for the rest of the game (see below) |

### Continue — she commits a routine personal foul later in the quarter
```
#95  FOUL  home  H22   {foulType: personal, shooting: false}
```

### Expected after #95
| Reducer | Output |
|---|---|
| `playerStatsReducer` | H22 gets **a technical foul PLUS** whatever the base personal-foul penalty would have been (here: no FTs, since a plain non-bonus personal foul has none — but the technical itself still awards 1 FT per the standard technical rule) |
| Net effect | this single tap emits a `FOUL {foulType: personal}` event **and** a `FOUL {foulType: technical, source: reentryPenalty, linkedSeq: 95}` event, as one undo-group |
| Ejection ladder | this technical counts toward H22's 2-technical ejection threshold exactly like any other technical (from Scenario 7) — she can still foul/tech herself out of the game a second time, at which point there's no one left to re-insert |
| ❌ WRONG | treating the re-entry penalty as a one-time thing that only applies to the re-entry event itself; letting H22's later fouls resolve as ordinary fouls; forgetting the compounding technical also feeds the same ejection ladder as any other technical |

### Continue — she commits what would normally be a shooting foul
```
#110  FOUL  home  H22   {foulType: personal, shooting: true, shotValue: 2, made: false, fouledPlayer: A9}
```

### Expected after #110
| Reducer | Output |
|---|---|
| Net effect | fouled player (A9) still shoots the 2 FTs for the underlying shooting foul, **AND** an eligible player from away shoots 1 additional FT for the compounding technical — two separate FT sequences, not merged into one |
| `playerStatsReducer` | H22: personal fouls +1, technicals +1 |

**Design implication for Phase 3:** the foul wizard (main flowchart) needs a pre-check — *"is the committing player flagged `reentryUnderPenalty`?"* — that, if true, always appends a linked technical-foul event after whatever the base foul resolves to, regardless of which branch of the main wizard was taken. This is cleaner as a wrapper around the wizard's output than as a fifth branch inside it, since it applies uniformly across offensive/personal/flagrant fouls alike.

---

## SCENARIO 13 — Deep undo / redo integrity *(unchanged)*

1. Script 12 mixed events (shots, foul+FT groups, a sub, a timeout).
2. Undo 6 (foul+FT groups count as ONE undo step). Redo 3.
3. Assert: every reducer over the current log `===` fresh replay; `seq` gapless and monotonic; a new append after redo clears the redo buffer.

---

## SCENARIO 14 — Export → wipe → import round-trip *(unchanged, +1 assertion)*

Play a scripted half covering every taxonomy type at least once (now including `LAST_TWO_START` and a league mandatory timeout). Export → assert **no derived fields** in the JSON (scores/totals present = someone cached state). Hard reload → import → every panel identical, **including the quarter-points panel**.

---

## SCENARIO 15 — Correction vs. undo *(unchanged)*

Undo = fat-finger, event never existed. `CORRECTION {voidsSeq}` = official change after the fact; voided event stays in the log rendered struck-through with the reason (the official scorer never erases; LiveStats does the same by re-issuing action numbers). Reducers must treat voided events as absent without mutating the array.

---

## Pre-implementation checklist (updated)

- [x] ~~Technical foul consequences~~ → 1 FT, any player in game, POI side-out; ejection ladder encoded (Scenario 7)
- [x] ~~Offensive foul team-foul treatment~~ → excluded from team fouls, never FTs (Scenario 6)
- [x] ~~OT carryover~~ → no carryover; fresh count, penalty on 2nd OT team foul; 2OT sudden death (Scenarios 9–10)
- [x] ~~Timeout allotments~~ → 2×30s/half, 1 mandatory 60s/quarter, 1×30s/OT, excessive = tech + possession (Scenario 11)
- [ ] `[LEAGUE CLARIFICATION]` Do technicals count toward the team-foul (bonus) count and/or the player's 6? (Scenario 7 — config defaults `false`, one-line fix)
- [ ] `[LEAGUE CLARIFICATION]` Quarter-point treatment when a game reaches OT (Scenario 12 — default: game-win points only)
- [ ] Convert each scenario to an executable Vitest fixture using the event arrays above
- [ ] Phase 3 wizard spec must implement Scenario 16's `reentryUnderPenalty` wrapper as a check that runs AFTER any foul-wizard branch resolves, not as a branch inside it
- [ ] Rule for the agent, in every phase prompt: *"If a test expectation seems wrong to you, STOP and flag it — do not silently change the test to match your implementation."*

**Process note:** Scenario 16 exists because sketching the player-lifecycle state diagram surfaced a rulebook edge case the original 15 scenarios missed entirely. This is the diagramming step doing its job — treat any future diagram (state or flow) as a second QA pass over the rulebook, not just a communication artifact.
