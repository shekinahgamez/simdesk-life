/**
 * Households: where they live and what they own, and the rules for moving in, moving out and merging.
 *
 * A home is one of your residential lots, one unit of a residential rental, or one of the game's
 * apartments. One household per home. Owning is separate from living: a household can own any of
 * your lots (a bar, a rental they live in or not). Game apartments are never owned.
 *
 * Moving out of a lot you own means you don't own it anymore (the game sells it). Moving into an
 * unowned residential lot (not a rental unit) makes you the owner, like buying it in the game.
 */
import { BY_ID, type GameLot } from '../data/game';
import { APARTMENT, RESIDENTIAL_RENTAL, type LotRow } from './lots';
import type { Rec } from './sync/types';

export type Home = { kind: 'lot'; id: string; unit: string | null } | { kind: 'apt'; id: string };
export type HouseholdData = { name: string; home: Home | null; notes: string };

export const BLANK_HOUSEHOLD: HouseholdData = { name: '', home: null, notes: '' };

function cleanHome(h: unknown): Home | null {
  const o = h as Partial<{ kind: string; id: string; unit: string | null }> | null;
  if (!o || typeof o.id !== 'string') return null;
  if (o.kind === 'apt') return { kind: 'apt', id: o.id };
  if (o.kind === 'lot') return { kind: 'lot', id: o.id, unit: typeof o.unit === 'string' ? o.unit : null };
  return null;
}

export function householdData(r: Rec | undefined): HouseholdData {
  const d = (r?.data ?? {}) as Partial<HouseholdData>;
  return { name: typeof d.name === 'string' ? d.name : '', home: cleanHome(d.home), notes: typeof d.notes === 'string' ? d.notes : '' };
}

export const homeKey = (h: Home) => (h.kind === 'apt' ? `apt:${h.id}` : `lot:${h.id}${h.unit ? `:${h.unit}` : ''}`);
export const homeLot = (h: Home | null) => (h?.kind === 'lot' ? h.id : null);

const isResidential = (type: string) => BY_ID.lotTypes.get(type)?.kind === 'residential';

/** One place a household could live. */
export type HomeOption = {
  key: string;
  home: Home;
  /** The lot's name, plus the unit ("Banks Bungalow · Unit C"). */
  title: string;
  lotId: string | null;
  world: string | null;
  /** Rental units: the landlord household, if any. */
  landlord: string | null;
  kind: 'lot' | 'unit' | 'apt';
  placed: boolean;
  size: string;
};

/**
 * Every home in the save: your residential lots (rentals as their units; a rental with no units yet
 * counts as one home), then the game's apartments. Your downloaded apartments aren't homes on their own;
 * they're lived in through the game apartment they're used in.
 */
export function homeOptions(rows: LotRow[], apartments: GameLot[]): HomeOption[] {
  const out: HomeOption[] = [];
  for (const r of rows) {
    if (r.id.startsWith('apt:') || r.lot.type === APARTMENT || !isResidential(r.lot.type)) continue;
    const base = { lotId: r.id, world: r.world, landlord: null, placed: !!r.spot, size: r.spot?.size ?? r.lot.size };
    if (r.lot.type === RESIDENTIAL_RENTAL && r.lot.units.length) {
      for (const u of r.lot.units) {
        out.push({ ...base, key: homeKey({ kind: 'lot', id: r.id, unit: u.id }), home: { kind: 'lot', id: r.id, unit: u.id }, title: `${r.lot.name} · ${u.name}`, landlord: r.lot.owner, kind: 'unit' });
      }
    } else {
      out.push({ ...base, key: homeKey({ kind: 'lot', id: r.id, unit: null }), home: { kind: 'lot', id: r.id, unit: null }, title: r.lot.name || 'Unnamed lot', kind: 'lot' });
    }
  }
  for (const a of apartments) {
    out.push({ key: homeKey({ kind: 'apt', id: a.id }), home: { kind: 'apt', id: a.id }, title: a.name, lotId: null, world: a.world, landlord: null, kind: 'apt', placed: true, size: '' });
  }
  return out;
}

// ---------- moving ----------
export type HH = { id: string; data: HouseholdData };
export type OwnedLot = { id: string; type: string; owner: string | null };
export type SimLink = { id: string; householdId: string | null };

