import { useMemo, useState } from 'react';
import rosterCsv from '../docs/rosters/wpba_2026_rosters_master.csv?raw';
import { parseRosters } from './data/parseRosters.js';
import SetupScreen from './components/SetupScreen.jsx';

// Phase 0: scaffold + roster ingestion only. The setup screen produces the
// { meta, rosters } halves of the game document; events[] arrives in Phase 1.
export default function App() {
  const { teams } = useMemo(() => parseRosters(rosterCsv), []);
  const [gameSetup, setGameSetup] = useState(null);

  if (gameSetup) {
    return (
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Setup complete</h1>
        <p className="text-slate-600">
          <span className="font-semibold" style={{ color: gameSetup.home.team.color }}>
            {gameSetup.home.team.name}
          </span>
          {' vs '}
          <span className="font-semibold" style={{ color: gameSetup.away.team.color }}>
            {gameSetup.away.team.name}
          </span>
        </p>
        <p className="text-sm text-slate-500">Scoring arrives in Phase 1 — the event log core.</p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => setGameSetup(null)}
        >
          Back to setup
        </button>
      </main>
    );
  }

  return <SetupScreen teams={teams} onComplete={setGameSetup} />;
}
