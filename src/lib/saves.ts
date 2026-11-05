import { ArrowsClockwise, Briefcase, Coins, Crown, Lightbulb, Notebook, Path, Storefront, type Icon } from '@phosphor-icons/react';
import { BY_ID, GAME, ownedFrom } from '../data/game';
import type { SaveRow } from './sync/types';
import type { PhotoRef } from './photos';
import {
  dateOf, newCalendar, stageTable, type Calendar, type Lifespan, type SeasonLength, type SimDate, type StageId,
} from './time';

/** Everything a save remembers about itself (stored as the save row's data). */
export type SaveData = {
  name: string;
  color: string;
  packs: string[];
  secretLots: string[];
  /** Day number for "today" (days since the save began). */
  today: number;
  calendar: Calendar;
  lifespan: Lifespan;
  /** Custom stage days are kept even after picking a preset, so going back to Custom restores them. */
  customDays?: Partial<Record<StageId, number>>;
  trackDate: boolean;
  /** Show Sims' ages the way a person's would read (see realAges.ts). Needs the date tracked. */
  realAges?: boolean;
  modules: Record<string, boolean>;
  /** Optional cover photo (setup step 1, Save settings, the desktop home page). */
  cover?: PhotoRef | null;
};

export const SAVE_COLORS: { label: string; hex: string }[] = [
  { label: 'Blush', hex: '#F4B6CF' },
  { label: 'Berry', hex: '#B83C76' },
  { label: 'Coral', hex: '#F59A82' },
  { label: 'Butter', hex: '#F2C25C' },
  { label: 'Mint', hex: '#6FCFB9' },
  { label: 'Sky', hex: '#8DB0FF' },
  { label: 'Lilac', hex: '#ADA2FF' },
  { label: 'Ink', hex: '#24191F' },
];

export const DEFAULT_NAME = 'My forever save';

/** Fills in anything a stored save is missing, so pages never trip over an old or partial save. */
export function saveData(row: SaveRow | undefined): SaveData {
  const d = (row?.data ?? {}) as Partial<SaveData>;
  return {
    name: (d.name ?? '').trim() || DEFAULT_NAME,
    color: d.color ?? SAVE_COLORS[0].hex,
    packs: d.packs ?? [],
    secretLots: d.secretLots ?? [],
    today: d.today ?? 0,
    calendar: d.calendar ?? newCalendar(7, 0),
    lifespan: d.lifespan ?? { preset: 'normal' },
    customDays: d.customDays,
    trackDate: d.trackDate ?? true,
    realAges: d.realAges ?? false,
    modules: d.modules ?? {},
    cover: d.cover ?? null,
  };
}

export const ownedOf = (d: SaveData) => ownedFrom(d.packs, d.secretLots);
export const tableOf = (d: SaveData) => stageTable(d.lifespan);
export const todayOf = (d: SaveData): SimDate => dateOf(d.today, d.calendar);

export function newSaveData(input: {
  name: string; color: string; packs: string[]; seasonLength: SeasonLength; today: SimDate;
  lifespan: Lifespan; trackDate: boolean; modules: string[];
}): SaveData {
  return {
    name: input.name.trim() || DEFAULT_NAME,
    color: input.color,
    packs: input.packs,
    secretLots: [],
    today: 0,
    calendar: { seasonLength: input.seasonLength, anchorDay: 0, anchorDate: input.today },
    lifespan: input.lifespan,
    customDays: input.lifespan.preset === 'custom' ? input.lifespan.days : undefined,
    trackDate: input.trackDate,
    modules: Object.fromEntries(input.modules.map((m) => [m, true])),
  };
}

export const seasonLengthLabel = (l: SeasonLength, long = false) => (l === 7 ? '1 week' : l === 21 ? (long ? '3 weeks (mod)' : '3 weeks') : `${l / 7} weeks`);
export const lifespanLabel = (l: Lifespan) => l.preset[0].toUpperCase() + l.preset.slice(1);

// ---------- modules ----------
export type ModuleDef = { id: string; label: string; desc: string; icon: Icon; tint: string; ready: boolean };
/** Optional features. Only ready ones can be turned on; the rest say "Coming soon". */
export const MODULES: ModuleDef[] = [
  { id: 'rotation', label: 'Rotation', desc: 'Who’s up next and for how long', icon: ArrowsClockwise, tint: 'worlds', ready: true },
  { id: 'funds', label: 'Household funds', desc: 'Simoleons for every household', icon: Coins, tint: 'households', ready: false },
  { id: 'careers', label: 'Careers', desc: 'Career, level and workplace', icon: Briefcase, tint: 'calendar', ready: false },
  { id: 'venues', label: 'Businesses & venues', desc: 'Owners, employees and customer activities', icon: Storefront, tint: 'sims', ready: false },
  { id: 'storylines', label: 'Storylines', desc: 'Threads that link Sims together', icon: Path, tint: 'storylines', ready: false },
  { id: 'journal', label: 'Play journal', desc: 'Day-by-day notes', icon: Notebook, tint: 'clubs', ready: false },
  { id: 'legacy', label: 'Legacy progress', desc: 'Generations, heirs and challenge rules', icon: Crown, tint: 'households', ready: false },
  { id: 'prompts', label: 'Story prompts', desc: 'A nudge when you’re stuck on what’s next', icon: Lightbulb, tint: 'storylines', ready: false },
];
/** On only when the module has launched and the save switched it on. */
export const moduleOn = (d: SaveData, id: string) => !!d.modules[id] && !!MODULES.find((m) => m.id === id)?.ready;

// ---------- packs ----------
/** What a pack brings, for the "New from <pack>" pop-up. */
export function packContents(packId: string) {
  const of = <T extends { pack: string }>(rows: T[]) => rows.filter((r) => r.pack === packId);
  return {
    id: packId,
    name: BY_ID.packs.get(packId)?.name ?? packId,
    worlds: of(GAME.worlds),
    occults: of(GAME.occults),
    traits: of(GAME.traits),
    aspirations: of(GAME.aspirations),
    traditions: of(GAME.traditions),
    secretLots: of(GAME.lots).filter((l) => l.secret),
  };
}

// ---------- last save opened (per device) ----------
const lastKey = (userKey: string) => `sd:lastSave:${userKey}`;
export function getLastSave(userKey: string): string | null {
  try { return localStorage.getItem(lastKey(userKey)); } catch { return null; }
}
export function setLastSave(userKey: string, id: string) {
  try { localStorage.setItem(lastKey(userKey), id); } catch { /* ignore */ }
}
