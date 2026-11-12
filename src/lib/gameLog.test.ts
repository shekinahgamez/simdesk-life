import { describe, expect, it } from 'vitest';
import { applyMoney, matchTrait, parseLog, planImport, type Ctx } from './gameLog';
import { BLANK_SIM, type SimData } from './sims';
import { moneyData } from './money';
import { newCalendar, stageTable } from './time';

const table = stageTable({ preset: 'normal' });
const file = (over: Record<string, unknown> = {}) => JSON.stringify({
  format: 'simdesk-log', version: 1, loggedAt: '2026-11-07T10:00:00',
  game: { absoluteDay: 33 },
  household: { id: 7, name: 'Harlow', sims: [
    { id: 1, first: 'Darnell', last: 'Harlow', gender: 'male', age: { stage: 'ADULT' }, traits: [{ name: 'Ambitious' }, { name: 'Brand New Mod Trait' }], aspiration: null, career: { name: 'Doctor', level: 7 }, deceased: false },
    { id: 2, first: 'Nia', last: 'Harlow', gender: 'female', age: { stage: 'TEEN' }, traits: [], aspiration: null, career: null, deceased: false },
    { id: 3, first: 'Baby', last: 'Harlow', gender: 'female', age: { stage: 'INFANT' }, traits: [], aspiration: null, career: null, deceased: false },
  ] },
  money: { funds: 12450, snbAccounts: [{ id: 'a1', name: 'Main', type: 'CHECKING', owners: [1], balance: 3200 }] },
  skipped: [], ...over,
});
const sim = (over: Partial<SimData>): SimData => ({ ...BLANK_SIM, ...over });
let n = 0;
const ctx = (over: Partial<Ctx> = {}): Ctx => ({
  sims: [], households: [], today: 100, calendar: newCalendar(21, 0), trackDate: true, table,
  rotation: null, link: null, money: null, newId: () => `new${++n}`, ...over,
});
const log = () => { const r = parseLog(file()); if (!('log' in r)) throw new Error(r.error); return r.log; };

describe('parseLog', () => {
  it('reads a good file', () => {
    const l = log();
    expect(l.household.sims).toHaveLength(3);
    expect(l.household.sims[2].stage).toBe('infant');
    expect(l.snb?.[0]).toMatchObject({ id: 'a1', type: 'CHECKING', owners: ['1'], balance: 3200 });
  });
  it('refuses other files with a plain message', () => {
    expect(parseLog('nope')).toHaveProperty('error');
    expect(parseLog('{"a":1}')).toHaveProperty('error');
    expect(parseLog(file({ version: 2 }))).toHaveProperty('error');
  });
});

describe('matching game names', () => {
  it('finds SimDesk traits however the game spells them', () => {
    expect(matchTrait('Ambitious')).toBe('ambitious');
    expect(matchTrait('trait_Ambitious')).toBe('ambitious');
    expect(matchTrait('Not A Real Trait')).toBeNull();
  });
});

