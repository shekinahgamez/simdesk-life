import { describe, expect, it } from 'vitest';
import { available, ownedFrom } from '../data/game';
import {
  apartmentsOf, applyLotFilters, BLANK_LOT, fitOf, lotTypeOptions, NO_LOT_FILTERS, parseSize, placeChanges, spotsOf, type LotRow,
} from './lots';

const row = (id: string, extra: Partial<typeof BLANK_LOT>): LotRow => ({ id, lot: { ...BLANK_LOT, ...extra }, spot: null, world: null });

describe('sizes', () => {
  it('reads 40x30', () => expect(parseSize('40x30')).toEqual([40, 30]));
  it('ignores sizes it can’t compare', () => expect(parseSize('2 floor apartment')).toBeNull());
  it('same size or smaller fits, either way round', () => {
    expect(fitOf('40x30', '40x30')).toBe('fits');
    expect(fitOf('20x15', '40x30')).toBe('fits');
    expect(fitOf('20x30', '30x20')).toBe('fits');
  });
  it('bigger is too big', () => expect(fitOf('40x30', '30x20')).toBe('too-big'));
  it('unknown sizes don’t block', () => expect(fitOf('', '30x20')).toBe('unknown'));
});

describe('spots', () => {
  const avail = available(ownedFrom(['city-living']));
  it('Willow Creek has its 21 spots (the secret lot stays off)', () => expect(spotsOf(avail, 'willow-creek')).toHaveLength(21));
  it('apartments aren’t spots', () => {
    expect(spotsOf(avail, 'san-myshuno').some((l) => l.lotType === 'Apartment')).toBe(false);
    expect(apartmentsOf(avail).length).toBeGreaterThan(0);
  });
  it('no City Living, no San Myshuno apartments', () => expect(apartmentsOf(available(ownedFrom([]))).some((l) => l.world === 'san-myshuno')).toBe(false));
});

describe('lot types', () => {
  const opts = lotTypeOptions(available(ownedFrom([])));
  it('one A to Z list', () => expect(opts.map((o) => o.label)).toEqual([...opts.map((o) => o.label)].sort((a, b) => a.localeCompare(b))));
  it('General is in, Rental and Penthouse are out', () => {
    const names = opts.map((o) => o.label);
    expect(names).toContain('General');
    expect(names).not.toContain('Rental');
    expect(names).not.toContain('Penthouse');
  });
});

describe('placing', () => {
  it('swapping sends the old lot back to Not placed', () => {
    const rows = [row('a', { spot: 'willow-creek--crick-cabana' }), row('b', {})];
    expect(placeChanges(rows, 'b', 'willow-creek--crick-cabana')).toEqual([
      { id: 'a', spot: null }, { id: 'b', spot: 'willow-creek--crick-cabana' },
    ]);
  });
  it('taking a lot off the map', () => expect(placeChanges([row('a', { spot: 'x' })], 'a', null)).toEqual([{ id: 'a', spot: null }]));
});

describe('filters', () => {
  const rows = [row('a', { name: 'Okafor Cottage', type: 'residential', size: '20x15' }), row('b', { name: 'Velvet Room', type: 'nightclub', size: '30x20' })];
  it('by lot type', () => expect(applyLotFilters(rows, { ...NO_LOT_FILTERS, types: ['nightclub'] }, '').map((r) => r.id)).toEqual(['b']));
  it('not placed', () => expect(applyLotFilters(rows, { ...NO_LOT_FILTERS, placed: 'not' }, '')).toHaveLength(2));
  it('search', () => expect(applyLotFilters(rows, NO_LOT_FILTERS, 'okafor').map((r) => r.id)).toEqual(['a']));
});
