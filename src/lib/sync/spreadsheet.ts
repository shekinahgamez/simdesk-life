import { APP } from '../../config/app';
import { eventData, holidayData, vacationData } from '../calendar';
import { clubData } from '../clubs';
import { lotData, lotTypeName, spotById } from '../lots';
import { saveData, tableOf } from '../saves';
import {
  aspirationName, careerText, fullName, genderName, householdName, occultName, relData, relLabel, simAge, simData,
  stageLabel, stageOf, traitName, type CustomTrait,
} from '../sims';
import { dateOf, formatDate, SEASONS } from '../time';
import type { SyncStore } from './store';
import type { Rec } from './types';

type Row = Record<string, string | number>;

/** One save as plain tables, one per tab: something to read or sort outside SimDesk (it can't be restored). */
export function spreadsheetTables(saveRaw: Record<string, unknown>, recs: Rec[], custom: CustomTrait[]): Record<string, Row[]> {
  const d = saveData({ data: saveRaw } as never);
  const table = tableOf(d);
  const day = (n: number | null) => (n === null || !d.trackDate ? '' : `${formatDate(dateOf(n, d.calendar), 'short')}, Year ${dateOf(n, d.calendar).year}`);
  const of = (k: string) => recs.filter((r) => r.kind === k);
  const sims = new Map(of('sim').map((r) => [r.id, simData(r)]));
  const hhs = new Map(of('household').map((r) => [r.id, householdName(r)]));
  const lots = new Map(of('lot').map((r) => [r.id, lotData(r)]));
  const simName = (id: string | null) => (id && sims.has(id) ? fullName(sims.get(id)!) : '');
  const names = (ids: string[]) => ids.map(simName).filter(Boolean).join(', ');
  const byName = (a: Row, b: Row) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0]), undefined, { sensitivity: 'base' });

  const simRows: Row[] = [...sims].map(([, s]) => {
    const age = simAge(s, d.today, table, d.trackDate);
    return {
      Name: fullName(s), Household: s.householdId ? hhs.get(s.householdId) ?? '' : '', 'Life stage': stageLabel(stageOf(age)),
      Birthday: day(s.bornDay), Gender: genderName(s.gender), Pronouns: s.pronouns, Orientation: s.orientation,
      Traits: s.traits.map((t) => traitName(t, custom)).join(', '), Aspiration: aspirationName(s.aspiration), 'Occult': occultName(s.occult),
      Career: careerText(s), Passed: s.deceased ? (day(s.deceased.day) || 'Yes') : '', 'Cause': s.deceased?.cause ?? '', Notes: s.notes,
    };
  }).sort(byName);

  const hhRows: Row[] = [...hhs].map(([id, name]) => {
    const members = [...sims].filter(([, s]) => s.householdId === id && !s.deceased).map(([, s]) => fullName(s));
    const home = [...lots.values()].filter((l) => l.owner === id).map((l) => l.name).join(', ');
    return { Household: name, Sims: members.length, Members: members.join(', '), 'Lots they own': home };
  }).sort(byName);

  const lotRows: Row[] = [...lots.values()].map((l) => ({
    Lot: l.name, Type: lotTypeName(l.type), Size: l.size, Price: l.price ?? '', Spot: spotById(l.spot)?.name ?? '',
    Owner: l.owner ? hhs.get(l.owner) ?? '' : '', Creator: l.credits, 'Gallery ID': l.galleryId, Notes: l.notes,
  })).sort(byName);

  const relRows: Row[] = of('rel').map((r) => {
    const x = relData(r);
    return { Sim: simName(x.a), 'Other Sim': simName(x.b), 'Other Sim is their': relLabel(x, x.a), Secret: x.secret ? 'Yes' : '' };
  }).sort(byName);

  const calRows: Row[] = [
    ...of('holiday').map((r) => { const h = holidayData(r); return { Name: h.name, Kind: 'Holiday', When: `${SEASONS[h.season]} ${h.day} (every year)`, Who: '', Notes: h.notes }; }),
    ...of('event').map((r) => { const e = eventData(r); return { Name: e.name, Kind: 'Event', When: day(e.day), Who: names(e.going), Notes: e.notes }; }),
    ...of('vacation').map((r) => { const v = vacationData(r); return { Name: v.name, Kind: v.kind === 'getaway' ? 'Getaway' : 'Vacation', When: `${day(v.from)} to ${day(v.to)}`, Who: names(v.going), Notes: v.notes }; }),
  ];

  const clubRows: Row[] = of('club').map((r) => {
    const c = clubData(r);
    return {
      Club: c.name, Leader: simName(c.leader), Members: names(c.members), Joining: c.admission === 'open' ? 'Open' : 'Invite only',
      'Meets at': c.place ? (c.place.kind === 'lot' ? lots.get(c.place.id)?.name ?? '' : lotTypeName(c.place.id)) : '',
      Encouraged: c.encouraged.map((a) => a.text).join(', '), Banned: c.banned.map((a) => a.text).join(', '), Notes: c.notes,
    };
  }).sort(byName);

  const out: Record<string, Row[]> = { Sims: simRows, Households: hhRows, Lots: lotRows, Relationships: relRows, Calendar: calRows, Clubs: clubRows };
  for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
  return out;
}

/** Builds the spreadsheet (.xlsx) for one save and downloads it. The spreadsheet code loads only when asked for. */
export async function downloadSpreadsheet(store: SyncStore, saveId: string, custom: CustomTrait[]): Promise<boolean> {
  const save = store.saves.get(saveId);
  if (!save) return false;
  const recs = (await store.allRecords(saveId)).filter((r) => !r.deleted_at);
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(spreadsheetTables(save.data, recs, custom))) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const keys = Object.keys(rows[0]);
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const slug = (save.data.name || 'save').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save';
  XLSX.writeFile(wb, `${APP.wordmark}-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
}
