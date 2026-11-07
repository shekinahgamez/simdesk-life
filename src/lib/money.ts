/**
 * Household funds: a net worth for each household and each Sim. Balances only (no bills).
 *
 * One record per household (kind 'money', id `money:<householdId>`) holds the household funds, the
 * accounts and debts, and a log of net worth by game day for the chart. Property is not stored here:
 * it's the price of every lot the household owns (Worlds & lots).
 *
 * A Sim's net worth = what they own alone + an even share of joint accounts and debts.
 * The household's = funds + lots + every account and debt (joint ones counted once).
 *
 * The SNB (SimRealist) and SimFinancial (adeepindigo) add-ons only add account types. Turning one off
 * hides its accounts and leaves them out of the totals, without deleting anything.
 */
import type { Rec } from './sync/types';

export type Group = 'cash' | 'bank' | 'invest' | 'property';
export type Side = 'have' | 'owe';
export type ModId = 'snb' | 'simfin';

export type ItemType = { id: string; label: string; side: Side; group: Group; mod: ModId | null };

export const MOD_NAMES: Record<ModId, string> = { snb: 'SNB', simfin: 'SimFinancial' };
export const MOD_LONG: Record<ModId, { name: string; desc: string }> = {
  snb: { name: 'SNB by SimRealist', desc: 'SNB accounts, loans, mortgages and Patron Plaque' },
  simfin: { name: 'SimFinancial by adeepindigo', desc: 'Credit Union accounts, SimCo shares, loans and cards' },
};

export const TYPES: ItemType[] = [
  { id: 'savings', label: 'Savings', side: 'have', group: 'bank', mod: null },
  { id: 'other', label: 'Something else they own', side: 'have', group: 'invest', mod: null },
  { id: 'debt', label: 'Money they owe', side: 'owe', group: 'bank', mod: null },
  { id: 'snb-main', label: 'Main account', side: 'have', group: 'bank', mod: 'snb' },
  { id: 'snb-checking', label: 'Checking account', side: 'have', group: 'bank', mod: 'snb' },
  { id: 'snb-savings', label: 'Savings account', side: 'have', group: 'bank', mod: 'snb' },
  { id: 'snb-edu', label: 'Education Fund', side: 'have', group: 'bank', mod: 'snb' },
  { id: 'snb-plaque', label: 'Patron Plaque', side: 'have', group: 'invest', mod: 'snb' },
  { id: 'snb-loan', label: 'Loan', side: 'owe', group: 'bank', mod: 'snb' },
  { id: 'snb-mortgage', label: 'Mortgage', side: 'owe', group: 'bank', mod: 'snb' },
  { id: 'sf-checking', label: 'Checking', side: 'have', group: 'bank', mod: 'simfin' },
  { id: 'sf-savings', label: 'Savings', side: 'have', group: 'bank', mod: 'simfin' },
  { id: 'sf-retire', label: 'Retirement', side: 'have', group: 'bank', mod: 'simfin' },
  { id: 'sf-trust', label: 'Trust fund', side: 'have', group: 'bank', mod: 'simfin' },
  { id: 'sf-brokerage', label: 'Brokerage', side: 'have', group: 'invest', mod: 'simfin' },
  { id: 'sf-simco', label: 'SimCo shares', side: 'have', group: 'invest', mod: 'simfin' },
  { id: 'sf-loan', label: 'Loan', side: 'owe', group: 'bank', mod: 'simfin' },
  { id: 'sf-mortgage', label: 'Mortgage', side: 'owe', group: 'bank', mod: 'simfin' },
  { id: 'sf-card', label: 'Credit card', side: 'owe', group: 'bank', mod: 'simfin' },
];
const TYPE_BY_ID = new Map(TYPES.map((t) => [t.id, t]));
export const typeOf = (id: string): ItemType => TYPE_BY_ID.get(id) ?? TYPES[1];

