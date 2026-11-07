/**
 * Sims, households and relationships: what's stored, and the small rules the pages share.
 * Ages are never stored. With date tracking on, a Sim stores the day they were born (`bornDay`) and
 * everything else is worked out from it. With tracking off, the player sets the life stage by hand.
 */
import { BY_ID } from '../data/game';
import type { PhotoRef } from './photos';
import { normalize } from './text';
import { cleanLikes } from './likes';
import {
  ageOf, dateOf, formatDate, SEASONS, STAGE_IDS, stageName, type Age, type Calendar, type SimDate, type StageId, type StageRow,
} from './time';
import type { Rec } from './sync/types';

export type Gender = 'male' | 'female';
export type GenderSettings = {
  frame?: 'masculine' | 'feminine';
  clothing?: 'masculine' | 'feminine';
  pregnancy?: 'canBe' | 'canGet' | 'neither';
  toilet?: 'stand' | 'sit';
};

export type SimData = {
  first: string;
  last: string;
  gender: Gender | null;
  householdId: string | null;
  /** Date tracking on: the day they were born (can be before the save began, so negative is fine). */
  bornDay: number | null;
  /** The day they were added. Their first day never counts as a birthday. */
  addedDay: number | null;
  /** Date tracking off: the life stage, set by hand. */
  stage: StageId | null;
  /** Game trait ids, or "custom:<id>" for the player's own. */
  traits: string[];
  /** A game aspiration id, or "text:<what they typed>". */
  aspiration: string | null;
  /** null = Human. */
  occult: string | null;
  pronouns: string;
  orientation: string;
  career: string;
  careerLevel: number | null;
  genderSettings: GenderSettings;
  notes: string;
  portrait: PhotoRef | null;
  stagePhotos: { stage: StageId; photo: PhotoRef }[];
  deceased: { day: number | null; cause: string; notes: string } | null;
  /** Words typed in by the player (see lib/likes.ts). */
  likes: string[];
  dislikes: string[];
  turnOns: string[];
  turnOffs: string[];
};

export const BLANK_SIM: SimData = {
  first: '', last: '', gender: null, householdId: null, bornDay: null, addedDay: null, stage: null,
  traits: [], aspiration: null, occult: null, pronouns: '', orientation: '', career: '', careerLevel: null,
  genderSettings: {}, notes: '', portrait: null, stagePhotos: [], deceased: null,
  likes: [], dislikes: [], turnOns: [], turnOffs: [],
};

/** Fills in anything missing, so old or partial records never break a page. */
export function simData(r: Rec | undefined): SimData {
  const d = (r?.data ?? {}) as Partial<SimData>;
  return {
    ...BLANK_SIM,
    ...d,
    traits: Array.isArray(d.traits) ? d.traits : [],
    stagePhotos: Array.isArray(d.stagePhotos) ? d.stagePhotos : [],
    genderSettings: d.genderSettings ?? {},
    likes: cleanLikes(d.likes),
    dislikes: cleanLikes(d.dislikes),
    turnOns: cleanLikes(d.turnOns),
    turnOffs: cleanLikes(d.turnOffs),
  };
}

export const fullName = (s: Pick<SimData, 'first' | 'last'>) => [s.first, s.last].filter(Boolean).join(' ').trim() || 'Unnamed Sim';
export const initials = (s: Pick<SimData, 'first' | 'last'>) =>
  ((s.first[0] ?? '') + (s.last[0] ?? '')).toUpperCase() || '?';

// ---------- households ----------
export type HouseholdData = { name: string };
export const householdName = (r: Rec | undefined) => ((r?.data as Partial<HouseholdData>)?.name ?? '').trim() || 'Unnamed';
/**
 * How a household reads on a profile. "Okafor" becomes "Okafor household"; names that already say
 * household or family, or start with "The", show as typed.
 */
export function householdLabel(name: string): string {
  const n = name.trim();
  if (!n) return '';
  if (/\b(household|family)\b/i.test(n) || /^the\s/i.test(n)) return n;
  return `${n} household`;
}

// ---------- age ----------
export type SimAge =
  | { kind: 'unset' }
  | { kind: 'manual'; stage: StageId }
  | { kind: 'notBorn'; daysUntilBorn: number }
  | { kind: 'age'; age: Extract<Age, { born: true }> };

