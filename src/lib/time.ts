// The time engine. The app never counts days; it only knows the save's current date.
// Ages, life stages and countdowns are worked out from each Sim's birthday, the save's date and the lifespan rules.

import type { LifeStageId, LifespanRules, SeasonIndex, SeasonLength, SimDate } from './types';

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const SEASON_LENGTHS: SeasonLength[] = [7, 14, 21, 28];

export const STAGES: LifeStageId[] = ['newborn', 'infant', 'toddler', 'child', 'teen', 'youngAdult', 'adult', 'elder'];

export const STAGE_LABEL: Record<LifeStageId, string> = {
  newborn: 'Newborn',
  infant: 'Infant',
  toddler: 'Toddler',
  child: 'Child',
  teen: 'Teen',
  youngAdult: 'Young adult',
  adult: 'Adult',
  elder: 'Elder',
};

export interface StageRow {
  id: LifeStageId;
  short: number;
  normal: number;
  long: number;
}

/**
 * Fallback stage lengths, used until the game-data workbook's Life stages tab is loaded.
 * Short is half of Normal, Long is four times Normal. Elder = minimum days before old age.
 */
export const DEFAULT_STAGE_TABLE: StageRow[] = [
  { id: 'newborn', short: 2, normal: 3, long: 12 },
  { id: 'infant', short: 4, normal: 7, long: 28 },
  { id: 'toddler', short: 7, normal: 13, long: 52 },
  { id: 'child', short: 7, normal: 13, long: 52 },
  { id: 'teen', short: 7, normal: 13, long: 52 },
  { id: 'youngAdult', short: 12, normal: 24, long: 96 },
  { id: 'adult', short: 12, normal: 24, long: 96 },
  { id: 'elder', short: 15, normal: 29, long: 116 },
];

export function stageDays(rules: LifespanRules, table: StageRow[] = DEFAULT_STAGE_TABLE): Record<LifeStageId, number> {
  const out = {} as Record<LifeStageId, number>;
  for (const row of table) {
    if (rules.preset === 'custom') {
      const v = rules.custom?.[row.id];
      out[row.id] = v && v > 0 ? Math.round(v) : row.normal;
    } else {
      out[row.id] = Math.max(1, Math.round(row[rules.preset])); // the game counts whole days
    }
  }
  return out;
}

// ---------- Dates ----------

/** Day must fit the current season length; extra days from a longer setting are clamped, never deleted. */
export function clampDay(day: number, len: SeasonLength): number {
  return Math.min(Math.max(1, Math.round(day)), len);
}

/** Absolute day number (0 = Spring, Day 1, Year 1). Works for negative years. */
export function toIndex(d: SimDate, len: SeasonLength): number {
  return (d.year - 1) * 4 * len + d.season * len + (clampDay(d.day, len) - 1);
}

export function fromIndex(i: number, len: SeasonLength): SimDate {
  const perYear = 4 * len;
  const yearOffset = Math.floor(i / perYear);
  const inYear = i - yearOffset * perYear;
  const season = Math.floor(inYear / len) as SeasonIndex;
  const day = (inYear % len) + 1;
  return { year: yearOffset + 1, season, day };
}

export function addDays(d: SimDate, n: number, len: SeasonLength): SimDate {
  return fromIndex(toIndex(d, len) + n, len);
}

export function diffDays(from: SimDate, to: SimDate, len: SeasonLength): number {
  return toIndex(to, len) - toIndex(from, len);
}

export function compareDates(a: SimDate, b: SimDate, len: SeasonLength): number {
  return toIndex(a, len) - toIndex(b, len);
}

/** Every season starts on a Sunday (season lengths are whole weeks), so weekdays line up everywhere. */
export function weekdayOf(d: SimDate, len: SeasonLength): number {
  return (clampDay(d.day, len) - 1) % 7;
}

export function formatDate(d: SimDate, opts: { year?: boolean } = {}): string {
  const base = `${SEASONS[d.season]} · Day ${d.day}`;
  return opts.year === false ? base : `Year ${d.year} · ${base}`;
}

export function formatShort(d: SimDate): string {
  return `${SEASONS[d.season]} ${d.day}`;
}

export function formatSeasonDay(season: SeasonIndex, day: number) {
  return `${SEASONS[season]}, Day ${day}`;
}

// ---------- Ages ----------

export interface AgeInfo {
  ageDays: number;
  stage: LifeStageId;
  dayInStage: number; // 1-based
  stageLength: number;
  /** Days until the next life stage; null for elders. */
  agesUpIn: number | null;
  nextStage: LifeStageId | null;
  agesUpOn: SimDate | null;
  /** Elders only: true once they've passed the minimum days. */
  oldAgeAnyDay: boolean;
  notBornYet: boolean;
}

