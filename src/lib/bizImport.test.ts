import { describe, expect, it } from 'vitest';
import { applyBusiness, planBusinesses } from './bizImport';
import { BLANK_BUSINESS, earned, lifetimeOf, type BusinessRow } from './businesses';
import type { LogBusiness } from './gameLog';

const fmt = (n: number) => `§${n}`;
const lb = (p: Partial<LogBusiness> = {}): LogBusiness => ({ id: '9', name: 'Black Tea', type: 'SMALL_BUSINESS', lifetime: 5000, dayProfit: null, closeKey: '', rating: 4, staff: ['g1', 'g2'], ...p });
const sims = [{ id: 's1', gameId: 'g1', name: 'Nolan Pryor' }, { id: 's2', name: 'No Game' }];
const row = (b: Partial<typeof BLANK_BUSINESS>, id = 'b1'): BusinessRow => ({ id, b: { ...BLANK_BUSINESS, name: 'Black Tea', ...b } });

describe('business import', () => {
  it('a new business shows as new with its changes', () => {
    const [p] = planBusinesses([lb()], [], sims, undefined, fmt);
    expect(p.existing).toBeNull();
    expect(p.changes.map((c) => c.kind)).toEqual(['new', 'money', 'rating', 'staff']);
    expect(p.unmatchedStaff).toBe(1);
  });
  it('matches by name, then remembers the game id', () => {
    const [p] = planBusinesses([lb()], [row({})], sims, undefined, fmt);
    expect(p.existing).toBe('b1');
    const b = applyBusiness(p, row({}).b, new Set(p.changes.map((c) => c.id)), null, 3, 'x');
    expect(b.gameId).toBe('9');
    expect(b.rating).toBe(4);
    expect(b.staff.map((s) => s.sim)).toEqual(['s1']);
    expect(lifetimeOf(b)).toBe(5000);
  });
  it('small business: the next file logs the difference', () => {
    const first = applyBusiness(planBusinesses([lb()], [], sims, undefined, fmt)[0], null, new Set(['biz:9:money']), null, 1, 'a');
    const [p2] = planBusinesses([lb({ lifetime: 5600 })], [{ id: 'b1', b: first }], sims, undefined, fmt);
    const second = applyBusiness(p2, first, new Set(['biz:9:money']), null, 2, 'b');
    expect(earned(second)).toBe(600);
  });
  it('retail adds each business day to a running total and never counts one twice', () => {
    const r = lb({ type: 'RETAIL', lifetime: null, dayProfit: 800, closeKey: 'd1', rating: null, staff: [] });
    const [p] = planBusinesses([r], [], sims, undefined, fmt);
    expect(p.needsStart).toBe(true);
    const made = applyBusiness(p, null, new Set(['biz:9:money', 'biz:9:new']), 10000, 1, 'a');
    expect(lifetimeOf(made)).toBe(10800);
    expect(made.log[0].change).toBe(800);
    const [again] = planBusinesses([r], [{ id: 'b1', b: made }], sims, undefined, fmt);
    expect(again.changes.some((c) => c.kind === 'money')).toBe(false);
    const [next] = planBusinesses([{ ...r, dayProfit: 200, closeKey: 'd2' }], [{ id: 'b1', b: made }], sims, undefined, fmt);
    expect(next.changes.find((c) => c.kind === 'money')?.now).toBe('§11000');
  });
  it('unticked changes are left alone', () => {
    const [p] = planBusinesses([lb()], [row({})], sims, undefined, fmt);
    const b = applyBusiness(p, row({}).b, new Set(), null, 1, 'a');
    expect(b.rating).toBe(0);
    expect(b.log).toHaveLength(0);
  });
});
