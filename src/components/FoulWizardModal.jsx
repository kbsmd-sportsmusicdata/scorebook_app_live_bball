import { useState } from 'react';
import { WPBA } from '../rules/wpba.js';
import { resolveFoul, buildFoulGroup } from '../writers/foulWizard.js';
import { onCourtReducer } from '../reducers/onCourtReducer.js';
import { playerStatsReducer, statsFor } from '../reducers/playerStatsReducer.js';
import { Modal, ChoiceButton, PlayerChip } from './ui.jsx';

// The foul wizard UI: one modal walking foul-wizard-flowchart.mermaid.
// All rules logic lives in writers/foulWizard.js (pure); this component only
// sequences the questions and records FT results. The whole outcome commits
// as ONE undo-group (node Z).
//
// Deliberately absent: an excessive-timeout option — that technical's only
// entry point is the Timeout flow (dry-run finding 2).

const other = (team) => (team === 'home' ? 'away' : 'home');

export default function FoulWizardModal({ game, onCommitGroup, onClose }) {
  const { rosters } = game;
  const onCourt = onCourtReducer(game.events, rosters);
  const stats = playerStatsReducer(game.events);

  const [answers, setAnswers] = useState({ team: null, playerId: null, foulType: null });
  const [resolution, setResolution] = useState(null);
  const [shooterId, setShooterId] = useState(null);
  const [preFtSub, setPreFtSub] = useState(null);
  const [ftResults, setFtResults] = useState([]);
  const [reentryFt, setReentryFt] = useState(undefined); // undefined = not yet answered; null = skipped

  const playerById = (side, id) => {
    const player = rosters[side].players.find((p) => p.playerId === id);
    if (player) return player;
    const coach = rosters[side].coaches.find((c) => c.coachId === id);
    if (coach) return { playerId: id, name: coach.name, jersey: null };
    return { playerId: id, name: id, jersey: null };
  };

  const resolve = (nextAnswers) => {
    const r = resolveFoul(nextAnswers, { game });
    setAnswers(nextAnswers);
    setResolution(r);
    setShooterId(r.freeThrows?.defaultShooterId ?? null);
  };

  const commit = () => {
    onCommitGroup(
      buildFoulGroup({
        answers,
        resolution,
        ftResults,
        preFtSub,
        reentryFt: reentryFt ?? null,
      }),
    );
    onClose();
  };

  // ---- step: committing player -------------------------------------------
  if (!answers.playerId) {
    return (
      <Modal title="Foul — who committed it?" onClose={onClose}>
        {['home', 'away'].map((side) => (
          <div key={side} className="mb-3">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: rosters[side].color }}>
              {rosters[side].name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {onCourt[side].map((id) => (
                <PlayerChip
                  key={id}
                  player={playerById(side, id)}
                  color={rosters[side].color}
                  onClick={() => setAnswers({ team: side, playerId: id, foulType: null })}
                  note={onCourt.reentryUnderPenalty.includes(id) ? 'RE-ENTRY' : undefined}
                />
              ))}
              {rosters[side].players
                .filter((p) => !onCourt[side].includes(p.playerId))
                .map((p) => (
                  <PlayerChip key={p.playerId} player={p} color="#94a3b8" onClick={() => setAnswers({ team: side, playerId: p.playerId, foulType: null })} note="bench" />
                ))}
              {rosters[side].coaches
                .filter((c) => c.role === 'Head Coach')
                .map((c) => (
                  <PlayerChip
                    key={c.coachId}
                    player={{ name: c.name, jersey: null }}
                    color="#94a3b8"
                    onClick={() => setAnswers({ team: side, playerId: c.coachId, foulType: null })}
                    note="HC"
                  />
                ))}
            </div>
          </div>
        ))}
      </Modal>
    );
  }

  // ---- step: foul type -----------------------------------------------------
  if (!answers.foulType) {
    const pick = (foulType, extra = {}) => {
      const next = { ...answers, foulType, ...extra };
      if (foulType === 'offensive' || foulType === 'technical') resolve(next);
      else setAnswers(next);
    };
    return (
      <Modal title="Foul type" onClose={onClose}>
        <div className="flex flex-col gap-2">
          <ChoiceButton onClick={() => pick('personal')} sub="shooting or not — the wizard asks next">Personal</ChoiceButton>
          <ChoiceButton onClick={() => pick('offensive')} sub="player foul only — no team foul, no FTs, even in the bonus (S6)">Offensive</ChoiceButton>
          <ChoiceButton onClick={() => pick('technical')} sub="1 FT by any opposing player in the game, POI side-out (S7)">Technical</ChoiceButton>
          <ChoiceButton onClick={() => pick('flagrant1')} sub="2 FTs + possession; 2nd FF1 = ejection">Flagrant 1</ChoiceButton>
          <ChoiceButton onClick={() => pick('flagrant2')} sub="2 FTs + possession; immediate ejection">Flagrant 2</ChoiceButton>
          <ChoiceButton onClick={() => pick('special')} sub="take foul / away-from-play / flop / defensive 3-sec — the 1-FT family (S8)">Special (1-FT family)</ChoiceButton>
        </div>
      </Modal>
    );
  }

  // ---- step: branch questions ---------------------------------------------
  if (!resolution) {
    if (answers.foulType === 'personal' && answers.shooting == null) {
      return (
        <Modal title="Shooting foul?" onClose={onClose}>
          <div className="flex flex-col gap-2">
            <ChoiceButton onClick={() => setAnswers({ ...answers, shooting: true })}>Yes — on a shot attempt</ChoiceButton>
            <ChoiceButton
              onClick={() => resolve({ ...answers, shooting: false })}
              sub="penalty FTs derive automatically from the team-foul count"
            >
              No
            </ChoiceButton>
          </div>
        </Modal>
      );
    }
    if (answers.foulType === 'personal' && answers.shooting && answers.made == null) {
      return (
        <Modal title="Was the shot made?" onClose={onClose}>
          <div className="flex flex-col gap-2">
            <ChoiceButton onClick={() => setAnswers({ ...answers, made: true })} sub="and-one: basket counts (log it from the scoring surface), exactly 1 FT (S4)">
              Yes — and-one
            </ChoiceButton>
            <ChoiceButton onClick={() => setAnswers({ ...answers, made: false })}>No — missed attempt</ChoiceButton>
          </div>
        </Modal>
      );
    }
    if (answers.foulType === 'personal' && answers.shooting && answers.made === false && !answers.shotValue) {
      return (
        <Modal title="2-point or 3-point attempt?" onClose={onClose}>
          <div className="flex flex-col gap-2">
            <ChoiceButton onClick={() => setAnswers({ ...answers, shotValue: 2 })} sub="2 free throws">2-point attempt</ChoiceButton>
            <ChoiceButton onClick={() => setAnswers({ ...answers, shotValue: 3 })} sub="3 free throws — a missed 3 earns 3 (S4 contrast)">3-point attempt</ChoiceButton>
          </div>
        </Modal>
      );
    }
    if (answers.foulType === 'special' && !answers.specialKind) {
      const lastTwoLate = false; // display hint only; rule text shown on the button
      return (
        <Modal title="Which special foul?" onClose={onClose}>
          <div className="flex flex-col gap-2">
            <ChoiceButton onClick={() => resolve({ ...answers, specialKind: 'transitionTake' })} sub="1 FT, fouled team retains — does NOT apply in last 2:00 of Q4/OT or in 2OT" disabled={lastTwoLate}>
              Transition take foul
            </ChoiceButton>
            <ChoiceButton onClick={() => resolve({ ...answers, specialKind: 'awayFromPlay' })} sub="1 FT, resume at POI">Away-from-the-play</ChoiceButton>
            <ChoiceButton
              onClick={() => resolve({ ...answers, specialKind: 'flop', asOfSeq: game.events.length > 0 ? game.events[game.events.length - 1].seq : 0 })}
              sub="STEM — resolves as a technical; shooter eligibility as of the violation's moment"
            >
              Flop (STEM)
            </ChoiceButton>
            <ChoiceButton onClick={() => resolve({ ...answers, specialKind: 'defensive3s' })} sub="1 FT, possession to offended team at FTLE">Defensive 3-seconds</ChoiceButton>
          </div>
        </Modal>
      );
    }
    // personal branches that still need the fouled player before resolving
    const needFouled =
      answers.foulType === 'personal' && answers.shooting != null && (answers.made != null || answers.shooting === false) ||
      answers.foulType === 'flagrant1' ||
      answers.foulType === 'flagrant2';
    if (needFouled) {
      const side = other(answers.team);
      return (
        <Modal title="Who was fouled?" onClose={onClose}>
          <div className="flex flex-wrap gap-1.5">
            {onCourt[side].map((id) => (
              <PlayerChip key={id} player={playerById(side, id)} color={rosters[side].color} onClick={() => resolve({ ...answers, fouledPlayer: id })} />
            ))}
          </div>
        </Modal>
      );
    }
  }

  // ---- step: FT recording ---------------------------------------------------
  const ft = resolution.freeThrows;
  if (ft && ftResults.length < ft.count) {
    const side = other(answers.team);
    const shooterStats = shooterId ? statsFor(stats, shooterId) : null;
    const shooterOut = shooterStats && (shooterStats.dq || shooterStats.ejected);
    const bench = rosters[side].players.filter((p) => !onCourt[side].includes(p.playerId));

    return (
      <Modal title={`Free throw ${ftResults.length + 1} of ${ft.count}`} onClose={onClose}>
        <p className="mb-2 text-xs text-slate-500">{resolution.possession}</p>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          Shooter {ft.shooterRule === 'fouledPlayer' ? '(fouled player)' : ft.shooterRule === 'inGameAtViolation' ? '(in game at the violation)' : '(any player in the game)'}
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ft.pool.map((id) => (
            <PlayerChip key={id} player={playerById(side, id)} color={rosters[side].color} selected={shooterId === id} onClick={() => { setShooterId(id); setPreFtSub(null); }} />
          ))}
        </div>

        {shooterOut && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
            <p className="font-bold">Shooter is disqualified — coach picks a substitute (S5).</p>
            <p className="mb-2">The sub shoots and MUST remain in the game; the SUB is logged before the FTs.</p>
            <div className="flex flex-wrap gap-1.5">
              {bench
                .filter((p) => !statsFor(stats, p.playerId).dq && !statsFor(stats, p.playerId).ejected)
                .map((p) => (
                  <PlayerChip
                    key={p.playerId}
                    player={p}
                    color={rosters[side].color}
                    selected={preFtSub?.in === p.playerId}
                    onClick={() => {
                      setPreFtSub({ team: side, out: shooterId, in: p.playerId });
                      setShooterId(p.playerId);
                    }}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!shooterId || shooterOut}
            onClick={() => setFtResults([...ftResults, { made: true, shooterId }])}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Made
          </button>
          <button
            type="button"
            disabled={!shooterId || shooterOut}
            onClick={() => setFtResults([...ftResults, { made: false, shooterId }])}
            className="flex-1 rounded-xl bg-slate-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Missed
          </button>
        </div>
      </Modal>
    );
  }

  // ---- step: re-entry compound FT (S16 wrapper) ------------------------------
  if (resolution.reentryWrapper && reentryFt === undefined) {
    const side = other(answers.team);
    return (
      <Modal title="Re-entry penalty — compounding technical" onClose={onClose}>
        <p className="mb-3 text-xs text-slate-600">
          The committing player is under the re-entry penalty (S16): this foul compounds a technical on top of the base foul.
          One additional FT by any opposing player in the game.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {onCourt[side].map((id) => (
            <PlayerChip key={id} player={playerById(side, id)} color={rosters[side].color} selected={shooterId === `re:${id}`} onClick={() => setShooterId(`re:${id}`)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!shooterId?.startsWith('re:')} onClick={() => setReentryFt({ made: true, shooterId: shooterId.slice(3) })} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            Made
          </button>
          <button type="button" disabled={!shooterId?.startsWith('re:')} onClick={() => setReentryFt({ made: false, shooterId: shooterId.slice(3) })} className="flex-1 rounded-xl bg-slate-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            Missed
          </button>
          <button type="button" onClick={() => setReentryFt(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
            Skip FT
          </button>
        </div>
      </Modal>
    );
  }

  // ---- step: review + commit (node Z: one undo-group) ------------------------
  const group = buildFoulGroup({ answers, resolution, ftResults, preFtSub, reentryFt: reentryFt ?? null });
  // D1 (S5): project the group onto the log and surface anyone newly at 6
  let projSeq = game.events.length > 0 ? game.events[game.events.length - 1].seq : 0;
  const projected = playerStatsReducer([
    ...game.events,
    ...group.map((input) => ({ seq: ++projSeq, ts: 0, period: 0, team: input.team ?? null, playerId: input.playerId ?? null, type: input.type, payload: input.payload ?? {} })),
  ]);
  const newlyDq = Object.entries(projected).filter(([id, s]) => s.dq && !statsFor(stats, id).dq);
  const newlyEjected = Object.entries(projected).filter(([id, s]) => s.ejected && !statsFor(stats, id).ejected);

  return (
    <Modal title="Confirm foul" onClose={onClose}>
      <ul className="mb-3 flex flex-col gap-1 text-sm text-slate-700">
        {group.map((input, i) => (
          <li key={i} className="rounded bg-slate-50 px-2 py-1 font-mono text-xs">
            {input.type} {input.team ?? ''} {input.playerId ?? ''} {JSON.stringify(input.payload)}
          </li>
        ))}
      </ul>
      <p className="mb-2 text-xs text-slate-500">{resolution.possession}</p>
      {newlyDq.map(([id]) => (
        <p key={id} className="mb-1 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
          {id} reaches {WPBA.playerFoulLimit} fouls — DISQUALIFIED. Sub required (buttons stay disabled until subbed).
        </p>
      ))}
      {newlyEjected.map(([id]) => (
        <p key={id} className="mb-1 rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">
          {id} is EJECTED — next-game suspension flagged.
        </p>
      ))}
      <button type="button" onClick={commit} className="mt-2 w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700">
        Commit as one undo-group ({group.length} event{group.length === 1 ? '' : 's'})
      </button>
    </Modal>
  );
}
