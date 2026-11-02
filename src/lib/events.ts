import { addDays, ageUpsBetween, annualBetween, birthdaysBetween, toIndex, weekdayOf, type StageRow } from './time';
import type { Club, Holiday, LifeStageId, Save, Sim, SimDate } from './types';

export interface CalEvent {
  date: SimDate;
  idx: number;
  kind: 'ageUp' | 'birthday' | 'holiday' | 'club';
  refId: string;
  label: string;
  stage?: LifeStageId;
}

/** Everything on the calendar between two dates (inclusive). */
export function eventsBetween(
  save: Save,
  from: SimDate,
  to: SimDate,
  data: { sims: Sim[]; holidays: Holiday[]; clubs: Club[] },
  table?: StageRow[],
): CalEvent[] {
  const len = save.seasonLength;
  const out: CalEvent[] = [];
  const push = (e: Omit<CalEvent, 'idx'>) => out.push({ ...e, idx: toIndex(e.date, len) });
  for (const s of data.sims) {
    if (!s.birthday || s.deceased) continue;
    const name = s.firstName;
    if (save.trackDate)
      for (const u of ageUpsBetween(s.birthday, from, to, len, save.lifespan, table))
        push({ date: u.date, kind: 'ageUp', refId: s.id, label: name, stage: u.stage });
    for (const d of birthdaysBetween(s.birthday, from, to, len)) push({ date: d, kind: 'birthday', refId: s.id, label: name });
  }
  for (const h of data.holidays)
    for (const d of annualBetween(h.season, h.day, from, to, len))
      if (h.repeats || d.year === h.year) push({ date: d, kind: 'holiday', refId: h.id, label: h.name });
  const lo = toIndex(from, len);
  const hi = toIndex(to, len);
  for (const c of data.clubs) {
    if (!c.meets) continue;
    // first matching weekday on or after `from`
    const first = (c.meets.weekday - weekdayOf(from, len) + 7) % 7;
    for (let i = lo + first; i <= hi; i += 7) push({ date: addDays(from, i - lo, len), kind: 'club', refId: c.id, label: c.name });
  }
  const rank = { holiday: 0, ageUp: 1, birthday: 2, club: 3 };
  return out.sort((a, b) => a.idx - b.idx || rank[a.kind] - rank[b.kind]);
}
