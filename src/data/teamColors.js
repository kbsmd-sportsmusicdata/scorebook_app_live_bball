// [DATA GAP] The roster CSV in docs/rosters/ has NO team_color column, even though
// spec/csv-validation-report.md describes one ("all valid 6-char hex, no # prefix").
// The CSV that was validated is evidently not the copy that landed in this repo.
//
// Until a corrected CSV arrives, these placeholders (keyed by team_id, loosely themed
// on each team name) fill the gap. parseRosters() prefers a `team_color` CSV column
// whenever one exists, so dropping in the corrected CSV fixes colors with zero code
// changes. Values here are 6-char hex WITHOUT the # prefix, matching the CSV
// convention the validation report describes; the parser adds the #.

export const FALLBACK_TEAM_COLORS = {
  675230: '00843d', // Oakland Swish — green
  675231: '4b5563', // Alameda Wolves — wolf gray
  675232: '5b21b6', // Berkeley Royals — royal purple
  675233: '1e40af', // Tech City Titans — titan blue
  675234: '0e7490', // San Francisco Riptide — deep teal
  675235: 'ea580c', // Bay Area Phoenix — phoenix orange
  675236: 'dc2626', // Bay City Blaze — blaze red
  675237: 'ca8a04', // Hayward Reign — regal gold
};

export const DEFAULT_TEAM_COLOR = '334155'; // slate, for any team with no mapping
