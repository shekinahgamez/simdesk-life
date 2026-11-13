/**
 * Import from game, Businesses part: turns the businesses in a SimLogger file into changes SimDesk can show with a
 * checkbox each. Pure, so it can be tested. Nothing is ever removed: staff are only added, notes and rules stay.
 * Retail, restaurant and vet have no lifetime profit in the game, so each business day's profit is added to a running
 * total (the starting total, or 0). A close that was already imported (same closeKey) never counts twice.
 */
import { addReading, BLANK_BUSINESS, businessData, kindList, lifetimeOf, needsStart, setStart, systemLabel, type BusinessData, type BusinessRow, type System } from './businesses';
import type { LogBusiness } from './gameLog';
import { normalize } from './text';

const SYSTEM_OF: Record<LogBusiness['type'], System> = { RETAIL: 'retail', RESTAURANT: 'restaurant', VET: 'vet', SMALL_BUSINESS: 'small', OTHER: 'other' };
const KIND_HINT: Record<System, string> = { retail: 'Retail', restaurant: 'Restaurant', vet: 'Vet clinic', small: '', other: '' };

export type BizChange = { id: string; kind: 'money' | 'rating' | 'staff' | 'new'; text: string; was: string; now: string };
export type BizPlan = {
  key: string;
  log: LogBusiness;
  /** The SimDesk business it matched, or null for a new one. */
  existing: string | null;
  system: System;
  kind: string;
  needsStart: boolean;
  changes: BizChange[];
  /** Staff to add (SimDesk Sim ids). */
  addStaff: string[];
  unmatchedStaff: number;
};

const same = (a: string, b: string) => normalize(a).replace(/[^a-z0-9]/g, '') === normalize(b).replace(/[^a-z0-9]/g, '');

export function planBusinesses(list: LogBusiness[], rows: BusinessRow[], sims: { id: string; gameId?: string; name: string }[], kinds: unknown, fmt: (n: number) => string): BizPlan[] {
  const kl = kindList(kinds);
  const out: BizPlan[] = [];
  for (const lb of list) {
    const match = rows.find((r) => r.b.gameId === lb.id) ?? rows.find((r) => !r.b.gameId && same(r.b.name, lb.name));
    const system = match ? match.b.system : SYSTEM_OF[lb.type];
    const b = match?.b ?? { ...BLANK_BUSINESS, name: lb.name, system };
    const changes: BizChange[] = [];
    const key = `biz:${lb.id}`;
    if (!match) changes.push({ id: `${key}:new`, kind: 'new', text: 'New business', was: '', now: lb.name });
    // money
    const wasTotal = lifetimeOf(b);
    if (system === 'small' && lb.lifetime !== null && lb.lifetime !== wasTotal) {
      const next = addReading(b, lb.lifetime, null, '');
      if (next !== b) changes.push({ id: `${key}:money`, kind: 'money', text: 'Lifetime total', was: wasTotal === null ? '' : fmt(wasTotal), now: fmt(lb.lifetime) });
    } else if (needsStart(system) && lb.dayProfit !== null && lb.dayProfit !== 0 && lb.closeKey && lb.closeKey !== b.closeKey) {
      const base = wasTotal ?? 0;
      changes.push({ id: `${key}:money`, kind: 'money', text: 'Profit', was: fmt(base), now: fmt(base + lb.dayProfit) });
    }
    if (lb.rating !== null && lb.rating !== b.rating) changes.push({ id: `${key}:rating`, kind: 'rating', text: 'Rating', was: b.rating ? `${b.rating}★` : '', now: `${lb.rating}★` });
    const have = new Set(b.staff.map((s) => s.sim));
    const wanted = lb.staff.map((g) => sims.find((s) => s.gameId === g)).filter((s): s is { id: string; gameId?: string; name: string } => !!s);
    const addStaff = wanted.filter((s) => !have.has(s.id)).map((s) => s.id);
    if (addStaff.length) changes.push({ id: `${key}:staff`, kind: 'staff', text: 'Staff', was: '', now: `+${addStaff.length} (${wanted.filter((s) => addStaff.includes(s.id)).map((s) => s.name.split(' ')[0]).join(', ')})` });
    const hint = KIND_HINT[system];
    out.push({
      key, log: lb, existing: match?.id ?? null, system, kind: match?.b.kind || kl.find((k) => k === hint) || kl.find((k) => normalize(k).includes(normalize(hint)) && hint) || systemLabel(system),
      needsStart: needsStart(system) && !match && true, changes, addStaff, unmatchedStaff: lb.staff.length - wanted.length,
    });
  }
  return out;
}

/** The business record after the ticked changes. `start` is the typed starting total for a new retail/restaurant/vet business. */
export function applyBusiness(plan: BizPlan, current: BusinessData | null, ticked: Set<string>, start: number | null, today: number | null, nowIso: string): BusinessData {
  let b: BusinessData = current ?? { ...BLANK_BUSINESS, name: plan.log.name, kind: plan.kind, system: plan.system };
  b = { ...b, gameId: plan.log.id };
  if (!current && start !== null && needsStart(plan.system)) b = setStart(b, start);
  const on = (k: BizChange['kind']) => plan.changes.some((c) => c.kind === k && ticked.has(c.id));
  if (on('money')) {
    if (plan.system === 'small' && plan.log.lifetime !== null) b = addReading(b, plan.log.lifetime, today, nowIso);
    else if (plan.log.dayProfit !== null) {
      const base = lifetimeOf(b) ?? 0;
      b = addReading({ ...b, start: b.start ?? 0 }, base + plan.log.dayProfit, today, nowIso);
      b = { ...b, closeKey: plan.log.closeKey };
    }
  }
  if (on('rating') && plan.log.rating !== null) b = { ...b, rating: plan.log.rating };
  if (on('staff')) b = { ...b, staff: [...b.staff, ...plan.addStaff.filter((id) => !b.staff.some((s) => s.sim === id)).map((id) => ({ sim: id, role: '', pay: 'Medium' as const }))] };
  return b;
}
export { businessData };
