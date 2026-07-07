import { WPBA } from '../rules/wpba.js';

// 1–4 → Q1–Q4; 5 → OT; 6 → 2OT (sudden death) — see the game-phase diagram.
export function periodLabel(period) {
  if (period == null || Number.isNaN(Number(period)) || period < 1) return '';
  if (period <= WPBA.periods) return `Q${period}`;
  const otNumber = period - WPBA.periods;
  return otNumber === 1 ? 'OT' : `${otNumber}OT`;
}
