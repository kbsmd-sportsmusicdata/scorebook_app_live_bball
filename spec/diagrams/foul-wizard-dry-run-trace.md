# Foul Wizard — Paper Dry-Run Trace

**Purpose:** trace one deliberately chaotic possession through `foul-wizard-flowchart.mermaid` by hand, branch by branch, before any of it becomes UI. The goal is to catch ordering problems, missing states, and unstated assumptions — the same value a road test gets from driving the route once before publishing the directions, rather than trusting the map alone.

**Scripted possession:** Q4, last two minutes already armed (`LAST_TWO_START` tapped). Home leads by 3. Home's H32 drives, is fouled shooting, makes the basket (and-one), then misses the free throw. In the ensuing scramble, away's A14 flops — the tech is assessed at the next neutral opportunity, by which point a substitution has already happened. Away's coach, rattled, calls a timeout her team doesn't have left.

---

## Step-by-step trace

### 1. And-one
`FOUL tapped → B (select committing player: A5) → C: Personal → P1: Shooting foul? YES → P5: Shot made? YES (and-one) → P6: 1 FT, H32 shoots → FT`

FT sequence: `FT_MISSED H32 {attemptOf: {1,1}, context: andOne}`

`→ D1: Any player at 6 fouls? A5 is at 3. NO → Z: close undo-group.`

**Trace result: clean.** Branch order matches Scenario 4 exactly. Undo-group = `{FOUL, FT_MISSED}`, two events, one undo.

### 2. The flop — where the trace finds its first real problem

Between the missed FT and the whistle for the flop, a stoppage happens and **home subs H32 out for H8** (fatigue). Then the flop technical on A14 is whistled and *assessed at the next neutral opportunity* — which the rulebook allows to be later than the moment of the violation itself.

`FOUL tapped → B (A14) → C: Special 1-FT family — S8 → SP: Flop (STEM) → SP3: "1 FT — must be a player in the game AT THE TIME OF VIOLATION"`

**Here's the snag.** The flowchart's shooter-eligibility rule for a flop says "at the time of the violation" — but by the time the scorer taps this into the wizard, the log already contains the `SUB_OUT H32 / SUB_IN H8` events that happened *after* the flop occurred but *before* it was whistled. If the wizard asks `onCourtReducer` for "who's on court right now," it will correctly return H8, not H32 — but H32 was the player actually on the floor when the flop happened, and she's the one rulebook-eligible to shoot it.

**This is a real gap, not a corner case.** The append-only log assumes events are recorded in the order they occur. Delayed-assessment fouls (flopping explicitly, and technicals more generally, since the rulebook allows both "at the next neutral opportunity") break that assumption whenever anything else — a sub, a timeout — gets recorded in the gap between the act and the whistle.

**Two ways to fix it, and a recommendation:**
- **(a) Process rule, no code:** train yourself as scorer to resolve any delayed-assessment foul *before* logging intervening subs/timeouts for that same dead ball, preserving log order = event order.
- **(b) Schema fix:** give delayed-assessment foul types an optional `eligibilityBasis: { asOfSeq: n }` payload field, letting the wizard ask `onCourtReducer` "who was on court as of sequence N" rather than "who's on court now."
- **Recommendation: build (b) into the schema now, even though this is genuinely rare.** It's cheap (one optional field, ignored by every ordinary foul), and it removes a real dependency on the scorer's discipline under live-game pressure — exactly the kind of thing that's fine on paper and forgotten at 9pm in a loud gym. Log it as a Phase 2 schema addition, not a Phase 3 UX problem to train around.

