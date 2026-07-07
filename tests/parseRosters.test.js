// Phase 0 roster-ingestion checks against the real CSV.
// (Scenario fixtures from spec/test-scenarios.md join this folder in Phase 2.)
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseRosters, playerIdFor, slugify } from '../src/data/parseRosters.js';

const csvText = readFileSync(
  new URL('../docs/rosters/wpba_2026_rosters_master.csv', import.meta.url),
  'utf8',
);

describe('parseRosters', () => {
  const { teams, teamsById } = parseRosters(csvText);

  it('loads all 8 WPBA teams', () => {
    expect(teams).toHaveLength(8);
    expect(teams.map((t) => t.name)).toContain('Oakland Swish');
  });

  it('keys players as teamId-jersey when a jersey number exists', () => {
    const wolves = teamsById['675231'];
    const mcgee = wolves.players.find((p) => p.name === 'Bianca Mcgee');
    expect(mcgee.playerId).toBe('675231-22');
    expect(mcgee.jersey).toBe('22');
    expect(mcgee.position).toBe('G');
  });

  it('falls back to a slugified full_name for blank jersey numbers (csv-validation-report fix #3)', () => {
    const swish = teamsById['675230'];
    const doumbia = swish.players.find((p) => p.name === 'Rokia Doumbia');
    const ugass = swish.players.find((p) => p.name === 'Tamia Ugass');
    expect(doumbia.playerId).toBe('675230-rokia-doumbia');
    expect(doumbia.jersey).toBeNull();
    expect(ugass.playerId).toBe('675230-tamia-ugass');
    expect(ugass.jersey).toBeNull();
  });

  it('gives every player a unique, non-empty playerId', () => {
    const ids = teams.flatMap((t) => t.players.map((p) => p.playerId));
    expect(ids.every((id) => id && !id.endsWith('-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('separates coaches from the pickable roster', () => {
    const swish = teamsById['675230'];
    expect(swish.players.some((p) => p.position.includes('Coach'))).toBe(false);
    expect(swish.coaches.map((c) => c.role)).toContain('Head Coach');
    expect(swish.coaches).toHaveLength(4); // 1 HC + 3 ACs — real variation, not an error
  });

  it('applies a #-prefixed color to every team (fallback palette until the CSV gains team_color)', () => {
    for (const team of teams) {
      expect(team.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(team.logo).toMatch(/^https:\/\//);
    }
  });

  it('prefers a team_color CSV column over the fallback palette when present', () => {
    const withColor = [
      'type,season,team_id,team_name,team_logo,full_name,position,jersey_number,team_color',
      'player,2026,675230,Oakland Swish,https://x/logo.svg,Test Player,G,7,00ff00',
    ].join('\n');
    const parsed = parseRosters(withColor);
    expect(parsed.teamsById['675230'].color).toBe('#00ff00');
  });
});

describe('playerIdFor / slugify', () => {
  it('handles punctuation and diacritics in name slugs', () => {
    expect(slugify("D'Asia  Löwe-Smith")).toBe('d-asia-lowe-smith');
    expect(playerIdFor('675230', '', "D'Asia Löwe-Smith")).toBe('675230-d-asia-lowe-smith');
    expect(playerIdFor('675230', ' 12 ', 'Anyone')).toBe('675230-12');
  });
});
