import type { Rec } from './sync/types';

/**
 * Businesses (module id `venues`). One record kind: `business`.
 * A business has an owner household, staff (any Sims, townies included), a rating and price level,
 * customer rules, kind-specific bits, and a money log. No open/closed status and no hours.
 * The money log works from the business's lifetime total: each reading (typed by hand or imported
 * from the game) adds one log row whose change is the difference from the reading before it.
 */

/** How the game runs the business. Drives which extra bits show and which money note shows. */
export type System = 'small' | 'retail' | 'restaurant' | 'vet' | 'other';
export const SYSTEMS: { id: System; label: string }[] = [
  { id: 'small', label: 'Small business' }, { id: 'retail', label: 'Retail' }, { id: 'restaurant', label: 'Restaurant' },
  { id: 'vet', label: 'Vet clinic' }, { id: 'other', label: 'Other' },
];
export const systemLabel = (s: System) => SYSTEMS.find((x) => x.id === s)?.label ?? 'Other';
/** Retail, restaurant and vet have no lifetime profit in the game: SimLogger only counts from when it's installed. */
export const needsStart = (s: System) => s === 'retail' || s === 'restaurant' || s === 'vet';

/** The editable list of kinds (a save can change it). */
export const DEFAULT_KINDS = ['Restaurant', 'Retail', 'Vet clinic', 'Bar', 'Gym', 'Cafe', 'Daycare'];
export const kindList = (v: unknown): string[] => {
  const a = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : [];
  return a.length ? [...new Set(a)] : [...DEFAULT_KINDS];
};
/** The system a kind most likely runs on, used to pre-fill the new business form. */
export const guessSystem = (kind: string): System => {
  const k = kind.toLowerCase();
  if (k.includes('restaurant')) return 'restaurant';
  if (k.includes('retail') || k.includes('shop') || k.includes('store')) return 'retail';
  if (k.includes('vet')) return 'vet';
  return 'small';
};

/** Price level shown as a percent against the game's normal price. */
export const PRICES = [-25, 0, 25, 50, 100];
export const priceText = (p: number) => (p > 0 ? `+${p}%` : p < 0 ? `−${Math.abs(p)}%` : '+0%');

// ---------- customer rules (the game's eight) ----------
export type CriterionId = 'age' | 'career' | 'marital' | 'financial' | 'traits' | 'skill' | 'occult' | 'supervised';
export type Criterion = { id: CriterionId; label: string; options: string[] | null };
export const CRITERIA: Criterion[] = [
  { id: 'age', label: 'Age', options: ['Child', 'Teen', 'Young adult', 'Adult', 'Elder'] },
  { id: 'career', label: 'Career', options: null },
  { id: 'marital', label: 'Marital status', options: ['Single', 'Married', 'In a relationship', 'Widowed'] },
  { id: 'financial', label: 'Financial status', options: ['Poor', 'Middle class', 'Wealthy'] },
  { id: 'traits', label: 'Traits', options: null },
  { id: 'skill', label: 'Skill level', options: null },
  { id: 'occult', label: 'Occult', options: ['Human', 'Vampire', 'Mermaid', 'Alien', 'Spellcaster', 'Werewolf', 'Servo'] },
  { id: 'supervised', label: 'Supervised customers', options: ['Yes', 'No'] },
];
export const criterionOf = (id: CriterionId) => CRITERIA.find((c) => c.id === id)!;
export type Rule = { id: CriterionId; values: string[]; level: 'required' | 'preferred' };

/** Small business activities: up to five, plus an entry fee type. */
export const MAX_ACTIVITIES = 5;
export const FEES = ['Free', 'Per activity', 'Flat'] as const;
export type Fee = (typeof FEES)[number];

export type Staff = { sim: string; role: string; pay: 'Low' | 'Medium' | 'High' };
export type Reading = { id: string; day: number | null; real: string; total: number; change: number | null; reset?: boolean };

