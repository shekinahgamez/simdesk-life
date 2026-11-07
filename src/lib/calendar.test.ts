import { describe, expect, it } from 'vitest';
import { comingUp, eventData, holidayData, holidayDay, itemsBetween, nextHolidayDay, nextSeason, seasonRange, vacationData, type CalState } from './calendar';
import { newCalendar, stageTable, changeSeasonLength } from './time';

const cal = newCalendar(28, 0); // Year 1 Spring 1 = day 0
const table = stageTable({ preset: 'normal' });
const base = (): CalState => ({
  holidays: [{ id: 'love', data: { name: 'Love Day', season: 0, day: 7, banner: 'loveday', traditions: [], notes: '' } }],
  events: [{ id: 'party', data: { name: 'Party', day: 13, banner: 'party', host: 'mo', going: ['ao', 'mo'], notes: '' } }],
  vacations: [{ id: 'trip', data: { name: 'Trip', from: 17, to: 20, going: ['mo', 'do'], world: null, kind: 'vacation', banner: 'vacation', stay: null, notes: '' } }],
  sims: [],
  table,
  cal,
});

describe('calendar', () => {
  it('holidays repeat every year', () => {
    expect(holidayDay({ season: 0, day: 7 }, 1, cal)).toBe(6);
    expect(holidayDay({ season: 0, day: 7 }, 2, cal)).toBe(6 + 112);
    const all = itemsBetween(base(), 0, 300).filter((i) => i.kind === 'holiday').map((i) => i.day);
    expect(all).toEqual([6, 118, 230]);
  });
  it('a holiday past a shorter season shows on the last day', () => {
    const short = changeSeasonLength(cal, 0, 7);
    expect(holidayDay({ season: 0, day: 24 }, 1, short)).toBe(6);
  });
  it('lists one season, vacations overlapping its edges included', () => {
    const s = base();
    s.vacations.push({ id: 'edge', data: { name: 'Edge', from: 25, to: 30, going: [], world: null, kind: 'vacation', banner: 'vacation', stay: null, notes: '' } });
    const keys = itemsBetween(s, ...seasonRange(1, 0, cal)).map((i) => i.key);
    expect(keys).toEqual(['h:love:1', 'e:party', 'v:trip', 'v:edge']);
    expect(itemsBetween(s, ...seasonRange(1, 1, cal)).map((i) => i.key)).toEqual(['v:edge']);
  });
  it('event host comes first and is not listed twice', () => {
    expect(itemsBetween(base(), 13, 13)[0].sims).toEqual(['mo', 'ao']);
  });
  it('birthdays come from ages', () => {
    const s = base();
    s.sims = [{ id: 'do', name: 'Desmond', bornDay: -table.find((r) => r.id === 'elder')!.start + 10, addedDay: 0 }];
    const b = itemsBetween(s, 0, 27).find((i) => i.kind === 'birthday')!;
    expect(b).toMatchObject({ day: 10, toStage: 'elder', sims: ['do'] });
  });
  it('coming up: the next 3 for these Sims, holidays left out, ongoing vacations included', () => {
    const s = base();
    expect(comingUp(s, ['mo'], 0).map((i) => i.key)).toEqual(['e:party', 'v:trip']);
    expect(comingUp(s, ['mo'], 19).map((i) => i.key)).toEqual(['v:trip']);
    expect(comingUp(s, ['zz'], 0)).toEqual([]);
  });
  it('coming up: only each Sim\u2019s next birthday', () => {
    const s = base();
    s.events = []; s.vacations = [];
    // A toddler ages up again and again within the year; only the next one shows.
    s.sims = [
      { id: 'kid', name: 'Kid', bornDay: -table.find((r) => r.id === 'toddler')!.start - 2, addedDay: 0 },
      { id: 'mom', name: 'Mom', bornDay: -table.find((r) => r.id === 'adult')!.start + 30, addedDay: 0 },
    ];
    const all = itemsBetween(s, 0, 400).filter((i) => i.kind === 'birthday' && i.id === 'kid');
    expect(all.length).toBeGreaterThan(1);
    const list = comingUp(s, ['kid', 'mom'], 0, 5);
    expect(list.filter((i) => i.id === 'kid')).toHaveLength(1);
    expect(list.filter((i) => i.id === 'mom')).toHaveLength(1);
    expect(list.find((i) => i.id === 'kid')!.day).toBe(all[0].day);
  });
  it('finds the next time a holiday comes round', () => {
    expect(nextHolidayDay({ season: 0, day: 7 }, 0, cal)).toBe(6);
    expect(nextHolidayDay({ season: 0, day: 7 }, 6, cal)).toBe(6);
    expect(nextHolidayDay({ season: 0, day: 7 }, 7, cal)).toBe(6 + 112);
  });
  it('steps through seasons and years', () => {
    expect(nextSeason(1, 3, 1)).toEqual({ year: 2, season: 0 });
    expect(nextSeason(2, 0, -1)).toEqual({ year: 1, season: 3 });
  });
  it('banners fall back to a default, and trips know if they are getaways', () => {
    expect(holidayData({ data: { name: 'X', banner: 'nope' } } as never).banner).toBe('classic');
    expect(holidayData({ data: { name: 'X', banner: 'juneteenth' } } as never).banner).toBe('juneteenth');
    expect(eventData({ data: { name: 'X' } } as never).banner).toBe('party');
    expect(eventData({ data: { name: 'X', banner: 'juneteenth' } } as never).banner).toBe('party'); // a holiday banner is not an event banner
    expect(vacationData({ data: { name: 'X' } } as never).kind).toBe('vacation');
    expect(vacationData({ data: { name: 'X', kind: 'getaway', stay: 'lot1' } } as never)).toMatchObject({ kind: 'getaway', stay: 'lot1' });
    const s = base();
    s.vacations.push({ id: 'g', data: { name: 'Cabin weekend', from: 40, to: 41, going: [], world: null, kind: 'getaway', banner: 'cabin', stay: null, notes: '' } });
    expect(itemsBetween(s, 40, 41).find((i) => i.id === 'g')?.getaway).toBe(true);
  });
});