export const GROUP_LABEL: Record<Group, string> = { cash: 'Cash', bank: 'Bank', invest: 'Investments', property: 'Property' };
export const GROUPS: Group[] = ['cash', 'bank', 'invest', 'property'];

export type MoneyItem = {
  id: string;
  type: string;
  /** Extra words after the type ("Priestley Foundation", "1,200 shares"). */
  name: string;
  /** Sim ids. Empty = the whole household. Two or more = joint. */
  owners: string[];
  /** Always positive. Debts are positive amounts owed. */
  amount: number;
  note: string;
};

/** Net worth on one game day. `by` = per Sim, plus 'funds' and 'lots'. */
export type Snap = { day: number; net: number; by: Record<string, number> };

export type MoneyData = { household: string; funds: number | null; items: MoneyItem[]; log: Snap[]; lastCheck: number | null };

export const moneyId = (householdId: string) => `money:${householdId}`;

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export function moneyData(r: Rec | undefined, householdId: string): MoneyData {
  const d = (r?.data ?? {}) as Partial<MoneyData>;
  const items = (Array.isArray(d.items) ? d.items : []).filter((i): i is MoneyItem => !!i && typeof i.id === 'string').map((i) => ({
    id: i.id,
    type: typeof i.type === 'string' ? i.type : 'other',
    name: typeof i.name === 'string' ? i.name : '',
    owners: Array.isArray(i.owners) ? i.owners.filter((o) => typeof o === 'string') : [],
    amount: Math.max(0, num(i.amount)),
    note: typeof i.note === 'string' ? i.note : '',
  }));
  const log = (Array.isArray(d.log) ? d.log : []).filter((s): s is Snap => !!s && typeof s.day === 'number' && typeof s.net === 'number')
    .map((s) => ({ day: s.day, net: s.net, by: s.by && typeof s.by === 'object' ? s.by : {} }))
    .sort((a, b) => a.day - b.day);
  return { household: householdId, funds: typeof d.funds === 'number' ? d.funds : null, items, log, lastCheck: typeof d.lastCheck === 'number' ? d.lastCheck : null };
}

// ---------- settings (on the save) ----------
export type WealthClass = { name: string; from: number };
export type MoneySettings = { snb: boolean; simfin: boolean; classes: WealthClass[] };

export const DEFAULT_CLASSES: WealthClass[] = [
  { name: 'Below the Poverty Line', from: 0 },
  { name: 'Lower Class', from: 2000 },
  { name: 'Working Class', from: 10000 },
  { name: 'Lower Middle', from: 30000 },
  { name: 'Middle Class', from: 75000 },
  { name: 'Upper Middle', from: 150000 },
  { name: 'Upper Class', from: 400000 },
  { name: 'Ultra Wealthy', from: 1000000 },
];

export function moneySettings(raw: unknown): MoneySettings {
  const o = (raw ?? {}) as Partial<MoneySettings>;
  const cls = Array.isArray(o.classes) && o.classes.length
    ? o.classes.filter((c) => c && typeof c.name === 'string').map((c, i) => ({ name: c.name, from: i === 0 ? 0 : Math.max(0, num(c.from)) }))
    : DEFAULT_CLASSES;
  return { snb: !!o.snb, simfin: !!o.simfin, classes: cls };
}

export const modOn = (s: MoneySettings, mod: ModId | null) => mod === null || s[mod];
/** Types the Add menu offers, for one side, with the mods that are on. */
export const typesFor = (s: MoneySettings, side: Side) => TYPES.filter((t) => t.side === side && modOn(s, t.mod));

/** The class a net worth falls in (index into classes). Below 0 is the first class. */
export function classIndex(classes: WealthClass[], net: number): number {
  let idx = 0;
  classes.forEach((c, i) => { if (i > 0 && net >= c.from) idx = i; });
  return idx;
}

