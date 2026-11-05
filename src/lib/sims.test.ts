import { describe, expect, it } from 'vitest';
import {
  applyFilters, birthdayCell, BLANK_SIM, householdLabel, NO_FILTERS, relLabel, simAge, sortRows, splitName, type SimRow,
} from './sims';
import { bornDayFor, newCalendar, stageTable } from './time';

const table = stageTable({ preset: 'normal' });
const cal = newCalendar(28, 0);
const row = (id: string, first: string, last: string, extra: Partial<typeof BLANK_SIM>, today = 100): SimRow => {
  const sim = { ...BLANK_SIM, first, last, ...extra };
  const age = simAge(sim, today, table, true);
  return { id, sim, name: `${first} ${last}`, household: '', age, stage: age.kind === 'age' ? age.age.stage : null, realAge: null, realAgeShort: null };
};

describe('household names', () => {
  it('adds "household" to a plain name', () => expect(householdLabel('Okafor')).toBe('Okafor household'));
  it('keeps names that already say it', () => {
    expect(householdLabel('Okafor household')).toBe('Okafor household');
    expect(householdLabel('Goth Family')).toBe('Goth Family');
    expect(householdLabel('The Goths')).toBe('The Goths');
  });
});

describe('birthdays in lists', () => {
  it('a Sim fresh from Create a Sim has a full stage to go, not "today"', () => {
    const born = bornDayFor({ stage: 'youngAdult', fresh: true }, 100, table);
    const r = row('a', 'Ava', 'Ng', { bornDay: born, addedDay: 100 });
    const c = birthdayCell(r.age, cal, 'countdown', false)!;
    expect(c.text).not.toBe('today');
    expect(c.text).toMatch(/^in \d+ days$/);
    expect(c.soon).toBe(false);
  });
  it('shows soon within a week, and the date view', () => {
    const born = bornDayFor({ stage: 'adult', fresh: false, birthdayIn: 3 }, 100, table);
    const r = row('a', 'Des', 'Okafor', { bornDay: born });
    expect(birthdayCell(r.age, cal, 'countdown', false)).toEqual({ text: 'in 3 days', soon: true });
    expect(birthdayCell(r.age, cal, 'date', false)!.text).toMatch(/^(Spring|Summer|Fall|Winter) \d+$/);
  });
  it('elders with a full bar read "Final chapter"; deceased show nothing', () => {
    const born = bornDayFor({ stage: 'elder', fresh: false, daysAsElder: 999 }, 100, table);
    const r = row('a', 'Ngozi', 'Okafor', { bornDay: born });
    expect(birthdayCell(r.age, cal, 'countdown', false)).toEqual({ text: 'Final chapter', soon: false, final: true });
    expect(birthdayCell(r.age, cal, 'countdown', true)).toBeNull();
  });
});

describe('filters and sorting', () => {
  const rows = [
    row('1', 'Rafael', 'Banks', { bornDay: bornDayFor({ stage: 'adult', fresh: false, birthdayIn: 13 }, 100, table), gender: 'male' }),
    row('2', 'Adaeze', 'Okafor', { bornDay: bornDayFor({ stage: 'youngAdult', fresh: false, birthdayIn: 22 }, 100, table), householdId: 'h1', gender: 'female' }),
    row('3', 'Desmond', 'Okafor', { bornDay: bornDayFor({ stage: 'adult', fresh: false, birthdayIn: 3 }, 100, table), householdId: 'h1', gender: 'male' }),
    row('4', 'Chidi', 'Okafor', { bornDay: 0, householdId: 'h1', deceased: { day: 90, cause: '', notes: '' } }),
  ];
  it('hides deceased unless asked, then shows only them', () => {
    expect(applyFilters(rows, NO_FILTERS).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(applyFilters(rows, { ...NO_FILTERS, deceased: true }).map((r) => r.id)).toEqual(['4']);
  });
  it('filters by household, gender, stage and birthday this week', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, households: ['h1'] }).map((r) => r.id)).toEqual(['2', '3']);
    expect(applyFilters(rows, { ...NO_FILTERS, households: ['none'] }).map((r) => r.id)).toEqual(['1']);
    expect(applyFilters(rows, { ...NO_FILTERS, genders: ['male'] }).map((r) => r.id)).toEqual(['1', '3']);
    expect(applyFilters(rows, { ...NO_FILTERS, stages: ['youngAdult'] }).map((r) => r.id)).toEqual(['2']);
    expect(applyFilters(rows, { ...NO_FILTERS, birthdayThisWeek: true }).map((r) => r.id)).toEqual(['3']);
  });
  it('sorts by last name then first, and by soonest birthday', () => {
    expect(sortRows(rows.slice(0, 3), { key: 'name', dir: 1 }).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(sortRows(rows.slice(0, 3), { key: 'birthday', dir: 1 }).map((r) => r.id)).toEqual(['3', '1', '2']);
    expect(sortRows(rows.slice(0, 3), { key: 'name', dir: -1 }).map((r) => r.id)).toEqual(['3', '2', '1']);
  });
});

describe('quick add names', () => {
  it('last word is the last name', () => {
    expect(splitName('  Mary  Jane Watson ')).toEqual({ first: 'Mary Jane', last: 'Watson' });
    expect(splitName('Cher')).toEqual({ first: 'Cher', last: '' });
  });
});

describe('relationship labels', () => {
  it('each side has its own label', () => {
    const r = { a: 'dad', b: 'kid', type: 'parent' as const, labelA: '', labelB: 'Biological father', secret: true };
    expect(relLabel(r, 'kid')).toBe('Biological father');
    expect(relLabel(r, 'dad')).toBe('Child');
  });
});
