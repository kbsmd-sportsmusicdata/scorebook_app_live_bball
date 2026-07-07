# v1 vs v2 — Architecture Comparison & Learning Notes

**Purpose:** a side-by-side record of how the same feature was built two different ways — v1's state-based approach vs. v2's event-log-derived approach — kept as you go, not written after the fact. The value is in catching the *moment* a feature clicks into the new architecture, while it's fresh.

**How to use this during Claude Code sessions:** when a reducer lands and passes its test scenarios, hand Claude Code this file plus the prompt below, and let it fill in its own "v2 approach" section directly — it has the actual code in context; you don't have to transcribe it by hand.

> *Prompt to reuse each time a feature reducer is complete:*
> "Open `docs/v1-vs-v2-comparison.md`. Find the `[FEATURE]` section. Fill in the 'v2 approach' subsection with the actual reducer code just written, the 'What changed architecturally' bullets, and note any 'confidently wrong' moment this reducer's tests caught. Don't touch the v1 section or any other feature's section."

---

## FEATURE 1 — Team Fouls & BONUS Tracking ✅ WORKED EXAMPLE (v1 side complete)

### v1 approach: state-based, stored, and animated on every render

v1 kept `fouls` as a plain number in each team's component state and compared it against a hardcoded constant directly inside the JSX:

```jsx
{/* Fouls + bonus */}
<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
  <span style={{fontSize:11,color:"#94a3b8"}}>Fouls: {fouls}</span>
  {fouls>=BONUS_AT&&(
    <span style={{fontSize:10,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,0.15)",
      padding:"2px 8px",borderRadius:20,animation:"pulse 1.5s infinite",
      border:"1px solid rgba(239,68,68,0.3)"}}>BONUS</span>
  )}
</div>
```

**What this reveals about the state-based approach:**
- `fouls` is a **stored number**, incremented somewhere in a foul-handling function elsewhere in the file (`onAction(side, id, 'foul')` presumably calls a setter). To know "is the team in the bonus," the component re-derives it inline, in the render, via `fouls >= BONUS_AT` — which is *almost* the right instinct (a derived comparison, not a separately stored boolean) but the underlying `fouls` count itself is still a mutated variable, not a replayable fact.
- `BONUS_AT` is a constant somewhere in the file — this is v1's version of a "rules profile," but it's a bare module-level constant, not a structured config object, and it has no place to encode the *second* trigger (2nd team foul in the last 2:00) that WPBA actually requires. Adding that rule to v1 would mean threading a second condition into this same JSX line and hoping every other place `fouls` is checked gets updated too.
- **The v1 bug lives one level up from this snippet:** the per-player foul dot logic auto-disqualifies "amber → red at 5" — a number that, like `BONUS_AT`, exists as a bare constant somewhere else in the file, disconnected from this bonus logic and easy to get out of sync with the real rulebook.
- **Undo, for this feature specifically:** to undo a foul in v1, something has to decrement `fouls` back down and hope the BONUS badge's inline comparison re-evaluates correctly — it does, because the comparison is live, but only because this one piece of state happens to be simple. Fixtures with FT sequences attached to fouls (which WPBA needs constantly) don't decrement as cleanly.

### v2 approach: derived, never stored

