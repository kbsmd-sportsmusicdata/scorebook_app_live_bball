import { useMemo, useState } from 'react';
import ScoreBar from './ScoreBar.jsx';
import EventInspector from './EventInspector.jsx';
import FoulsPanel from './FoulsPanel.jsx';
import ScoringSurface from './ScoringSurface.jsx';
import FoulWizardModal from './FoulWizardModal.jsx';
import SubDialog from './SubDialog.jsx';
import TimeoutDialog from './TimeoutDialog.jsx';
import HistoryModal from './HistoryModal.jsx';
import UndoConfirmModal from './UndoConfirmModal.jsx';
import RunningScorePanel from './RunningScorePanel.jsx';
import TimeoutsPanel from './TimeoutsPanel.jsx';
import BoxScoreModal from './BoxScoreModal.jsx';
import StandingsModal from './StandingsModal.jsx';
import ExportImportModal from './ExportImportModal.jsx';
import { scoreReducer } from '../reducers/scoreReducer.js';
import { teamFoulsReducer } from '../reducers/teamFoulsReducer.js';
import { playerStatsReducer } from '../reducers/playerStatsReducer.js';
import { onCourtReducer } from '../reducers/onCourtReducer.js';
import { gamePhaseReducer } from '../reducers/gamePhaseReducer.js';
import { timeoutsReducer } from '../reducers/timeoutsReducer.js';
import { describeLastGroup } from '../writers/undo.js';

const SCORING_TYPES = new Set(['SHOT_MADE', 'FT_MADE']);

export default function GameScreen({
  game,
  undoAvailable,
  redoAvailable,
  pendingConfirm,
  onCommitGroup,
  onUndo,
  onUndoGroups,
  onRedo,
  onCorrect,
  onImport,
  onDismissConfirm,
  onExit,
}) {
  const [dialog, setDialog] = useState(null); // 'foul' | 'sub' | 'timeout' | 'history' | null
  const [confirmPreview, setConfirmPreview] = useState(null);

  const score = useMemo(() => scoreReducer(game.events), [game.events]);
  const teamFouls = useMemo(() => teamFoulsReducer(game.events), [game.events]);
  const playerStats = useMemo(() => playerStatsReducer(game.events), [game.events]);
  const onCourt = useMemo(() => onCourtReducer(game.events, game.rosters), [game.events, game.rosters]);
  const phase = useMemo(() => gamePhaseReducer(game.events), [game.events]);
  const timeouts = useMemo(() => timeoutsReducer(game.events), [game.events]);

  // Single commit path for every input flow. S10: in sudden death, the first
  // score of any kind (a made FT counts; an offensive foul does not) ends the
  // game — GAME_END joins the same undo-group, so undoing the score also
  // undoes the GAME_END.
  const commitGroup = (inputs) => {
    let group = inputs;
    if (phase.suddenDeath && inputs.some((i) => SCORING_TYPES.has(i.type))) {
      group = [...inputs, { type: 'GAME_END', payload: { reason: 'sudden death — first score wins' } }];
    }
    onCommitGroup(group);
  };

  const tapUndo = () => {
    if (!undoAvailable) return;
    if (pendingConfirm) {
      setConfirmPreview(describeLastGroup(game.events, game.rosters));
    } else {
      onUndo();
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {game.rosters.home.name} vs {game.rosters.away.name}
          </h1>
          <p className="font-mono text-xs text-slate-400">{game.gameId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!undoAvailable}
            onClick={tapUndo}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            title={pendingConfirm ? 'Confirm the next undo step' : 'Undo the last event group'}
          >
            {pendingConfirm ? '↶ Undo…' : '↶ Undo'}
          </button>
          <button
            type="button"
            disabled={!redoAvailable}
            onClick={onRedo}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ↷ Redo
          </button>
          <button
            type="button"
            onClick={() => setDialog('history')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            History
          </button>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => setDialog('box')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Box score
          </button>
          <button
            type="button"
            onClick={() => setDialog('standings')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Standings
          </button>
          <button
            type="button"
            onClick={() => setDialog('export')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export
          </button>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Exit
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TimeoutsPanel game={game} />
          <RunningScorePanel game={game} />
        </div>
        <FoulsPanel teamFouls={teamFouls} playerStats={playerStats} rosters={game.rosters} />
        <EventInspector game={game} onAppend={(input) => commitGroup([input])} />
      </div>

      {dialog === 'foul' && <FoulWizardModal game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
      {dialog === 'sub' && <SubDialog game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
      {dialog === 'timeout' && <TimeoutDialog game={game} onCommitGroup={commitGroup} onClose={() => setDialog(null)} />}
      {dialog === 'history' && (
        <HistoryModal
          game={game}
          onUndoToSeq={(_seq, n) => {
            onUndoGroups(n);
            setDialog(null);
          }}
          onCorrect={(voidsSeq, reason) => {
            onCorrect(voidsSeq, reason);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'box' && <BoxScoreModal game={game} onClose={() => setDialog(null)} />}
      {dialog === 'standings' && <StandingsModal game={game} onClose={() => setDialog(null)} />}
      {dialog === 'export' && (
        <ExportImportModal
          game={game}
          onImport={(imported) => {
            onImport(imported);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {confirmPreview && (
        <UndoConfirmModal
          description={confirmPreview}
          onConfirm={() => {
            onUndo();
            setConfirmPreview(null);
          }}
          onCancel={() => {
            setConfirmPreview(null);
            onDismissConfirm();
          }}
        />
      )}
    </main>
  );
}