export type BusinessData = {
  name: string;
  kind: string;
  system: System;
  /** Household id that owns it ('' = none). */
  owner: string;
  staff: Staff[];
  /** 0 = not rated yet, 1 to 5. */
  rating: number;
  price: number;
  customers: Rule[];
  activities: string[];
  fee: Fee;
  /** Kind-specific one-liners: menu, chef, dress (restaurant); sells (retail); supplies (vet). */
  extras: Record<string, string>;
  /** Lifetime total typed in as the starting point (retail, restaurant, vet). null = not set. */
  start: number | null;
  log: Reading[];
  notes: string;
  /** The Sim ids' game link and the last imported business day, so the same file never counts twice. */
  gameId?: string;
  closeKey?: string;
};
export const BLANK_BUSINESS: BusinessData = {
  name: '', kind: '', system: 'small', owner: '', staff: [], rating: 0, price: 0, customers: [], activities: [], fee: 'Free', extras: {}, start: null, log: [], notes: '',
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

export function businessData(r: Rec | undefined): BusinessData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const sys = SYSTEMS.some((s) => s.id === d.system) ? (d.system as System) : 'small';
  const ids = new Set(CRITERIA.map((c) => c.id as string));
  return {
    name: str(d.name), kind: str(d.kind), system: sys, owner: str(d.owner),
    staff: Array.isArray(d.staff) ? d.staff.filter(isObj).filter((s) => str(s.sim)).map((s) => ({ sim: str(s.sim), role: str(s.role), pay: (s.pay === 'Low' || s.pay === 'High' ? s.pay : 'Medium') as Staff['pay'] })) : [],
    rating: Math.min(5, Math.max(0, num(d.rating) ?? 0)), price: num(d.price) ?? 0,
    customers: Array.isArray(d.customers) ? d.customers.filter(isObj).filter((c) => ids.has(str(c.id))).map((c) => ({
      id: str(c.id) as CriterionId, values: Array.isArray(c.values) ? c.values.map(str).filter(Boolean) : [], level: (c.level === 'preferred' ? 'preferred' : 'required') as Rule['level'],
    })) : [],
    activities: Array.isArray(d.activities) ? d.activities.map(str).map((x) => x.trim()).filter(Boolean).slice(0, MAX_ACTIVITIES) : [],
    fee: (FEES as readonly string[]).includes(str(d.fee)) ? (d.fee as Fee) : 'Free',
    extras: isObj(d.extras) ? Object.fromEntries(Object.entries(d.extras).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {},
    start: num(d.start),
    log: Array.isArray(d.log) ? d.log.filter(isObj).map((x) => ({
      id: str(x.id) || Math.random().toString(36).slice(2), day: num(x.day), real: str(x.real), total: num(x.total) ?? 0, change: num(x.change), reset: !!x.reset,
    })) : [],
    notes: str(d.notes), gameId: str(d.gameId) || undefined, closeKey: str(d.closeKey) || undefined,
  };
}

export type BusinessRow = { id: string; b: BusinessData };
export const businessRows = (recs: Rec[]): BusinessRow[] => recs.map((r) => ({ id: r.id, b: businessData(r) })).sort((a, b) => a.b.name.localeCompare(b.b.name));

// ---------- the money log ----------
/** The lifetime total now: the latest reading, or the starting total. */
export const lifetimeOf = (b: BusinessData): number | null => (b.log.length ? b.log[b.log.length - 1].total : b.start);

/**
 * Adds a reading of the lifetime total. The change is the difference from the reading before (or the starting total).
 * First reading with no starting total just sets the baseline (no change). A total lower than before means the
 * business was reset in the game, so it becomes the new baseline and nothing is counted.
 */
export function addReading(b: BusinessData, total: number, day: number | null, real: string, id = Math.random().toString(36).slice(2)): BusinessData {
  const prev = lifetimeOf(b);
  const t = Math.round(total);
  let change: number | null = null;
  let reset = false;
  if (prev !== null) {
    if (t < prev) reset = true; else change = t - prev;
  }
  if (prev !== null && change === 0) return b;
  return { ...b, log: [...b.log, { id, day, real, total: t, change, reset }] };
}
/** Sets the starting total (what the business had earned before SimLogger). Counts nothing by itself. */
export const setStart = (b: BusinessData, total: number | null): BusinessData => ({ ...b, start: total === null ? null : Math.round(total) });
/** Sum of every counted change. */
export const earned = (b: BusinessData) => b.log.reduce((s, r) => s + (r.change ?? 0), 0);
/** The most recent counted change. */
export const lastChange = (b: BusinessData): number | null => {
  for (let i = b.log.length - 1; i >= 0; i--) if (b.log[i].change !== null) return b.log[i].change;
  return null;
};
/** True while the starting-totals note should show on this business's money log. */
export const showStartNote = (b: BusinessData) => needsStart(b.system) && b.start === null;

// ---------- staff and rules ----------
export const staffIds = (b: BusinessData) => b.staff.map((s) => s.sim);
export const setStaff = (b: BusinessData, ids: string[]): BusinessData => ({
  ...b, staff: ids.map((id) => b.staff.find((s) => s.sim === id) ?? { sim: id, role: '', pay: 'Medium' as const }),
});
export const addActivity = (b: BusinessData, name: string): BusinessData => {
  const n = name.trim();
  if (!n || b.activities.length >= MAX_ACTIVITIES || b.activities.some((a) => a.toLowerCase() === n.toLowerCase())) return b;
  return { ...b, activities: [...b.activities, n] };
};
export const setRule = (b: BusinessData, id: CriterionId, patch: Partial<Rule>): BusinessData => {
  const has = b.customers.some((c) => c.id === id);
  const next = has ? b.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) : [...b.customers, { id, values: [], level: 'required' as const, ...patch }];
  return { ...b, customers: next };
};
export const removeRule = (b: BusinessData, id: CriterionId): BusinessData => ({ ...b, customers: b.customers.filter((c) => c.id !== id) });
/** "Teen, Young adult" */
export const ruleText = (r: Rule) => r.values.join(', ');

/** What a venue's rating shows as: the game's stars for retail, restaurant and vet; small business uses a 1 to 5 the player sets (rank or reputation). */
export const ratingText = (n: number) => (n > 0 ? `${n} of 5` : 'Not rated');

/** Extra bits per system. */
export const EXTRAS: Record<System, { key: string; label: string; placeholder: string }[]> = {
  restaurant: [{ key: 'menu', label: 'Menu', placeholder: 'What’s on it' }, { key: 'chef', label: 'Chef skill', placeholder: 'Level 7 Cooking' }, { key: 'dress', label: 'Dress code', placeholder: 'Formal' }],
  retail: [{ key: 'sells', label: 'What it sells', placeholder: 'Clothes, books…' }],
  vet: [{ key: 'supplies', label: 'Supply quality', placeholder: 'Top shelf' }],
  small: [], other: [],
};

import { fmt } from './money';
/** "+§1,234" or "−§1,234". */
export const signed = (n: number) => `${n < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;
export { fmt };