export function ageInfo(
  birthday: SimDate,
  today: SimDate,
  len: SeasonLength,
  rules: LifespanRules,
  table?: StageRow[],
): AgeInfo {
  const days = stageDays(rules, table);
  const age = diffDays(birthday, today, len);
  if (age < 0) {
    return {
      ageDays: age,
      stage: 'newborn',
      dayInStage: 0,
      stageLength: days.newborn,
      agesUpIn: null,
      nextStage: null,
      agesUpOn: null,
      oldAgeAnyDay: false,
      notBornYet: true,
    };
  }
  let start = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const id = STAGES[i];
    const length = days[id];
    const isElder = id === 'elder';
    if (isElder || age < start + length) {
      const dayInStage = age - start + 1;
      const agesUpIn = isElder ? null : start + length - age;
      return {
        ageDays: age,
        stage: id,
        dayInStage,
        stageLength: length,
        agesUpIn,
        nextStage: isElder ? null : STAGES[i + 1],
        agesUpOn: agesUpIn === null ? null : addDays(today, agesUpIn, len),
        oldAgeAnyDay: isElder && dayInStage > length,
        notBornYet: false,
      };
    }
    start += length;
  }
  throw new Error('unreachable');
}

/** Day offset (from birth) at which a Sim enters each stage. */
export function stageStarts(rules: LifespanRules, table?: StageRow[]): Record<LifeStageId, number> {
  const days = stageDays(rules, table);
  const out = {} as Record<LifeStageId, number>;
  let acc = 0;
  for (const id of STAGES) {
    out[id] = acc;
    acc += days[id];
  }
  return out;
}

/**
 * Work a birthday backwards from "they're a [stage], [n] days until they age up" — how players
 * usually add Sims that already exist in their game.
 */
export function birthdayFromStage(
  stage: LifeStageId,
  daysUntilAgeUp: number | null,
  today: SimDate,
  len: SeasonLength,
  rules: LifespanRules,
  table?: StageRow[],
): SimDate {
  const days = stageDays(rules, table);
  const starts = stageStarts(rules, table);
  const length = days[stage];
  const left = daysUntilAgeUp == null ? length : Math.min(Math.max(1, daysUntilAgeUp), length);
  // age today = start of stage + days already spent in it
  const ageToday = starts[stage] + (length - left);
  return addDays(today, -ageToday, len);
}

/** Ages-up events that fall inside [from, to] (inclusive), for the calendar and Jump ahead recaps. */
export function ageUpsBetween(
  birthday: SimDate,
  from: SimDate,
  to: SimDate,
  len: SeasonLength,
  rules: LifespanRules,
  table?: StageRow[],
): { date: SimDate; stage: LifeStageId }[] {
  const starts = stageStarts(rules, table);
  const b = toIndex(birthday, len);
  const lo = toIndex(from, len);
  const hi = toIndex(to, len);
  const out: { date: SimDate; stage: LifeStageId }[] = [];
  for (const id of STAGES) {
    if (id === 'newborn') continue;
    const at = b + starts[id];
    if (at >= lo && at <= hi) out.push({ date: fromIndex(at, len), stage: id });
  }
  return out;
}

/** Yearly birthday (the season/day they were born) occurrences inside [from, to]. */
export function birthdaysBetween(birthday: SimDate, from: SimDate, to: SimDate, len: SeasonLength): SimDate[] {
  const out: SimDate[] = [];
  for (let y = from.year; y <= to.year; y++) {
    if (y <= birthday.year) continue; // the day they were born isn't a birthday
    const d: SimDate = { year: y, season: birthday.season, day: clampDay(birthday.day, len) };
    if (compareDates(d, from, len) >= 0 && compareDates(d, to, len) <= 0) out.push(d);
  }
  return out;
}

/** Annual events (holidays) inside [from, to]. */
export function annualBetween(season: SeasonIndex, day: number, from: SimDate, to: SimDate, len: SeasonLength): SimDate[] {
  const out: SimDate[] = [];
  for (let y = from.year; y <= to.year; y++) {
    const d: SimDate = { year: y, season, day: clampDay(day, len) };
    if (compareDates(d, from, len) >= 0 && compareDates(d, to, len) <= 0) out.push(d);
  }
  return out;
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

export function inDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 0) return `${plural(-n, 'day')} ago`;
  return `in ${plural(n, 'day')}`;
}
