/**
 * The calendar: holidays (every year), events (one day, a host and who's going), vacations (several
 * days, who’s going, an optional world) and birthdays (Sims' age-ups, worked out from their ages).
 *
 * Events and vacations store day numbers (the same numbers as the save's `today`), so they stay put
 * when the season length changes. Holidays store a season and day and repeat every year; a day past
 * the season's end shows on its last day.
 */
import { birthdaysBetween, dateIndex, dateOf, dayOf, type Calendar, type Season, type StageId, type StageRow } from './time';
import type { Rec } from './sync/types';
import { DEFAULT_EVENT_BANNER, DEFAULT_HOLIDAY_BANNER, DEFAULT_TRIP_BANNER, EVENT_BANNERS, HOLIDAY_BANNERS, TRIP_BANNERS } from '../components/bannerIds';

export type HolidayData = { name: string; season: Season; day: number; banner: string; traditions: string[]; notes: string };
export type EventData = { name: string; day: number; banner: string; host: string | null; going: string[]; notes: string };
/** A vacation stays at a hotel or vacation rental; a getaway is hosted at any lot. Both take the same plane and header. */
export type TripKind = 'vacation' | 'getaway';
export type VacationData = { name: string; kind: TripKind; banner: string; from: number; to: number; going: string[]; world: string | null; stay: string | null; notes: string };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function holidayData(r: Rec | undefined): HolidayData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  return { name: str(d.name), season: (Math.min(3, Math.max(0, num(d.season))) as Season), day: Math.max(1, num(d.day, 1)), banner: (HOLIDAY_BANNERS as readonly string[]).includes(str(d.banner)) ? str(d.banner) : DEFAULT_HOLIDAY_BANNER, traditions: ids(d.traditions), notes: str(d.notes) };
}
export function eventData(r: Rec | undefined): EventData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  return { name: str(d.name), day: num(d.day), banner: (EVENT_BANNERS as readonly string[]).includes(str(d.banner)) ? str(d.banner) : DEFAULT_EVENT_BANNER, host: typeof d.host === 'string' ? d.host : null, going: ids(d.going), notes: str(d.notes) };
}
export function vacationData(r: Rec | undefined): VacationData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const from = num(d.from);
  return { name: str(d.name), kind: d.kind === 'getaway' ? 'getaway' : 'vacation', banner: (TRIP_BANNERS as readonly string[]).includes(str(d.banner)) ? str(d.banner) : DEFAULT_TRIP_BANNER, from, to: Math.max(from, num(d.to, from)), going: ids(d.going), world: typeof d.world === 'string' ? d.world : null, stay: typeof d.stay === 'string' ? d.stay : null, notes: str(d.notes) };
}

export type Kind = 'holiday' | 'event' | 'birthday' | 'vacation';
/** One thing on the calendar, on one day (vacations span `day`..`end`). */
export type CalItem = {
  key: string;
  kind: Kind;
  /** The record's id (the Sim's id for birthdays). */
  id: string;
  name: string;
  day: number;
  end: number;
  /** Everyone linked: the birthday Sim, an event's host and guests, a vacation's travelers. */
  sims: string[];
  host: string | null;
  /** Vacations only: a getaway (hosted at any lot) rather than a vacation. */
  getaway?: boolean;
  toStage?: StageId;
};

/** The day number a holiday falls on in one year. */
export function holidayDay(h: Pick<HolidayData, 'season' | 'day'>, year: number, cal: Calendar): number {
  return dayOf({ year, season: h.season, day: Math.min(h.day, cal.seasonLength) }, cal);
}

/** The next day (today or later) a holiday falls on. */
export function nextHolidayDay(h: Pick<HolidayData, 'season' | 'day'>, today: number, cal: Calendar): number {
  const year = dateOf(today, cal).year;
  const d = holidayDay(h, year, cal);
  return d >= today ? d : holidayDay(h, year + 1, cal);
}

