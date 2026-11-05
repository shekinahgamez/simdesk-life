import { describe, expect, it } from 'vitest';
import { BLANK_HOUSEHOLD, householdTags, moveIn, occupantOf, residentsOf, type HH, type Home, type OwnedLot } from './households';

const hh = (id: string, name: string, home: Home | null = null, notes = ''): HH => ({ id, data: { ...BLANK_HOUSEHOLD, name, home, notes } });
const lot = (id: string): Home => ({ kind: 'lot', id, unit: null });
const unit = (id: string, u: string): Home => ({ kind: 'lot', id, unit: u });

const lots: OwnedLot[] = [
  { id: 'house', type: 'residential', owner: 'okafor' },
  { id: 'empty', type: 'residential', owner: null },
  { id: 'rental', type: 'residential-rental', owner: 'banks' },
  { id: 'bar', type: 'bar', owner: 'okafor' },
];
const base = () => ({
  households: [hh('okafor', 'Okafor', lot('house'), 'Big plans'), hh('banks', 'Banks', unit('rental', 'a')), hh('mendoza', 'Mendoza', unit('rental', 'b')), hh('rivera', 'Rivera', null, 'New in town')],
  lots,
  sims: [{ id: 's1', householdId: 'okafor' }, { id: 's2', householdId: 'rivera' }, { id: 's3', householdId: 'rivera' }],
});

describe('moving in', () => {
  it('moves into an empty lot and buys it', () => {
    const p = moveIn(base(), 'rivera', lot('empty'));
    expect(p.households).toEqual([{ id: 'rivera', data: expect.objectContaining({ home: lot('empty') }) }]);
    expect(p.lots).toEqual([{ id: 'empty', owner: 'rivera' }]);
  });
  it('rents an empty unit without owning the rental', () => {
    const p = moveIn(base(), 'rivera', unit('rental', 'c'));
    expect(p.lots).toEqual([]);
  });
  it('moving them out leaves them homeless and not owning it', () => {
    const p = moveIn(base(), 'rivera', lot('house'), 'out');
    expect(p.households).toContainEqual({ id: 'okafor', data: expect.objectContaining({ home: null }) });
    expect(p.lots).toEqual([{ id: 'house', owner: 'rivera' }]);
  });
  it('moving the landlord out of their unit means they stop owning the rental', () => {
    const p = moveIn(base(), 'rivera', unit('rental', 'a'), 'out');
    expect(p.lots).toEqual([{ id: 'rental', owner: null }]);
  });
  it('leaving a house you own sells it', () => {
    const p = moveIn(base(), 'okafor', lot('empty'));
    expect(p.lots).toEqual([{ id: 'house', owner: null }, { id: 'empty', owner: 'okafor' }]);
  });
  it('moving between units of your own rental keeps it', () => {
    const p = moveIn(base(), 'banks', unit('rental', 'c'));
    expect(p.lots).toEqual([]);
  });
});

describe('merging', () => {
  it('moves the Sims and lots over, keeps the chosen name, trashes the other household', () => {
    const s = base();
    s.lots = [...lots, { id: 'shop', type: 'retail', owner: 'rivera' }];
    const p = moveIn(s, 'rivera', lot('house'), 'merge', 'Rivera');
    expect(p.sims).toEqual([{ id: 's2', householdId: 'okafor' }, { id: 's3', householdId: 'okafor' }]);
    expect(p.households).toEqual([{ id: 'okafor', data: { name: 'Rivera', home: lot('house'), notes: 'Big plans\n\nNew in town' } }]);
    expect(p.trash).toEqual(['rivera']);
    expect(p.lots).toEqual([{ id: 'shop', owner: 'okafor' }]);
  });
  it('keeps the old name when none is given', () => {
    expect(moveIn(base(), 'rivera', lot('house'), 'merge').households[0].data.name).toBe('Okafor');
  });
  it('merging into a unit joins that household', () => {
    const p = moveIn(base(), 'rivera', unit('rental', 'b'), 'merge', 'Mendoza-Rivera');
    expect(p.households[0]).toEqual({ id: 'mendoza', data: expect.objectContaining({ name: 'Mendoza-Rivera' }) });
  });
});

describe('reading', () => {
  it('finds who lives where', () => {
    const s = base();
    expect(occupantOf(s.households, unit('rental', 'b'))?.id).toBe('mendoza');
    expect(occupantOf(s.households, unit('rental', 'c'))).toBeNull();
    expect(residentsOf(s.households, 'rental').map((h) => h.id)).toEqual(['banks', 'mendoza']);
  });
  it('tags households', () => {
    const s = base();
    const opt = (kind: 'lot' | 'unit' | 'apt') => ({ kind } as never);
    expect(householdTags(s.households[0], lots, opt('lot'))).toEqual(['Own it', '+1 lot']);
    expect(householdTags(s.households[1], lots, opt('unit'))).toEqual(['Own it', 'Landlord']);
    expect(householdTags(s.households[2], lots, opt('unit'))).toEqual(['Rent']);
    expect(householdTags(s.households[3], lots, null)).toEqual([]);
  });
});
