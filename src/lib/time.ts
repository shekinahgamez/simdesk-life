/**
 * The time engine: dates, life stages, ages and birthdays.
 *
 * Nothing stores an age. A save keeps a running day number (`today`, days since the save began) and
 * each Sim keeps the day number they were born on (`bornDay`). Everything else is worked out here.
 *
 * Owner rules (2026-11-03):
 * - A birthday IS an age-up. There are no separate yearly birthdays.
 * - Changing the season length keeps every Sim's age in days; only calendar labels move.
 * - Changing the lifespan works like the game: same life stage, same share of the way through it.
 * - A Sim fresh from Create a Sim starts on day 1 of their stage. One already in the game can say
 *   "Birthday in N days" (elders: "Days as an elder"), copied from their age bar.
 * - Weeks always start on Sunday, and every season starts on a Sunday.
 * - Elders have no birthday. Once their age bar is full they're in their "final chapter".
 *   Nothing about it goes on the calendar.
 */
import { GAME } from '../data/game';

// ---------- the calendar ----------
export type Season = 0 | 1 | 2 | 3;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type SeasonLength = 7 | 14 | 21 | 28;
export const SEASON_LENGTHS: SeasonLength[] = [7, 14, 21, 28];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** A calendar date. `year` can be 0 or below for days before the save began. */
export type SimDate = { year: number; season: Season; day: number };

/**
 * How day numbers map to dates in one save. `anchorDay` is shown as `anchorDate`; other days count
 * from there. Changing the season length moves the anchor to today, so today keeps its date.
 */
export type Calendar = { seasonLength: SeasonLength; anchorDay: number; anchorDate: SimDate };

export function newCalendar(seasonLength: SeasonLength, startSeason: Season): Calendar {
  return { seasonLength, anchorDay: 0, anchorDate: { year: 1, season: startSeason, day: 1 } };
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Days from Year 1, Spring, Day 1 to this date. A day past the season's end counts as its last day. */
export function dateIndex(d: SimDate, len: SeasonLength): number {
  const day = Math.min(Math.max(1, Math.round(d.day)), len);
  return (d.year - 1) * 4 * len + d.season * len + (day - 1);
}

export function indexToDate(i: number, len: SeasonLength): SimDate {
  const year = Math.floor(i / (4 * len)) + 1;
  const inYear = mod(i, 4 * len);
  return { year, season: Math.floor(inYear / len) as Season, day: (inYear % len) + 1 };
}

/** The date shown for a day number. */
export function dateOf(dayNumber: number, cal: Calendar): SimDate {
  return indexToDate(dateIndex(cal.anchorDate, cal.seasonLength) + (dayNumber - cal.anchorDay), cal.seasonLength);
}

/** The day number for a date. */
export function dayOf(d: SimDate, cal: Calendar): number {
  return cal.anchorDay + dateIndex(d, cal.seasonLength) - dateIndex(cal.anchorDate, cal.seasonLength);
}

/** New calendar with a different season length. Today keeps its date (the day is capped to the new length). */
export function changeSeasonLength(cal: Calendar, today: number, len: SeasonLength): Calendar {
  const d = dateOf(today, cal);
  return { seasonLength: len, anchorDay: today, anchorDate: { ...d, day: Math.min(d.day, len) } };
}

/** Every season starts on a Sunday. */
export function weekday(d: SimDate): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[mod(d.day - 1, 7)];
}

export function formatDate(d: SimDate, style: 'full' | 'short' | 'seasonDay' | 'weekday' = 'full'): string {
  const s = SEASONS[d.season];
  if (style === 'short') return `${s} ${d.day}`;
  if (style === 'seasonDay') return `${s}, Day ${d.day}`;
  if (style === 'weekday') return `${weekday(d)}, ${s} ${d.day}`;
  return `Year ${d.year} · ${s} · Day ${d.day}`;
}

// ---------- life stages ----------
export type StageId = 'newborn' | 'infant' | 'toddler' | 'child' | 'teen' | 'youngAdult' | 'adult' | 'elder';
export const STAGE_IDS: StageId[] = ['newborn', 'infant', 'toddler', 'child', 'teen', 'youngAdult', 'adult', 'elder'];

export type Lifespan = { preset: 'short' | 'normal' | 'long' } | { preset: 'custom'; days: Partial<Record<StageId, number>> };

export type StageRow = { id: StageId; name: string; days: number; start: number };

const STAGE_NAMES: Record<StageId, string> = {
  newborn: 'Newborn', infant: 'Infant', toddler: 'Toddler', child: 'Child', teen: 'Teen',
  youngAdult: 'Young adult', adult: 'Adult', elder: 'Elder',
};
export const stageName = (id: StageId) => STAGE_NAMES[id];

/**
 * How long each life stage lasts, in whole days (half days round up, at least 1), and the age in days
 * on its first day. Elder has no end: its days are the minimum before the age bar is full.
 */
