/**
 * Worlds and lots: what's stored, and the rules the pages share.
 *
 * Words: a "spot" is one of the game's lots in a world (Crick Cabana in Willow Creek). It keeps the game's
 * name. A "lot" is one of the player's own builds (from the Gallery or their own). The lot list starts empty;
 * a lot sits on a spot once it's placed. The app never says "spot" or "plot": spots are called by their
 * game name, and an open one is an "empty lot".
 *
 * Apartments are different: the game's apartments come preloaded (one household each, nobody owns them,
 * names can't be edited). A downloaded apartment is a lot with type Apartment; "placing" it means using it
 * in one of the game's apartments.
 */
import { BY_ID, type Available, type GameLot } from '../data/game';
import type { PhotoRef } from './photos';
import { matches } from './text';
import type { Rec } from './sync/types';

export const APARTMENT = 'apartment';
export const RESIDENTIAL_RENTAL = 'residential-rental';

/** The game's usual lot sizes, for the Add a lot form. */
export const LOT_SIZES = ['20x15', '20x20', '30x20', '30x30', '40x20', '40x30', '40x40', '50x40', '50x50', '64x64'];

export type Unit = { id: string; name: string };
export type HistoryRow = { id: string; when: string; text: string };

export type LotData = {
  name: string;
  /** Lot type id (lot-types.json). Required. */
  type: string;
  /** Its own size, as built (the Gallery size). Once placed it takes the spot's size; this stays as the original. */
  size: string;
  price: number | null;
  /** The spot it's placed on (a game lot id), or null when not placed. Apartments: the game apartment it's used in. */
  spot: string | null;
  /** Apartments only: the game apartment it was downloaded for. */
  meantFor: string | null;
  units: Unit[];
  /** The household that owns it (a household id), or null. Game apartments are never owned. */
  owner: string | null;
  photo: PhotoRef | null;
  /** The creator (shown as "Creator"; the old free-text build credits). */
  credits: string;
  /** The creator's EA ID, for finding the build on the Gallery. */
  galleryId: string;
  /** What the build is called on the Gallery. */
  galleryName: string;
  traits: string[];
  history: HistoryRow[];
  notes: string;
};

export const BLANK_LOT: LotData = {
  name: '', type: '', size: '', price: null, spot: null, meantFor: null, units: [], owner: null, photo: null, credits: '', galleryId: '', galleryName: '', traits: [], history: [], notes: '',
};

export function lotData(r: Rec | undefined): LotData {
  const d = (r?.data ?? {}) as Partial<LotData>;
  return {
    ...BLANK_LOT, ...d,
    units: d.units ?? [], traits: d.traits ?? [], history: d.history ?? [],
    galleryId: typeof d.galleryId === 'string' ? d.galleryId : '', galleryName: typeof d.galleryName === 'string' ? d.galleryName : '',
    price: typeof d.price === 'number' ? d.price : null,
    owner: typeof d.owner === 'string' ? d.owner : null,
  };
}

/** A world as the player sees it: the game's world, with their own name and notes on top. */
export type WorldData = {
  gameId: string; name: string; inspiredBy: string; vibe: string;
  /** Your names for this world's neighborhoods, keyed by the game's name. */
  hoodNames: Record<string, string>;
};
export const BLANK_WORLD: Omit<WorldData, 'gameId'> = { name: '', inspiredBy: '', vibe: '', hoodNames: {} };
export function worldData(r: Rec | undefined, gameId: string): WorldData {
  return { ...BLANK_WORLD, ...((r?.data ?? {}) as Partial<WorldData>), gameId };
}


