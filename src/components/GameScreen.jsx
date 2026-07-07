import { useMemo } from 'react';
import ScoreBar from './ScoreBar.jsx';
import EventInspector from './EventInspector.jsx';
import FoulsPanel from './FoulsPanel.jsx';
import { scoreReducer } from '../reducers/scoreReducer.js';
import { teamFoulsReducer } from '../reducers/teamFoulsReducer.js';
import { playerStatsReducer } from '../reducers/playerStatsReducer.js';

// Score bar + foul/bonus panel + dev event inspector. The tap-friendly
// scoring surface arrives in Phase 3; until then the inspector is the writer.
export default function GameScreen({ game, onAppend, onExit }) {
  const score = useMemo(() => scoreReducer(game.events), [game.events]);
  const teamFouls = useMemo(() => teamFoulsReducer(game.events), [game.events]);
  const playerStats = useMemo(() => playerStatsReducer(game.events), [game.events]);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {game.rosters.home.name} vs {game.rosters.away.name}
          </h1>
          <p className="font-mono text-xs text-slate-400">{game.gameId}</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Exit game
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <ScoreBar score={score} rosters={game.rosters} />
        <FoulsPanel teamFouls={teamFouls} playerStats={playerStats} rosters={game.rosters} />
        <EventInspector game={game} onAppend={onAppend} />
      </div>
    </main>
  );
}
