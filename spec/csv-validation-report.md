# Roster CSV Validation — Pre-Phase-0 Check

**File checked:** `wpba_2026_rosters_master.csv`
**Result:** ✅ Clean overall, ⚠️ one real fix needed before Phase 0

## Summary

| Check | Result |
|---|---|
| Team count | ✅ 8 teams, matches WPBA roster |
| Team colors | ✅ all valid 6-char hex, no `#` prefix (confirm Phase 0 code adds `#` when applying to CSS) |
| Team logos | ✅ present for all 8 teams |
| Head coaches | ✅ exactly 1 per team |
| Assistant coaches | ✅ 1 per team (Oakland Swish has 3 — not an error, just deeper staff) |
| Duplicate jersey numbers within a team | ✅ none (initial alarm was 20 coach rows with blank jersey numbers, which is correct — coaches don't have jersey numbers) |
| Duplicate player names within a team | ✅ none |
| Jersey number range | ✅ all numeric values in valid range where present |
| Positions used | `C`, `F`, `F/G`, `G`, `P`, `Head Coach`, `Assistant Coach` — note the `P` (likely a data-entry variant; confirm meaning before building position filters) |
| Roster depth | ✅ every team has 8+ players (min: Alameda Wolves, 8; max: Hayward Reign, 12) |

## ⚠️ One real issue — fix before Phase 0

**Two players are missing jersey numbers:**

| Team | Player | Position |
|---|---|---|
| Oakland Swish | Rokia Doumbia | G |
| Oakland Swish | Tamia Ugass | F |

This matters specifically because the project plan's player identity scheme is `teamId-jersey` (e.g. `675231-22`) — these two players currently have no valid composite ID, which means:
- They can't be selected as starters or subs without a placeholder ID scheme
- Any event referencing them (`FOUL`, `SHOT_MADE`, etc.) has no stable `playerId` to key off

**Recommended fix (pick one, then patch the CSV before Phase 0):**
1. Look up their actual jersey numbers from the WPBA roster source and fill them in (cleanest)
2. If numbers are genuinely unassigned/TBD, assign a temporary placeholder (e.g. `00`, `TBD1`/`TBD2`) and flag in a comment column — but this risks colliding with a real player wearing `00`
3. Have Phase 0's CSV parser fall back to `full_name` as the ID key for any row with a blank jersey number — most robust, handles this case and any future roster gaps without a CSV re-edit

**My recommendation: option 3.** It's a two-line defensive check in the parser (`const playerId = jersey ? `${teamId}-${jersey}` : `${teamId}-${slugify(fullName)}`;`) and it means a blank jersey number never blocks Phase 0, now or for any future roster update.

## Non-issues worth a passing note (no action needed)

- The `P` position code appears once or twice — likely "Player" as a generic/utility tag rather than a basketball position (C/F/G). Won't block Phase 0; just don't assume `P` maps cleanly to a court position in any position-based UI logic later.
- Oakland Swish's 3 assistant coaches vs. everyone else's 1 is real roster variation, not a data error — no action needed, just don't hardcode "1 assistant coach per team" anywhere.