// ---------- lot types ----------
/** Lot types the player added themselves (like Hotel). They live on the account and count as regular community lots. */
export const CUSTOM_TYPE_PREFIX = 'custom:';
export type CustomLotType = { id: string; name: string };
let customTypes = new Map<string, string>();
/** Keeps the names of the player's own lot types where lotTypeName can find them. */
export function setCustomLotTypes(list: CustomLotType[]) { customTypes = new Map(list.map((t) => [`${CUSTOM_TYPE_PREFIX}${t.id}`, t.name])); }
export const lotTypeName = (id: string) => customTypes.get(id) ?? BY_ID.lotTypes.get(id)?.name ?? (id ? 'Removed lot type' : '');
export const VACATION_RENTAL = 'vacation-rental';
/** A hotel is a lot whose type the player named Hotel. */
export const isHotelType = (typeId: string) => /\bhotel\b/i.test(customTypes.get(typeId) ?? '');
/** Lot types for the Add a lot form: one A to Z list from the save's packs, plus the player's own (and the one already picked). */
export function lotTypeOptions(avail: Available, chosen = '', custom: CustomLotType[] = []) {
  const list = [...avail.lotTypes.map((t) => ({ id: t.id, label: t.name })), ...custom.map((t) => ({ id: `${CUSTOM_TYPE_PREFIX}${t.id}`, label: t.name }))];
  if (chosen && !list.some((o) => o.id === chosen)) list.push({ id: chosen, label: `${lotTypeName(chosen)} (pack is off)` });
  return list.sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- sizes ----------
/** "40x30" as [40, 30], or null for sizes the app can't compare (blank, "2 floor apartment"). */
export function parseSize(s: string): [number, number] | null {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(s ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}
export type Fit = 'fits' | 'too-big' | 'unknown';
/** Does a lot of this size fit on a spot of that size? Same size or smaller fits (either way round). */
export function fitOf(lotSize: string, spotSize: string): Fit {
  const a = parseSize(lotSize);
  const b = parseSize(spotSize);
  if (!a || !b) return 'unknown';
  const [al, as] = [Math.max(...a), Math.min(...a)];
  const [bl, bs] = [Math.max(...b), Math.min(...b)];
  return al <= bl && as <= bs ? 'fits' : 'too-big';
}

// ---------- spots ----------
const isApartmentSpot = (l: GameLot) => l.lotType === 'Apartment';
/** The game's apartments in the save's packs. */
export const apartmentsOf = (avail: Available) => avail.lots.filter(isApartmentSpot);
/** Every spot a lot can be placed on in one world (apartments aren't spots). */
export const spotsOf = (avail: Available, worldId: string) => avail.lots.filter((l) => l.world === worldId && !isApartmentSpot(l));
export const spotById = (id: string | null) => (id ? BY_ID.lots.get(id) ?? null : null);

// ---------- the lot list ----------
export type LotRow = { id: string; lot: LotData; spot: GameLot | null; world: string | null };
export function lotRows(recs: Rec[]): LotRow[] {
  return recs.map((r) => {
    const lot = lotData(r);
    const spot = spotById(lot.spot);
    return { id: r.id, lot, spot, world: spot?.world ?? null };
  });
}
/** Which of the player's lots is on each spot. */
export function lotsBySpot(rows: LotRow[]) {
  return new Map(rows.filter((r) => r.lot.spot).map((r) => [r.lot.spot!, r]));
}

export type LotFilters = { types: string[]; worlds: string[]; placed: 'any' | 'placed' | 'not'; sizes: string[] };
export const NO_LOT_FILTERS: LotFilters = { types: [], worlds: [], placed: 'any', sizes: [] };
export const lotFilterCount = (f: LotFilters) => f.types.length + f.worlds.length + (f.placed !== 'any' ? 1 : 0) + f.sizes.length;

/** What the list shows for a lot's size: the spot's size once placed. */
export const shownSize = (r: Pick<LotRow, 'lot' | 'spot'>) => (r.spot && r.lot.type !== APARTMENT ? r.spot.size : r.lot.size);

export function applyLotFilters(rows: LotRow[], f: LotFilters, q: string) {
  return rows.filter((r) => {
    if (f.types.length && !f.types.includes(r.lot.type)) return false;
    if (f.worlds.length && !(r.world && f.worlds.includes(r.world))) return false;
    if (f.placed === 'placed' && !r.spot) return false;
    if (f.placed === 'not' && r.spot) return false;
    if (f.sizes.length && !f.sizes.includes(shownSize(r)) && !f.sizes.includes(r.lot.size)) return false;
    if (q.trim() && !matches(r.lot.name, q) && !(r.spot && matches(r.spot.name, q)) && !matches(lotTypeName(r.lot.type), q)) return false;
    return true;
  });
}

// ---------- placing ----------
/** What placing `lotId` on `spotId` changes: this lot moves there, and whatever was there goes back to Not placed. */
export function placeChanges(rows: LotRow[], lotId: string, spotId: string | null): { id: string; spot: string | null }[] {
  const out: { id: string; spot: string | null }[] = [];
  if (spotId) {
    for (const r of rows) if (r.id !== lotId && r.lot.spot === spotId) out.push({ id: r.id, spot: null });
  }
  out.push({ id: lotId, spot: spotId });
  return out;
}
