/**
 * Real-life ages: a Sim's age shown the way a person's would be, scaled by how far through their life stage they are.
 * A teen halfway through the teen stage reads as 15 and a half. Nothing here changes how a Sim ages in the game.
 *
 * Each stage starts at an age in years; a stage runs until the next one starts. Elder runs to `end`.
 * (There is no preteen stage in SimDesk yet. When there is, it starts at 10 and teen follows at 12.)
 */
import type { Age, StageId } from './time';
import { STAGE_IDS } from './time';

export type RealAgeRanges = { starts: number[]; end: number };

/** Newborn 0 to 3 months, infant 3 months to 1, toddler 1–3, child 4–12, teen 13–17, young adult 18–29, adult 30–59, elder 60–100. */
export const DEFAULT_REAL_AGES: RealAgeRanges = { starts: [0, 0.25, 1, 4, 13, 18, 30, 60], end: 100 };

export const sanitizeRanges = (r: Partial<RealAgeRanges> | undefined): RealAgeRanges => {
  const d = DEFAULT_REAL_AGES;
  const s = Array.isArray(r?.starts) && r!.starts!.length === d.starts.length && r!.starts!.every((x) => typeof x === 'number' && Number.isFinite(x)) ? r!.starts! : d.starts;
  const ok = s[0] === 0 && s.every((x, i) => i === 0 || x > s[i - 1]);
  const end = typeof r?.end === 'number' && Number.isFinite(r.end) ? r.end : d.end;
  return ok && end > s[s.length - 1] ? { starts: s, end } : d;
};

/** The age in years (with decimals) for a Sim part-way through a stage. */
export function realAgeYears(a: Extract<Age, { born: true }>, r: RealAgeRanges): number {
  const i = STAGE_IDS.indexOf(a.stage);
  const lo = r.starts[i];
  const hi = i + 1 < r.starts.length ? r.starts[i + 1] : r.end;
  const progress = a.stage === 'elder' ? Math.min(1, (a.daysAsElder ?? 0) / a.stageDays) : Math.max(0, Math.min(1, (a.dayInStage - 1) / a.stageDays));
  return lo + progress * (hi - lo);
}

/** "3 weeks old", "7 months old", "1 year old", "24 years old". */
export function realAgeText(years: number): string {
  if (years < 0.25) {
    const w = Math.floor(years * 52);
    return w < 1 ? 'Under a week old' : w === 1 ? '1 week old' : `${w} weeks old`;
  }
  if (years < 1) {
    const m = Math.floor(years * 12 + 1e-9);
    return m === 1 ? '1 month old' : `${m} months old`;
  }
  const y = Math.floor(years + 1e-9);
  return y === 1 ? '1 year old' : `${y} years old`;
}

/** The ages a stage covers, for the settings list: "0–3 months", "1–3 years", "60–100 years". */
export function rangeText(stage: StageId, r: RealAgeRanges): string {
  const i = STAGE_IDS.indexOf(stage);
  const lo = r.starts[i];
  const hi = i + 1 < r.starts.length ? r.starts[i + 1] : r.end;
  if (hi <= 1) return `${Math.round(lo * 12)}–${Math.round(hi * 12)} months`;
  if (lo < 1) return `${Math.round(lo * 12)} months–${hi - 1 < 1 ? 1 : hi - 1} year${hi - 1 === 1 ? '' : 's'}`;
  const last = i + 1 < r.starts.length ? hi - 1 : hi;
  return `${Math.round(lo)}–${Math.round(last)} years`;
}

/** The short form for tight spots like Sim cards: "30", "9M", "5w". */
export function realAgeShort(years: number): string {
  if (years < 0.25) {
    const w = Math.floor(years * 52);
    return w < 1 ? '<1w' : `${w}w`;
  }
  if (years < 1) return `${Math.floor(years * 12 + 1e-9)}M`;
  return String(Math.floor(years + 1e-9));
}