/** "§12,000 to Upper Class", or for the top class "Top class · §148,300 above the Ultra Wealthy line". */
export function classLine(classes: WealthClass[], net: number): string {
  const i = classIndex(classes, net);
  if (i === classes.length - 1) return classes.length > 1 ? `Top class · ${fmt(net - classes[i].from)} above the ${classes[i].name} line` : 'Top class';
  return `${fmt(classes[i + 1].from - net)} to ${classes[i + 1].name}`;
}

// ---------- totals ----------
export function visibleItems(m: MoneyData, s: MoneySettings): MoneyItem[] {
  return m.items.filter((i) => modOn(s, typeOf(i.type).mod));
}

export type Totals = { have: number; owe: number; net: number; groups: Record<Group, number> };

export function totals(m: MoneyData, s: MoneySettings, lotsValue: number): Totals {
  const groups: Record<Group, number> = { cash: m.funds ?? 0, bank: 0, invest: 0, property: lotsValue };
  let owe = 0;
  for (const i of visibleItems(m, s)) {
    const t = typeOf(i.type);
    if (t.side === 'owe') owe += i.amount; else groups[t.group] += i.amount;
  }
  const have = groups.cash + groups.bank + groups.invest + groups.property;
  return { have, owe, net: have - owe, groups };
}

/** What a Sim's share of one item is (signed: debts negative). 0 if it isn't theirs. */
export function shareOf(i: MoneyItem, simId: string): number {
  if (!i.owners.includes(simId)) return 0;
  const v = i.amount / i.owners.length;
  return typeOf(i.type).side === 'owe' ? -v : v;
}

export function simNet(m: MoneyData, s: MoneySettings, simId: string): number {
  return visibleItems(m, s).reduce((a, i) => a + shareOf(i, simId), 0);
}

/** Household funds, lots, each Sim, and anything owned by the household as a whole. */
export function bySim(m: MoneyData, s: MoneySettings, simIds: string[], lotsValue: number): Record<string, number> {
  const out: Record<string, number> = { funds: m.funds ?? 0, lots: lotsValue };
  for (const id of simIds) out[id] = 0;
  let whole = 0;
  for (const i of visibleItems(m, s)) {
    const sign = typeOf(i.type).side === 'owe' ? -1 : 1;
    const owners = i.owners.filter((o) => o in out && o !== 'funds' && o !== 'lots');
    if (!owners.length) { whole += sign * i.amount; continue; }
    for (const o of owners) out[o] += (sign * i.amount) / owners.length;
  }
  if (whole) out.household = whole;
  return out;
}

/** Saves today's net worth into the log (one entry per game day; the latest wins). Keeps the last 400. */
export function logToday(m: MoneyData, day: number, net: number, by: Record<string, number>): Snap[] {
  const rest = m.log.filter((x) => x.day !== day);
  return [...rest, { day, net, by }].sort((a, b) => a.day - b.day).slice(-400);
}

/** Change since the last logged day before `day` (the last money check before today). */
export function changeSince(log: Snap[], net: number, day: number, who?: string): { amount: number; day: number } | null {
  const before = log.filter((x) => x.day < day && (!who || who in x.by));
  if (!before.length) return null;
  const prev = before[before.length - 1];
  const was = who ? prev.by[who] : prev.net;
  return { amount: net - was, day: prev.day };
}

// ---------- numbers ----------
export const fmt = (n: number) => `${n < 0 ? '−' : ''}§${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
export function short(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}§${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  if (a >= 1e3) return `${sign}§${Math.round(a / 1e3)}k`;
  return `${sign}§${Math.round(a)}`;
}
/** Reads "§12,400", "12400", "12.4k", "1.2m". Empty or junk = null. */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[§,\s]/g, '').replace(/^[−-]/, '').toLowerCase();
  if (!t) return null;
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(t);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
  return Math.round(v);
}

export function itemTitle(i: MoneyItem): string {
  const t = typeOf(i.type).label;
  return i.name.trim() ? `${t} · ${i.name.trim()}` : t;
}
