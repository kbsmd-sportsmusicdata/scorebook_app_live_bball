import { useState } from 'react';
import TeamPicker from './TeamPicker.jsx';
import RosterPanel from './RosterPanel.jsx';
import { WPBA } from '../rules/wpba.js';

const EMPTY_SIDE = { teamId: null, starterIds: [] };

// Game setup: pick home/away from the 8 WPBA teams, then choose starters.
// Each half of the screen takes its selected team's color as an accent.
export default function SetupScreen({ teams, onComplete }) {
  const [sides, setSides] = useState({ home: EMPTY_SIDE, away: EMPTY_SIDE });

  const teamFor = (side) => teams.find((t) => t.teamId === sides[side].teamId) ?? null;

  const selectTeam = (side, teamId) =>
    setSides((prev) => ({
      ...prev,
      // Re-picking the same team keeps starters; switching teams resets them.
      [side]: prev[side].teamId === teamId ? prev[side] : { teamId, starterIds: [] },
    }));

  const toggleStarter = (side, playerId) =>
    setSides((prev) => {
      const { teamId, starterIds } = prev[side];
      const next = starterIds.includes(playerId)
        ? starterIds.filter((id) => id !== playerId)
        : starterIds.length < WPBA.playersOnCourt
          ? [...starterIds, playerId]
          : starterIds;
      return { ...prev, [side]: { teamId, starterIds: next } };
    });

  const ready =
    sides.home.starterIds.length === WPBA.playersOnCourt &&
    sides.away.starterIds.length === WPBA.playersOnCourt;

  const start = () =>
    onComplete({
      home: { team: teamFor('home'), starterIds: sides.home.starterIds },
      away: { team: teamFor('away'), starterIds: sides.away.starterIds },
    });

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800">WPBA Scorebook — Game Setup</h1>
        <p className="text-sm text-slate-500">
          Pick both teams, then tap {WPBA.playersOnCourt} starters on each side.
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        {['home', 'away'].map((side) => {
          const team = teamFor(side);
          const otherSide = side === 'home' ? 'away' : 'home';
          return (
            <section
              key={side}
              className="rounded-2xl bg-white p-5 shadow-sm"
              style={{ borderTop: `6px solid ${team ? team.color : '#cbd5e1'}` }}
            >
              <h2
                className="mb-3 text-lg font-bold uppercase tracking-wide"
                style={{ color: team ? team.color : '#475569' }}
              >
                {side} {team ? `— ${team.name}` : ''}
              </h2>

              <TeamPicker
                teams={teams}
                selectedTeamId={sides[side].teamId}
                disabledTeamId={sides[otherSide].teamId}
                onSelect={(teamId) => selectTeam(side, teamId)}
              />

              {team && (
                <div className="mt-5">
                  <RosterPanel
                    team={team}
                    starterIds={sides[side].starterIds}
                    onToggleStarter={(playerId) => toggleStarter(side, playerId)}
                    starterLimit={WPBA.playersOnCourt}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-sm text-slate-500">
            {ready
              ? 'Both lineups set.'
              : `Select teams and ${WPBA.playersOnCourt} starters per side to continue.`}
          </p>
          <button
            type="button"
            disabled={!ready}
            onClick={start}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
            style={ready ? { backgroundColor: teamFor('home')?.color } : undefined}
          >
            Start Game
          </button>
        </div>
      </footer>
    </main>
  );
}