export function simAge(s: SimData, today: number, table: StageRow[], trackDate: boolean): SimAge {
  if (!trackDate || s.bornDay === null) return s.stage ? { kind: 'manual', stage: s.stage } : { kind: 'unset' };
  const a = ageOf(s.bornDay, today, table);
  if (!a.born) return { kind: 'notBorn', daysUntilBorn: a.daysUntilBorn };
  return { kind: 'age', age: a };
}

/** The life stage, whichever way it's known. */
export function stageOf(a: SimAge): StageId | null {
  if (a.kind === 'manual') return a.stage;
  if (a.kind === 'age') return a.age.stage;
  return null;
}

/** "in 3 days", "tomorrow", "today". */
export function daysWord(n: number): string {
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

export const shortSeason = (d: SimDate) => `${SEASONS[d.season].slice(0, 3)} ${d.day}`;
export const seasonDay = (d: SimDate) => formatDate(d, 'short');

export type BirthdayView = 'countdown' | 'date';

/** What a list shows in the Birthday column for a Sim, or null for none. */
export function birthdayCell(a: SimAge, cal: Calendar, view: BirthdayView, deceased: boolean):
  { text: string; soon: boolean; final?: boolean } | null {
  if (deceased || a.kind !== 'age') return null;
  if (a.age.stage === 'elder') return a.age.barFull ? { text: 'Final chapter', soon: false, final: true } : null;
  const n = a.age.birthdayIn ?? 0;
  const soon = n <= 7;
  return view === 'date' ? { text: seasonDay(dateOf(a.age.birthdayDay!, cal)), soon } : { text: daysWord(n), soon };
}

// ---------- labels ----------
export const TRAIT_PREFIX = 'custom:';
export const ASPIRATION_TEXT = 'text:';
export type CustomTrait = { id: string; name: string };

export function traitName(id: string, custom: CustomTrait[]): string {
  if (id.startsWith(TRAIT_PREFIX)) return custom.find((c) => `${TRAIT_PREFIX}${c.id}` === id)?.name ?? 'Removed trait';
  return BY_ID.traits.get(id)?.name ?? id;
}
export function aspirationName(id: string | null): string {
  if (!id) return '';
  if (id.startsWith(ASPIRATION_TEXT)) return id.slice(ASPIRATION_TEXT.length);
  return BY_ID.aspirations.get(id)?.name ?? id;
}
export const occultName = (id: string | null) => (id ? BY_ID.occults.get(id)?.name ?? id : 'Human');
export const careerText = (s: Pick<SimData, 'career' | 'careerLevel'>) =>
  s.career.trim() ? (s.careerLevel ? `${s.career.trim()} · Level ${s.careerLevel}` : s.career.trim()) : '';
export const genderName = (g: Gender | null) => (g === 'male' ? 'Male' : g === 'female' ? 'Female' : '');

// ---------- searching, filtering, sorting ----------
export type SimRow = {
  id: string;
  sim: SimData;
  name: string;
  household: string;
  age: SimAge;
  stage: StageId | null;
  /** "24 years old" when real-life ages are on for this save, else null. */
  realAge: string | null;
  /** "30", "9M" or "5w": for Sim cards. */
  realAgeShort: string | null;
};

export type Filters = {
  stages: StageId[];
  households: string[];
  genders: Gender[];
  birthdayThisWeek: boolean;
  deceased: boolean;
};
export const NO_FILTERS: Filters = { stages: [], households: [], genders: [], birthdayThisWeek: false, deceased: false };
export const filterCount = (f: Filters) =>
  f.stages.length + f.households.length + f.genders.length + (f.birthdayThisWeek ? 1 : 0) + (f.deceased ? 1 : 0);

/** "none" in the household filter means Sims with no household. */
export const NO_HOUSEHOLD = 'none';

export function matchesSearch(r: SimRow, q: string): boolean {
  const n = normalize(q);
  if (!n) return true;
  return normalize(r.name).includes(n) || normalize(r.household).includes(n);
}

export function applyFilters(rows: SimRow[], f: Filters): SimRow[] {
  return rows.filter((r) => {
    // Deceased Sims only show when asked for, and then only them.
    if (!!r.sim.deceased !== f.deceased) return false;
    if (f.stages.length && (!r.stage || !f.stages.includes(r.stage))) return false;
    if (f.households.length && !f.households.includes(r.sim.householdId ?? NO_HOUSEHOLD)) return false;
    if (f.genders.length && (!r.sim.gender || !f.genders.includes(r.sim.gender))) return false;
    if (f.birthdayThisWeek && !(r.age.kind === 'age' && r.age.age.birthdayIn !== undefined && r.age.age.birthdayIn <= 7)) return false;
    return true;
  });
}

export type SortKey = 'name' | 'stage' | 'household' | 'birthday';
export type Sort = { key: SortKey; dir: 1 | -1 };

const stageRank = (s: StageId | null) => (s ? STAGE_IDS.indexOf(s) : 99);
const birthdayRank = (a: SimAge) =>
  a.kind === 'age' ? (a.age.stage === 'elder' ? 10_000 + (a.age.barFull ? 0 : 1) : a.age.birthdayIn ?? 9_999) : 20_000;

export function sortRows(rows: SimRow[], sort: Sort): SimRow[] {
  const byName = (a: SimRow, b: SimRow) =>
    a.sim.last.localeCompare(b.sim.last, undefined, { sensitivity: 'base' }) ||
    a.sim.first.localeCompare(b.sim.first, undefined, { sensitivity: 'base' });
  const cmp: Record<SortKey, (a: SimRow, b: SimRow) => number> = {
    name: byName,
    stage: (a, b) => stageRank(a.stage) - stageRank(b.stage),
    household: (a, b) => {
      if (!a.household !== !b.household) return a.household ? -1 : 1; // no household last
      return a.household.localeCompare(b.household, undefined, { sensitivity: 'base' });
    },
    birthday: (a, b) => birthdayRank(a.age) - birthdayRank(b.age),
  };
  return [...rows].sort((a, b) => (cmp[sort.key](a, b) * sort.dir) || byName(a, b));
}

export const stageLabel = (s: StageId | null) => (s ? stageName(s) : 'Age not set');

/** Splits a typed full name: the last word is the last name. */
export function splitName(line: string): { first: string; last: string } {
  const parts = line.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

// ---------- relationships ----------
export type RelType = 'parent' | 'sibling' | 'spouse' | 'partner' | 'fiance' | 'ex' | 'bestFriend' | 'friend' | 'enemy' | 'roommate' | 'cousin' | 'other';
export const REL_TYPES: { id: RelType; label: string }[] = [
  { id: 'parent', label: 'Parent / child' },
  { id: 'sibling', label: 'Sibling' },
  { id: 'spouse', label: 'Spouse' },
  { id: 'partner', label: 'Partner' },
  { id: 'fiance', label: 'Engaged' },
  { id: 'ex', label: 'Ex' },
  { id: 'bestFriend', label: 'Best friend' },
  { id: 'friend', label: 'Friend' },
  { id: 'enemy', label: 'Enemy' },
  { id: 'roommate', label: 'Roommate' },
  { id: 'cousin', label: 'Cousin' },
  { id: 'other', label: 'Something else' },
];
/**
 * One record per pair. For parent / child, `a` is the parent. Each side has its own optional label:
 * `labelA` is what A's profile calls B, `labelB` is what B's profile calls A.
 */
export type RelData = { a: string; b: string; type: RelType; labelA: string; labelB: string; secret: boolean };

export function relData(r: Rec): RelData {
  const d = r.data as Partial<RelData>;
  return { a: d.a ?? '', b: d.b ?? '', type: d.type ?? 'friend', labelA: d.labelA ?? '', labelB: d.labelB ?? '', secret: !!d.secret };
}

/** How a relationship reads on one Sim's profile (describing the other Sim). */
export function relLabel(r: RelData, viewerId: string): string {
  const own = viewerId === r.a ? r.labelA : r.labelB;
  if (own.trim()) return own.trim();
  if (r.type === 'parent') return viewerId === r.a ? 'Child' : 'Parent';
  if (r.type === 'other') return 'Connected';
  return REL_TYPES.find((t) => t.id === r.type)!.label;
}
const REL_ORDER: RelType[] = ['parent', 'spouse', 'fiance', 'partner', 'sibling', 'cousin', 'bestFriend', 'friend', 'roommate', 'ex', 'enemy', 'other'];
export const relRank = (t: RelType) => REL_ORDER.indexOf(t);
export const otherSide = (r: RelData, viewerId: string) => (r.a === viewerId ? r.b : r.a);
