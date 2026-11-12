import { describe, expect, it } from 'vitest';
import {
  addActivity, addReading, businessData, BLANK_BUSINESS, earned, guessSystem, kindList, lastChange, lifetimeOf, needsStart, removeRule, setRule, setStaff, setStart,
  showStartNote, signed, type BusinessData,
} from './businesses';

const rec = (data: Record<string, unknown>) => ({ id: 'b1', kind: 'business', edited_at: '', deleted_at: null, data });
const blank = (p: Partial<BusinessData> = {}): BusinessData => ({ ...BLANK_BUSINESS, name: 'Black Tea', ...p });

describe('businesses', () => {
  it('fills in a partial record', () => {
    const b = businessData(rec({ name: 'Rack', system: 'bogus', rating: 9, staff: [{ sim: 's1' }, { nope: 1 }], activities: ['a', 'b', 'c', 'd', 'e', 'f'] }));
    expect(b.system).toBe('small');
    expect(b.rating).toBe(5);
    expect(b.staff).toEqual([{ sim: 's1', role: '', pay: 'Medium' }]);
    expect(b.activities).toHaveLength(5);
  });
  it('keeps an editable list of kinds', () => {
    expect(kindList(undefined)).toContain('Vet clinic');
    expect(kindList(['Bar', ' Bar ', 'Salon'])).toEqual(['Bar', 'Salon']);
    expect(guessSystem('Vet clinic')).toBe('vet');
    expect(guessSystem('Cafe')).toBe('small');
  });
  it('first reading is the baseline and counts nothing', () => {
    const b = addReading(blank(), 5000, 3, '2026-11-08');
    expect(b.log).toHaveLength(1);
    expect(b.log[0].change).toBeNull();
    expect(earned(b)).toBe(0);
    expect(lifetimeOf(b)).toBe(5000);
  });
  it('later readings log the difference', () => {
    let b = addReading(blank(), 5000, 3, 'a');
    b = addReading(b, 5400, 4, 'b');
    b = addReading(b, 5400, 5, 'c');
    expect(b.log.map((r) => r.change)).toEqual([null, 400]);
    expect(lastChange(b)).toBe(400);
    expect(earned(b)).toBe(400);
  });
  it('uses the starting total as the first reference', () => {
    let b = setStart(blank({ system: 'retail' }), 10000);
    b = addReading(b, 10250, 1, 'a');
    expect(b.log[0].change).toBe(250);
  });
  it('a lower total is a reset: new baseline, nothing counted', () => {
    let b = addReading(blank(), 5000, 1, 'a');
    b = addReading(b, 1200, 2, 'b');
    expect(b.log[1]).toMatchObject({ change: null, reset: true, total: 1200 });
    b = addReading(b, 1500, 3, 'c');
    expect(earned(b)).toBe(300);
  });
  it('shows the starting-totals note only for retail, restaurant, vet until a start is set', () => {
    expect(needsStart('small')).toBe(false);
    expect(showStartNote(blank({ system: 'small' }))).toBe(false);
    expect(showStartNote(blank({ system: 'retail' }))).toBe(true);
    expect(showStartNote(setStart(blank({ system: 'vet' }), 0))).toBe(false);
  });
  it('staff keep their role when the list changes', () => {
    let b = setStaff(blank(), ['s1', 's2']);
    b = { ...b, staff: b.staff.map((s) => (s.sim === 's1' ? { ...s, role: 'Barista' } : s)) };
    b = setStaff(b, ['s1', 's3']);
    expect(b.staff.map((s) => [s.sim, s.role])).toEqual([['s1', 'Barista'], ['s3', '']]);
  });
  it('activities max out at five and ignore repeats', () => {
    let b = blank();
    ['Yoga', 'yoga', 'Pottery', 'Dance', 'Chess', 'Book club', 'Poker'].forEach((a) => { b = addActivity(b, a); });
    expect(b.activities).toEqual(['Yoga', 'Pottery', 'Dance', 'Chess', 'Book club']);
  });
  it('customer rules set, change and remove', () => {
    let b = setRule(blank(), 'age', { values: ['Teen'] });
    b = setRule(b, 'age', { level: 'preferred' });
    expect(b.customers).toEqual([{ id: 'age', values: ['Teen'], level: 'preferred' }]);
    expect(removeRule(b, 'age').customers).toEqual([]);
  });
  it('writes money with a sign', () => {
    expect(signed(4210)).toBe('+§4,210');
    expect(signed(-5)).toBe('−§5');
  });
});