/** What a move changes. Apply it with one put per item. */
export type Plan = {
  households: { id: string; data: HouseholdData }[];
  /** Households that go to Trash (the one merged away). */
  trash: string[];
  lots: { id: string; owner: string | null }[];
  sims: { id: string; householdId: string }[];
};

/** Who lives in a home right now (not counting `except`). */
export function occupantOf(households: HH[], home: Home, except?: string): HH | null {
  const k = homeKey(home);
  return households.find((h) => h.id !== except && h.data.home && homeKey(h.data.home) === k) ?? null;
}

/**
 * Moves a household into a home.
 * - Nobody there: they move in.
 * - Someone there, 'out': the others are moved out (no home, and they stop owning it).
 * - Someone there, 'merge': the mover's Sims join the household that lives there, under `name`
 *   (pick either name or a new one). The mover's household goes to Trash; its lots go with its Sims.
 */
export function moveIn(
  state: { households: HH[]; lots: OwnedLot[]; sims: SimLink[] },
  moverId: string, home: Home, mode: 'out' | 'merge' = 'out', name?: string,
): Plan {
  const plan: Plan = { households: [], trash: [], lots: [], sims: [] };
  const mover = state.households.find((h) => h.id === moverId);
  if (!mover) return plan;
  const owner = new Map(state.lots.map((l) => [l.id, l.owner]));
  const typeOf = new Map(state.lots.map((l) => [l.id, l.type]));
  const setOwner = (id: string, o: string | null) => {
    owner.set(id, o);
    const i = plan.lots.findIndex((x) => x.id === id);
    if (i >= 0) plan.lots[i] = { id, owner: o }; else plan.lots.push({ id, owner: o });
  };
  const newLot = homeLot(home);
  /** Leaving a lot you own (for a different lot) means you don't own it anymore. */
  const leave = (hh: HH, from: Home | null) => {
    const lot = homeLot(from);
    if (lot && lot !== newLot && owner.get(lot) === hh.id) setOwner(lot, null);
  };
  const occupant = occupantOf(state.households, home, moverId);

  if (occupant && mode === 'merge') {
    const keepName = (name ?? occupant.data.name).trim() || occupant.data.name;
    const notes = [occupant.data.notes.trim(), mover.data.notes.trim()].filter(Boolean).join('\n\n');
    leave(mover, mover.data.home);
    for (const l of state.lots) if (owner.get(l.id) === mover.id) setOwner(l.id, occupant.id);
    for (const s of state.sims) if (s.householdId === mover.id) plan.sims.push({ id: s.id, householdId: occupant.id });
    plan.households.push({ id: occupant.id, data: { ...occupant.data, name: keepName, notes } });
    plan.trash.push(mover.id);
    return plan;
  }

  if (occupant) {
    const lot = homeLot(home);
    if (lot && owner.get(lot) === occupant.id) setOwner(lot, null);
    plan.households.push({ id: occupant.id, data: { ...occupant.data, home: null } });
  }
  leave(mover, mover.data.home);
  plan.households.push({ id: mover.id, data: { ...mover.data, home } });
  if (home.kind === 'lot' && !home.unit && typeOf.get(home.id) !== RESIDENTIAL_RENTAL && !owner.get(home.id)) setOwner(home.id, mover.id);
  return plan;
}

// ---------- reading ----------
/** The little gray tags on a household card. */
export function householdTags(hh: HH, lots: OwnedLot[], home: HomeOption | null): string[] {
  const tags: string[] = [];
  const lot = homeLot(hh.data.home);
  const ownsHome = !!lot && lots.some((l) => l.id === lot && l.owner === hh.id);
  if (home?.kind === 'apt') tags.push('Apartment');
  else if (ownsHome) tags.push('Own it');
  else if (home) tags.push('Rent');
  if (lots.some((l) => l.owner === hh.id && l.type === RESIDENTIAL_RENTAL)) tags.push('Landlord');
  const more = lots.filter((l) => l.owner === hh.id && l.id !== lot).length;
  if (more) tags.push(`+${more} lot${more === 1 ? '' : 's'}`);
  return tags;
}

/** Who lives on a lot (any unit), for the Lots tables. */
export function residentsOf(households: HH[], lotId: string, aptId?: string | null): HH[] {
  return households.filter((h) => {
    const m = h.data.home;
    if (!m) return false;
    return m.kind === 'lot' ? m.id === lotId : !!aptId && m.id === aptId;
  });
}
