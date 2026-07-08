import { useMemo, useState } from 'react';
import ScoreBar from './ScoreBar.jsx';
import EventInspector from './EventInspector.jsx';
import FoulsPanel from './FoulsPanel.jsx';
import ScoringSurface from './ScoringSurface.jsx';
import FoulWizardModal from './FoulWizardModal.jsx';
import SubDialog from './SubDialog.jsx';
import TimeoutDialog from './TimeoutDialog.jsx';
import { scoreReducer } from '../reducers/scoreReducer.js';
import { teamFoulsReducer } from '../reducers/teamFoulsReducer.js';
import { playerStatsReducer } from '../reducers/playerStatsReducer.js';
import { onCourtReducer } from '../reducers/onCourtReducer.js';
import { gamePhaseReducer } from '../reducers/gamePhaseReducer.js';
import { timeoutsReducer } from '../reducers/timeoutsReducer.js';

const SCORING_TYPES = new Set(['SHOT_MADE', 'FT_MADE']);

export default function GameScreen({ game, onCommitGroup, onExit }) {
  const [dialog, setDialog] = useState(null); // 'foul' | 'sub' | 'timeout' | null

  const score = useMemo(() => scoreReducer(game.events), [game.events]);
  const teamFouls = useMemo(() => teamFoulsReducer(game.events), [game.events]);
  const playerStats = useMemo(() => playerStatsReducer(game.events), [game.events]);
  const onCourt = useMemo(() => onCourtReducer(game.events, game.rosters), [game.events, game.rosters]);
  const phase = useMemo(() => gamePhaseReducer(game.events), [game.events]);
  const timeouts = useMemo(() => timeoutsReducer(game.events), [game.events]);

  // Single commit path for every input flow. S10: in sudden death, the first
  // score of any kind (a made FT counts; an offensive foul does not) ends the
  // game — GAME_END joins the same undo-group.
  const commitGroup = (inputs) => {
    let group = inputs;
    if (phase.suddenDeath && inputs.some((i) => SCORING_TYPES.has(i.type))) {
      group = [...inputs, { type: 'GAME_END', payload: { reason: 'sudden death — first score wins' } }];
    }
    onCommitGroup(group);
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {game.rosters.home.name} vs {game.rosters.away.name}
          </h1>
          <p className="font-mono text-xs text-slate-400">{game.gameId}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            TO: {game.rosters.home.name} {timeouts.home.remaining} · {game.rosters.away.name} {timeouts.away.remaining}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Exit game
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <ScoreBar score={score} rosters={game.rosters} />
        <ScoringSurface
          game={game}
          phase={phase}
          onCourt={onCourt}
          playerStats={playerStats}
          lastTwoArmed={teamFouls.lastTwoArmed}
          onCommitGroup={commitGroup}
          onOpenFoul={() => setDialog('foul')}
          onOpenSub={() => setDialog('sub')}
          onOpenTimeout={() => setDialog('timeout')}
        />
        <FoulsPanel teamFouls={teamFouls} playerStats={playerStats} rosters={game.rosters} />
        <EventInspector game={game} onAppend={(input) => commitGroup([input])} />
      </div>

      {dialog === 'foul' && <FoulWizardModal game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
      {dialog === 'sub' && <SubDialog game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
      {dialog === 'timeout' && <TimeoutDialog game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
    </main>
  );
}
