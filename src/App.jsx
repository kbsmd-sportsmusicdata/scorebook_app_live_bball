import { useMemo, useState } from 'react';
import rosterCsv from '../docs/rosters/wpba_2026_rosters_master.csv?raw';
import { parseRosters } from './data/parseRosters.js';
import { createGame } from './writers/createGame.js';
import { appendEvents } from './writers/appendEvent.js';
import SetupScreen from './components/SetupScreen.jsx';
import GameScreen from './components/GameScreen.jsx';

// The game document { meta, rosters, events } is the ONLY game state.
// Everything on screen derives from game.events via reducers.
export default function App() {
  const { teams } = useMemo(() => parseRosters(rosterCsv), []);
  const [game, setGame] = useState(null);

  if (!game) {
    return <SetupScreen teams={teams} onComplete={(setup) => setGame(createGame(setup))} />;
  }

  return (
    <GameScreen
      game={game}
      onCommitGroup={(inputs) => setGame(appendEvents(game, inputs))}
      onExit={() => {
        if (window.confirm('Exit this game? The event log will be discarded (no persistence until Phase 5).')) {
          setGame(null);
        }
      }}
    />
  );
}
