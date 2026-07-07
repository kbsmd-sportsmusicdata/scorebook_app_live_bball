import Papa from 'papaparse';
import { FALLBACK_TEAM_COLORS, DEFAULT_TEAM_COLOR } from './teamColors.js';

// Roster CSV ingestion (Phase 0).
// Columns in docs/rosters/wpba_2026_rosters_master.csv:
//   type, season, team_id, team_name, team_color, team_logo, full_name, position, jersey_number
// team_color is 6-char hex with no # prefix (spec/csv-validation-report.md);
// rows missing it fall back to src/data/teamColors.js.

// Slug fallback for the player ID key when jersey_number is blank
// (spec/csv-validation-report.md, recommended fix #3). Today this covers
// Rokia Doumbia and Tamia Ugass (Oakland Swish), but it works for any
// future roster row with a missing number.
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics so slugs stay ASCII-stable
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function playerIdFor(teamId, jersey, fullName) {
  const j = String(jersey ?? '').trim();
  return j !== '' ? `${teamId}-${j}` : `${teamId}-${slugify(fullName)}`;
}

function teamColorFor(row) {
  const csvColor = String(row.team_color ?? '').trim();
  const hex = csvColor !== '' ? csvColor : (FALLBACK_TEAM_COLORS[row.team_id] ?? DEFAULT_TEAM_COLOR);
  return hex.startsWith('#') ? hex : `#${hex}`;
}

// csvText -> { teams: [...], teamsById: {...} }
// Each team: { teamId, name, logo, color, players: [...], coaches: [...] }
// Each player: { playerId, name, position, jersey } (jersey is null when blank)
export function parseRosters(csvText) {
  const { data, errors } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transform: (v) => String(v).trim(),
  });

  const fatal = errors.filter((e) => e.type !== 'FieldMismatch');
  if (fatal.length > 0) {
    throw new Error(`Roster CSV parse failed: ${fatal[0].message} (row ${fatal[0].row})`);
  }

  const teamsById = {};

  for (const row of data) {
    if (!row.team_id || !row.full_name) continue;

    let team = teamsById[row.team_id];
    if (!team) {
      team = {
        teamId: row.team_id,
        name: row.team_name || `Team ${row.team_id}`,
        logo: row.team_logo || '',
        color: teamColorFor(row),
        players: [],
        coaches: [],
      };
      teamsById[row.team_id] = team;
    }

    if (row.type === 'coach') {
      team.coaches.push({ name: row.full_name, role: row.position });
    } else if (row.type === 'player') {
      const jersey = String(row.jersey_number ?? '').trim();
      team.players.push({
        playerId: playerIdFor(row.team_id, jersey, row.full_name),
        name: row.full_name,
        position: row.position,
        jersey: jersey !== '' ? jersey : null,
      });
    }
  }

  // Non-numeric jerseys (blank, or placeholders like 'TBD') sort after real numbers.
  const jerseyRank = (jersey) => {
    const n = Number(jersey);
    return jersey === null || Number.isNaN(n) ? Infinity : n;
  };

  const teams = Object.values(teamsById).sort((a, b) => a.name.localeCompare(b.name));
  for (const team of teams) {
    team.players.sort(
      (a, b) => jerseyRank(a.jersey) - jerseyRank(b.jersey) || a.name.localeCompare(b.name),
    );
  }

  return { teams, teamsById };
}
