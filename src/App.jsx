import { useMemo, useState } from 'react';
import rosterCsv from '../docs/rosters/wpba_2026_rosters_master.csv?raw';
import { parseRosters } from './data/parseRosters.js';
import { createGame } from './writers/createGame.js';
import { appendEvents } from './writers/appendEvent.js';
import { popLastGroup } from './writers/undo.js';
import SetupScreen from './components/SetupScreen.jsx';
import GameScreen from './components/GameScreen.jsx';

// The game document { meta, rosters, events } is the ONLY persistent state.
// Everything on screen derives from game.events via reducers.
//
// undoStack lives ALONGSIDE the game (not inside it) — it's session-only
// scaffolding, not part of what a JSON export/import must round-trip
// (spec/test-scenarios.md Scenario 14 asserts "no derived fields in the JSON").
// Each entry is one undo-group's worth of append inputs.
export default function App() {
  const { teams } = useMemo(() => parseRosters(rosterCsv), []);
  const [game, setGame] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  // Krystal's Phase 4 rule: the FIRST undo after a commit fires immediately;
  // the second-in-a-row asks for confirmation. Any commit or redo resets it.
  const [pendingConfirm, setPendingConfirm] = useState(false);

  if (!game) {
    return (
      <SetupScreen
        teams={teams}
        onComplete={(setup) => {
          setGame(createGame(setup));
          setUndoStack([]);
          setPendingConfirm(false);
        }}
      />
    );
  }

  const commitGroup = (inputs) => {
    setGame(appendEvents(game, inputs));
    setUndoStack([]); // standard undo/redo semantic: any new action wipes redo history
    setPendingConfirm(false);
  };

  const undoOne = () => {
    const [remaining, removed] = popLastGroup(game.events);
    if (removed.length === 0) return;
    setGame({ ...game, events: remaining });
    setUndoStack([...undoStack, removed]);
    setPendingConfirm(true);
  };

  const undoGroups = (count) => {
    let events = game.events;
    const removedGroups = [];
    for (let i = 0; i < count; i++) {
      const [next, removed] = popLastGroup(events);
      if (removed.length === 0) break;
      events = next;
      removedGroups.push(removed);
    }
    if (removedGroups.length === 0) return;
    setGame({ ...game, events });
    setUndoStack([...undoStack, ...removedGroups]);
    setPendingConfirm(false); // bulk undo is intentional; next single Undo starts fresh
  };

  const redoOne = () => {
    if (undoStack.length === 0) return;
    const next = undoStack[undoStack.length - 1];
    setGame(appendEvents(game, next));
    setUndoStack(undoStack.slice(0, -1));
    setPendingConfirm(false);
  };

  const correct = (voidsSeq, reason) =>
    commitGroup([{ type: 'CORRECTION', payload: { voidsSeq, reason } }]);

  return (
    <GameScreen
      game={game}
      undoAvailable={game.events.length > 0}
      redoAvailable={undoStack.length > 0}
      pendingConfirm={pendingConfirm}
      onCommitGroup={commitGroup}
      onUndo={undoOne}
      onUndoGroups={undoGroups}
      onRedo={redoOne}
      onCorrect={correct}
      onDismissConfirm={() => setPendingConfirm(false)}
      onExit={() => {
        if (window.confirm('Exit this game? The event log will be discarded (no persistence until Phase 5).')) {
          setGame(null);
          setUndoStack([]);
          setPendingConfirm(false);
        }
      }}
    />
  );
}
