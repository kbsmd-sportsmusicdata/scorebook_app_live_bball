// Backup team-color map, keyed by team_id. The primary source is the
// `team_color` column in docs/rosters/wpba_2026_rosters_master.csv (6-char hex,
// no # prefix — parseRosters() adds the #); this map only applies to a roster
// row that lacks the column, so a future CSV drop missing it degrades
// gracefully instead of rendering colorless. Values mirror the official 2026
// palette supplied by Krystal (2026-07-07) — keep them in sync with the CSV.

export const FALLBACK_TEAM_COLORS = {
  675230: '394F6E', // Oakland Swish
  675231: '8A2B46', // Alameda Wolves
  675232: '00B2A9', // Berkeley Royals
  675233: '1E6340', // Tech City Titans
  675234: '007889', // San Francisco Riptide
  675235: 'FD3028', // Bay Area Phoenix
  675236: 'F20808', // Bay City Blaze
  675237: '582D81', // Hayward Reign
};

export const DEFAULT_TEAM_COLOR = '334155'; // slate, for any team with no mapping