*(For this trace, we proceed assuming H32 — correctly, per the rule — shoots the flop technical, even though she's currently on the bench.)*

`SP3 → FT: FT_MADE H32 {attemptOf: {1,1}, context: technical, eligibilityBasis: {asOfSeq: <flop's actual moment>}}`

`→ D1: A14 fouls? Not applicable to shooter — checks A14 (committing player), who is at 2 fouls. NO → Z.`

### 3. The excessive timeout — where the trace finds its second problem

Away's coach calls a timeout. `timeoutsReducer` shows away has already used both 30-second timeouts this half.

**Trace attempt:** `FOUL tapped → B (select committing player...)` — **and this is where the wizard's entry point itself is wrong for this case.**

The flowchart assumes every foul starts with the scorer proactively tapping "FOUL" and picking a type. But an excessive timeout isn't something the scorer decides to log as a foul — **it's a consequence the system already knows about the instant the TIMEOUT request comes in**, because `timeoutsReducer` can see the remaining count is zero before the scorer taps anything foul-related. Routing this through the general foul wizard means re-deriving, by hand, a fact the reducer already has.

**Design fix (Phase 3 spec addition):** the `TIMEOUT` input flow itself should branch: if `timeoutsReducer` reports zero remaining for the requesting team, the UI immediately offers *"No timeouts remaining — record as excessive timeout?"* and, on confirmation, auto-emits the linked pair —
```
TIMEOUT away {toType: excessive}
FOUL    away {foulType: technical, source: excessiveTimeout, linkedSeq: <the TIMEOUT event>}
```
— as one undo-group, then continues into the ordinary 1-FT technical resolution (`T2` in the flowchart) for the FT and possession-flip. **The general foul wizard should never be the entry point for this specific technical**; it should only ever be reached via the timeout flow.

**A second, smaller open question this surfaces:** who is "the committing player" for an excessive-timeout technical — the head coach, or the team generically? The rulebook doesn't say. This isn't a `[LEAGUE CLARIFICATION]` item (it's an implementation convention, not a rule the league needs to answer) — recommend defaulting to attributing it to the head coach for ejection-ladder bookkeeping, since coaches are already valid foul targets per the roster CSV's `personnel_type` field, and note it as a one-line convention in the rules config, easy to revisit.

`→ T4: 2nd technical for this coach? Check her count. → (for this trace: NO) → FT (the 1 FT + loss of possession per T2) → D1 n/a for a coach → Z.`

---

## Findings summary

| # | Finding | Severity | Recommended action |
|---|---|---|---|
| 1 | Delayed-assessment fouls (flop, and technicals generally) can be whistled after intervening SUB/TIMEOUT events, breaking the "log order = event order" assumption `onCourtReducer` relies on for shooter eligibility | **Real — will misassign FT shooters in a live game** | Add optional `eligibilityBasis: {asOfSeq}` to delayed-assessment foul payloads (Phase 2 schema, not Phase 3 training) |
| 2 | The foul wizard's single entry point ("FOUL tapped") is the wrong starting place for the excessive-timeout technical — that fact is already known by `timeoutsReducer` before any foul is tapped | **Real — UX/architecture, not a rules bug** | Branch the `TIMEOUT` input flow itself to auto-offer/emit the linked technical when remaining count is zero (Phase 3 spec addition) |
| 3 | No stated convention for *who* is "the committing player" on an excessive-timeout technical | Minor — implementation convention, not a league question | Default: head coach. One line in rules config. |
| 4 | *(bonus, adjacent finding, not from this trace's scripted path)* The flowchart derives ejection independently in three places (2 technicals / 2 FF1s / 1 FF2) rather than through one shared `isEjected(player)` function — fine today, but a future edit to one branch could silently drift from the others | Minor — code-hygiene note for Phase 2, not a rules gap | Implement ejection as one pure derived check read by all three branches, not three inline conditions |
| 5 | *(bonus, surfaced while checking finding #4)* Do FF1/FF2 flagrant fouls also count toward the player's 6-personal-foul disqualification total, in addition to their own separate 2-FF1/1-FF2 ejection ladder? Rulebook doesn't say explicitly | Open rules question — **candidate for a Scenario 17 / third `[LEAGUE CLARIFICATION]` item** | Not resolved here — flagged for your decision on whether to add to the test file now or park it |

**Overall verdict: the wizard's branch *order* held up.** Nothing in the scripted chaos revealed a wrong sequence of questions — every dead end was about *timing* (finding 1) and *entry point* (finding 2), not about the decision tree itself being shaped wrong. That's a good sign for the underlying design; both fixes are additive, not restructuring.