describe('planImport', () => {
  it('makes new Sims and a new household when nothing matches', () => {
    const p = planImport(log(), ctx());
    expect(p.householdIsNew).toBe(true);
    expect(p.sims.every((s) => s.isNew)).toBe(true);
    expect(p.sims[0].create).toMatchObject({ first: 'Darnell', gameId: '1', traits: ['ambitious'], career: 'Doctor', careerLevel: 7 });
    expect(p.notes.join(' ')).toContain('Brand New Mod Trait');
  });
  it('matches by name, links the id, and lists only real changes', () => {
    const darnell = sim({ first: 'Darnell', last: 'Harlow', gender: 'male', bornDay: 100 - table[6].start - 5, traits: ['ambitious'], career: 'Doctor', careerLevel: 7 });
    const p = planImport(log(), ctx({ sims: [{ id: 's1', data: darnell }], households: [{ id: 'h1', name: 'Harlow' }] }));
    const d = p.sims.find((s) => s.simId === 's1')!;
    expect(d.isNew).toBe(false);
    expect(d.changes).toHaveLength(0);
    expect(p.quiet).toContain('Darnell');
    expect(p.notes.join(' ')).toContain('Matched by name');
    expect(p.householdIsNew).toBe(false);
  });
  it('shows an age-up once, and only when the stage changed', () => {
    const nia = sim({ first: 'Nia', last: 'Harlow', bornDay: 100 - table[3].start - 3 }); // a child
    const p = planImport(log(), ctx({ sims: [{ id: 's2', data: nia }], households: [{ id: 'h1', name: 'Harlow household' }] }));
    const c = p.sims.find((s) => s.simId === 's2')!.changes[0];
    expect(c).toMatchObject({ kind: 'stage', was: 'Child', now: 'Teen', on: true });
    expect(c.patch.bornDay).toBe(100 - table[4].start);
  });
  it('never overwrites a typed career unless ticked', () => {
    const d = sim({ first: 'Darnell', last: 'Harlow', career: 'Head of Surgery, Mercy', careerLevel: null, bornDay: 100 - table[6].start - 1 });
    const p = planImport(log(), ctx({ sims: [{ id: 's1', data: d }], households: [{ id: 'h1', name: 'Harlow' }] }));
    const c = p.sims.find((s) => s.simId === 's1')!.changes.find((x) => x.kind === 'career')!;
    expect(c.on).toBe(false);
    expect(c.note).toContain('your own title');
  });
  it('only ever adds traits', () => {
    const d = sim({ first: 'Darnell', last: 'Harlow', traits: ['custom:x', 'cheerful'], bornDay: 100 - table[6].start - 1, career: 'Doctor', careerLevel: 7 });
    const p = planImport(log(), ctx({ sims: [{ id: 's1', data: d }], households: [{ id: 'h1', name: 'Harlow' }] }));
    const c = p.sims.find((s) => s.simId === 's1')!.changes.find((x) => x.kind === 'traits')!;
    expect(c.patch.traits).toEqual(['custom:x', 'cheerful', 'ambitious']);
  });
  it('first import links the date; later imports move it by the game’s change', () => {
    expect(planImport(log(), ctx()).date).toBeNull();
    expect(planImport(log(), ctx()).linkNote).toContain('game day 33');
    const p = planImport(log(), ctx({ link: { game: 30, desk: 98 } }));
    expect(p.date).toMatchObject({ was: 100, now: 101 });
    expect(planImport(log(), ctx({ link: { game: 33, desk: 100 } })).date).toBeNull();
    expect(planImport(log(), ctx({ link: { game: 40, desk: 100 } })).date).toBeNull(); // game is behind: never goes back
  });
  it('starts the turn only when the household is in rotation and not playing', () => {
    const base = { households: [{ id: 'h1', name: 'Harlow' }] };
    expect(planImport(log(), ctx({ ...base, rotation: { current: 'h2', order: ['h1', 'h2'] } })).turn).toMatchObject({ on: true });
    expect(planImport(log(), ctx({ ...base, rotation: { current: 'h1', order: ['h1', 'h2'] } })).turn).toBeNull();
    expect(planImport(log(), ctx({ ...base, rotation: null })).turn).toBeNull();
  });
  it('money: funds and SNB rows, skipped when unchanged, owners follow the matched Sims', () => {
    const m = moneyData(undefined, 'h1');
    const p = planImport(log(), ctx({ households: [{ id: 'h1', name: 'Harlow' }], money: { data: { ...m, funds: 11800 }, snb: true } }));
    expect(p.money.map((r) => r.id)).toEqual(['money:funds', 'money:snb:a1']);
    const out = applyMoney({ ...m, funds: 11800 }, p.money);
    expect(out.funds).toBe(12450);
    expect(out.items[0]).toMatchObject({ id: 'snb:a1', type: 'snb-checking', amount: 3200 });
    expect(out.items[0].owners).toHaveLength(1);
    const again = planImport(log(), ctx({ households: [{ id: 'h1', name: 'Harlow' }], money: { data: out, snb: true } }));
    expect(again.money).toHaveLength(0);
  });
  it('SNB off: says so and imports nothing', () => {
    const p = planImport(log(), ctx({ money: { data: moneyData(undefined, 'h1'), snb: false } }));
    expect(p.money.map((r) => r.kind)).toEqual(['funds']);
    expect(p.notes.join(' ')).toContain('Turn on SNB');
  });
});
