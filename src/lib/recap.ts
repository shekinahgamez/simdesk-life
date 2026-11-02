import { ageUpsBetween, addDays, annualBetween, birthdaysBetween, ageInfo, type StageRow } from './time';
import type { Holiday, LifeStageId, Save, Sim, SimDate } from './types';

export interface RecapItem {
  date: SimDate;
  kind: 'ageUp' | 'birthday' | 'holiday' | 'season' | 'oldAge';
  simId?: string;
  holidayId?: string;
  stage?: LifeStageId;
  label: string;
}

/** Everything that happened between the old date (exclusive) and the new one (inclusive). Nothing needs backfilling. */
export function recapBetween(save: Save, to: SimDate, sims: Sim[], holidays: Holiday[], table?: StageRow[]): RecapItem[] {
  const len = save.seasonLength;
  const from = addDays(save.date, 1, len);
  const items: RecapItem[] = [];
  for (const s of sims) {
    if (!s.birthday || s.deceased) continue;
    const name = `${s.firstName} ${s.lastName}`.trim();
    for (const u of ageUpsBetween(s.birthday, from, to, len, save.lifespan, table))
      items.push({ date: u.date, kind: 'ageUp', simId: s.id, stage: u.stage, label: name });
    for (const d of birthdaysBetween(s.birthday, from, to, len)) items.push({ date: d, kind: 'birthday', simId: s.id, label: name });
    const before = ageInfo(s.birthday, save.date, len, save.lifespan, table);
    const after = ageInfo(s.birthday, to, len, save.lifespan, table);
    if (after.oldAgeAnyDay && !before.oldAgeAnyDay) items.push({ date: to, kind: 'oldAge', simId: s.id, label: name });
  }
  for (const h of holidays) {
    const hits = annualBetween(h.season, h.day, from, to, len).filter((d) => h.repeats || d.year === h.year);
    for (const d of hits) items.push({ date: d, kind: 'holiday', holidayId: h.id, label: h.name });
  }
  const sorted = items.sort((a, b) => a.date.year - b.date.year || a.date.season - b.date.season || a.date.day - b.date.day);
  return sorted;
}

export function recapHeadline(days: number, items: RecapItem[]) {
  const bdays = items.filter((i) => i.kind === 'birthday' || i.kind === 'ageUp');
  const simsWithBday = new Set(bdays.map((i) => i.simId)).size;
  const hols = items.filter((i) => i.kind === 'holiday').length;
  const p = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (!items.length) return `Jumped ahead ${p(days, 'day')}. Quiet stretch. All caught up. Go play!`;
  return `Jumped ahead ${p(days, 'day')}. ${p(simsWithBday, 'birthday')}, ${p(hols, 'holiday')}, 0 drama (that we know of).`;
}