export function stageTable(lifespan: Lifespan): StageRow[] {
  let start = 0;
  return STAGE_IDS.map((id) => {
    const row = GAME.stages.find((s) => s.id === id);
    const base = lifespan.preset === 'custom' ? lifespan.days[id] ?? row?.normal ?? 1 : row?.[lifespan.preset] ?? 1;
    const days = Math.max(1, Math.ceil(base));
    const r = { id, name: STAGE_NAMES[id], days, start };
    start += days;
    return r;
  });
}

const stageIndex = (id: StageId) => STAGE_IDS.indexOf(id);

// ---------- a Sim's age ----------
export type Age =
  | { born: false; daysUntilBorn: number }
  | {
      born: true;
      ageDays: number;
      stage: StageId;
      /** 1 on the day they reach the stage. */
      dayInStage: number;
      stageDays: number;
      /** Not for elders. Matches the game's age bar: on day 1 of a 21-day stage it's 21. */
      birthdayIn?: number;
      birthdayDay?: number;
      nextStage?: StageId;
      /** Elders only: days lived as an elder, and whether their age bar is full ("final chapter"). */
      daysAsElder?: number;
      barFull?: boolean;
    };

export function ageOf(bornDay: number, today: number, table: StageRow[]): Age {
  const age = today - bornDay;
  if (age < 0) return { born: false, daysUntilBorn: -age };
  const row = [...table].reverse().find((r) => age >= r.start) ?? table[0];
  const inStage = age - row.start;
  if (row.id === 'elder') {
    return { born: true, ageDays: age, stage: 'elder', dayInStage: inStage + 1, stageDays: row.days, daysAsElder: inStage, barFull: inStage >= row.days };
  }
  const birthdayIn = row.days - inStage;
  return {
    born: true, ageDays: age, stage: row.id, dayInStage: inStage + 1, stageDays: row.days,
    birthdayIn, birthdayDay: today + birthdayIn, nextStage: STAGE_IDS[stageIndex(row.id) + 1],
  };
}

/**
 * The day a Sim was born, from what the Add Sim form asks.
 * - Fresh from Create a Sim: day 1 of the stage today.
 * - Already playing them: "Birthday in N days" (1 to the stage length), or for elders "Days as an elder".
 */
export function bornDayFor(
  input: { stage: StageId; fresh: true } | { stage: StageId; fresh: false; birthdayIn?: number; daysAsElder?: number },
  today: number,
  table: StageRow[],
): number {
  const row = table[stageIndex(input.stage)];
  let inStage = 0;
  if (!input.fresh) {
    if (input.stage === 'elder') inStage = Math.max(0, Math.round(input.daysAsElder ?? 0));
    else inStage = row.days - clamp(Math.round(input.birthdayIn ?? row.days), 1, row.days);
  }
  return today - (row.start + inStage);
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Allowed range for the "Birthday in" box for a stage. */
export function birthdayInRange(stage: StageId, table: StageRow[]): { min: number; max: number } {
  return { min: 1, max: table[stageIndex(stage)].days };
}

/**
 * After a lifespan change: the new day the Sim was born, so they stay in the same stage, the same share
 * of the way through it (like the game). Elders keep their days as an elder, scaled the same way.
 */
export function rescaleBornDay(bornDay: number, today: number, from: StageRow[], to: StageRow[]): number {
  const a = ageOf(bornDay, today, from);
  if (!a.born) return bornDay;
  const i = stageIndex(a.stage);
  const share = (a.dayInStage - 1) / from[i].days;
  const inStage = Math.min(Math.round(share * to[i].days), a.stage === 'elder' ? Number.MAX_SAFE_INTEGER : to[i].days - 1);
  return today - (to[i].start + inStage);
}

// ---------- birthdays (age-ups) ----------
export type Birthday = { simId: string; day: number; toStage: StageId };

/**
 * Birthdays between two days: after `fromDay`, up to and including `toDay`. A Sim's own first day
 * (when they were added) never counts, which fixes v1's "ages up today" bug.
 */
export function birthdaysBetween(
  sims: { id: string; bornDay: number; addedDay?: number }[],
  fromDay: number,
  toDay: number,
  table: StageRow[],
): Birthday[] {
  const out: Birthday[] = [];
  for (const s of sims) {
    for (const row of table.slice(1)) {
      const day = s.bornDay + row.start;
      if (day > fromDay && day <= toDay && (s.addedDay === undefined || day > s.addedDay)) out.push({ simId: s.id, day, toStage: row.id });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

/** The day an elder's age bar fills (their "final chapter" starts). */
export function finalChapterDay(bornDay: number, table: StageRow[]): number {
  const elder = table[table.length - 1];
  return bornDay + elder.start + elder.days;
}

// ---------- dates that aren't exact (Storylines) ----------
/** "−3" for year -3 (a real minus sign). */
export const yearText = (y: number) => (y < 0 ? `\u2212${-y}` : String(y));

/** The stand-in day number for "some time in this season" (its middle day) or "some time in this year" (the start of Fall, the middle of the year). */
export function approxDay(kind: 'season' | 'year', year: number, season: Season, cal: Calendar): number {
  const len = cal.seasonLength;
  return dayOf(kind === 'season' ? { year, season, day: Math.ceil(len / 2) } : { year, season: 2, day: 1 }, cal);
}