*(To be filled in by Claude Code once `teamFoulsReducer` is implemented — see prompt above. Should include: the reducer's actual signature, how it reads `WPBA.bonus.atTeamFouls` and `WPBA.bonus.lastTwoMinutes.atTeamFouls` from `src/rules/wpba.js` rather than a bare constant, and how the `LAST_TWO_START` event arms the second trigger.)*

**Design target (from `spec/project-plan.md` §3 and `test-scenarios.md` S1/S2):**
```js
// Sketch only — replace with actual implementation
function teamFoulsReducer(events, team, period) {
  const foulsThisPeriod = events.filter(e =>
    e.type === 'FOUL' && e.team === team && e.period === period &&
    e.payload.foulType !== 'offensive' // S6: offensive fouls never count
  ).length;
  const lastTwoArmed = /* was LAST_TWO_START seen this period before this point? */;
  const bonus = foulsThisPeriod >= WPBA.bonus.atTeamFouls ||
                (lastTwoArmed && foulsThisPeriod >= WPBA.bonus.lastTwoMinutes.atTeamFouls);
  return { foulsThisPeriod, bonus };
}
```

### What changed architecturally

| | v1 | v2 |
|---|---|---|
| Where the count lives | `fouls` state variable, mutated by a handler | Computed by filtering `events[]` every read |
| Where the threshold lives | `BONUS_AT` bare constant | `WPBA.bonus.atTeamFouls` in one config object |
| Second bonus trigger (last-2:00) | Would require new state + new comparison, threaded through by hand | One more condition in the same reducer, reading the same config |
| Undo | Trusts the decrement to be correct | Just re-runs the filter over one-shorter `events[]` — cannot be wrong if the filter is right |
| Offensive-foul exclusion (S6) | Whatever the increment handler happened to do — easy to get wrong silently | Explicit filter condition, visible in one place, covered by a named test |

### "Confidently wrong" catches this feature's tests were designed to prevent

- One-and-one bonus logic (agents trained on NBA/NCAA data reach for this) — S1 explicitly asserts 2 FTs, never 1-and-1
- Bonus triggering only on the 5th foul, missing the last-2:00 second trigger entirely — S2
- Team fouls carrying across a quarter boundary, or resetting at OT instead of the fresh-count/2-foul-penalty rule — S3, S9 (this trap pair is discussed in `test-scenarios.md` directly — the two scenarios deliberately pull the generalization in opposite directions)

---

## FEATURE 2 — Player Fouls & Disqualification (skeleton — fill in during Phase 2)

### v1 approach
*(Known from memory + prior chat: foul dots visualized amber→red, auto-DQ at 5 fouls — the confirmed v1 bug. Paste the actual per-player foul-handling code here once located, for the full contrast.)*

### v2 approach
*(Fill in once `playerStatsReducer`'s DQ logic lands — see S5. Should show `WPBA.playerFoulLimit` = 6 read from config, and the DQ-owed-FT coach-substitute coupling to `onCourtReducer`.)*

### What changed architecturally


### "Confidently wrong" catches


---

## FEATURE 3 — Undo / Redo (skeleton — fill in during Phase 4)

### v1 approach
*(One-tap undo for last action + multi-step undo via history modal — confirmed from prior chat. Paste the actual undo-handling code here.)*

### v2 approach
*(Fill in once undo/redo lands. Should show `events.pop()` triviality vs. v1's need to write compensating logic per action type.)*

### What changed architecturally


### "Confidently wrong" catches


---

## FEATURE 4 — Timeout Tracking (skeleton — fill in during Phase 5)

### v1 approach
*(Confirmed from prior chat: 30-second dots, 3 per regulation +1 per OT, full timeout dots hidden in OT per NCAA rules — note this is the OLD NCAA-based v1 logic and will differ substantially from WPBA's actual allotment in `test-scenarios.md` S11.)*

### v2 approach


### What changed architecturally


### "Confidently wrong" catches
*(Likely candidate: v1's timeout structure was built for NCAA women's rules, not WPBA — this feature may show the largest visible rule delta of any comparison in this doc.)*

---

## FEATURE 5 — Running Score / Box Score / Print View (skeleton — fill in during Phase 5)

### v1 approach


### v2 approach


### What changed architecturally


### "Confidently wrong" catches


---

## FEATURE 6 — JSON Export (skeleton — fill in during Phase 5)

### v1 approach
*(If v1 had no export feature, note that explicitly — this may be the cleanest "free feature" example in the whole rebuild, since v2's export is close to just serializing the document.)*

### v2 approach


### What changed architecturally


### "Confidently wrong" catches


---

## FEATURE 7 — Quarter Points / 7-Point Standings (NEW in v2 — no v1 equivalent)

### v1 approach
**N/A — this feature did not exist in v1.** WPBA's 7-point standings system is a league requirement discovered during the rules-resolution phase of v2, not a carryover feature. Worth keeping as its own entry specifically *because* it has no v1 counterpart — it's a clean read on how cheap a brand-new feature is under the event-log architecture versus how expensive it would have been to bolt onto v1's state model after the fact.

### v2 approach
*(Fill in once `quarterPointsReducer` lands — S12. Should show it as a pure function over period scores, which are themselves a pure function over events — the "free feature" argument made concrete.)*

### What changed architecturally


### "Confidently wrong" catches


---

## FEATURE 8 — Game Phase / Overtime Handling (skeleton — fill in during Phase 2/3)

### v1 approach
*(Confirmed from prior chat: had a period navigation with forward/back, quarter-advance confirmation modal, OT columns rendered automatically — but was built against NCAA women's OT rules, not WPBA's fresh-count/jump-ball/sudden-death-2OT structure.)*

### v2 approach
*(Fill in once the game-phase state machine — `spec/diagrams/game-phase-state-diagram.mermaid` — is implemented. This is the one feature in the whole app that's genuinely a persistent state machine rather than a pure derivation; worth noting explicitly why this one is different from every other entry in this doc.)*

### What changed architecturally


### "Confidently wrong" catches
*(Likely candidate: OT-as-Q4-extension is the NCAA-trained assumption; WPBA's fresh-count-penalty-at-2 and sudden-death 2OT are both surprising relative to that training — S9, S10.)*