/** Which years the days from..to touch. */
function yearsBetween(from: number, to: number, cal: Calendar): number[] {
  const yearOf = (day: number) => Math.floor((dateIndex(cal.anchorDate, cal.seasonLength) + day - cal.anchorDay) / (4 * cal.seasonLength)) + 1;
  const out: number[] = [];
  for (let y = yearOf(from); y <= yearOf(to); y++) out.push(y);
  return out;
}

export type CalState = {
  holidays: { id: string; data: HolidayData }[];
  events: { id: string; data: EventData }[];
  vacations: { id: string; data: VacationData }[];
  /** Living Sims with a known birth day. */
  sims: { id: string; name: string; bornDay: number; addedDay?: number }[];
  table: StageRow[];
  cal: Calendar;
};

/** Everything on the calendar between two days (both included), sorted by day. */
export function itemsBetween(s: CalState, from: number, to: number): CalItem[] {
  const out: CalItem[] = [];
  for (const h of s.holidays) {
    for (const y of yearsBetween(from, to, s.cal)) {
      const day = holidayDay(h.data, y, s.cal);
      if (day >= from && day <= to) out.push({ key: `h:${h.id}:${y}`, kind: 'holiday', id: h.id, name: h.data.name || 'Holiday', day, end: day, sims: [], host: null });
    }
  }
  for (const e of s.events) {
    if (e.data.day >= from && e.data.day <= to) {
      const sims = [...(e.data.host ? [e.data.host] : []), ...e.data.going.filter((g) => g !== e.data.host)];
      out.push({ key: `e:${e.id}`, kind: 'event', id: e.id, name: e.data.name || 'Event', day: e.data.day, end: e.data.day, sims, host: e.data.host });
    }
  }
  for (const v of s.vacations) {
    if (v.data.to >= from && v.data.from <= to) out.push({ key: `v:${v.id}`, kind: 'vacation', id: v.id, name: v.data.name || (v.data.kind === 'getaway' ? 'Getaway' : 'Vacation'), day: v.data.from, end: v.data.to, sims: v.data.going, host: null, getaway: v.data.kind === 'getaway' });
  }
  for (const b of birthdaysBetween(s.sims, from - 1, to, s.table)) {
    const sim = s.sims.find((x) => x.id === b.simId)!;
    out.push({ key: `b:${b.simId}:${b.day}`, kind: 'birthday', id: b.simId, name: sim.name, day: b.day, end: b.day, sims: [b.simId], host: null, toStage: b.toStage });
  }
  const order: Record<Kind, number> = { vacation: 0, holiday: 1, birthday: 2, event: 3 };
  return out.sort((a, b) => a.day - b.day || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
}

/** The next few things for some Sims (a profile or a household page), from today on. Holidays aren't linked to Sims. */
export function comingUp(s: CalState, simIds: string[], today: number, count = 3, horizon = 400): CalItem[] {
  const mine = new Set(simIds);
  const hadBirthday = new Set<string>();
  return itemsBetween(s, today, today + horizon)
    .filter((i) => i.kind !== 'holiday' && i.sims.some((x) => mine.has(x)) && i.end >= today)
    // Only each Sim's next birthday: later ones show on the calendar.
    .filter((i) => i.kind !== 'birthday' || (!hadBirthday.has(i.id) && !!hadBirthday.add(i.id)))
    .slice(0, count);
}

/** Day numbers of the first and last day of a season. */
export function seasonRange(year: number, season: Season, cal: Calendar): [number, number] {
  const start = dayOf({ year, season, day: 1 }, cal);
  return [start, start + cal.seasonLength - 1];
}
export function nextSeason(year: number, season: Season, step: 1 | -1): { year: number; season: Season } {
  const i = (year - 1) * 4 + season + step;
  return { year: Math.floor(i / 4) + 1, season: (((i % 4) + 4) % 4) as Season };
}
