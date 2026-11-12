import type { Rec } from './sync/types';
import type { PhotoRef } from './photos';
import { dateOf, formatDate, SEASONS, type Calendar } from './time';

/**
 * The Photos area. One record per photo. It can have a game date and/or the day it was added (a real date),
 * the Sims in it, and optionally the calendar item it belongs to (a holiday, event, trip or birthday).
 */
export type PhotoItemKind = 'holiday' | 'event' | 'vacation' | 'birthday';
export type PhotoItem = { kind: PhotoItemKind; id: string };
export type PhotoData = {
  photo: PhotoRef;
  caption: string;
  simIds: string[];
  /** The game day it was taken, or null (not known, or the save doesn't track dates). */
  gameDay: number | null;
  /** When it was added, an ISO time. */
  added: string;
  item: PhotoItem | null;
  /** The club it's tagged with (a club id), or null. */
  clubId: string | null;
  /** The storyline it's tagged with (a storyline id), or null. */
  storylineId: string | null;
  /** The legacy it's tagged with (a legacy id), and the generation (a generation id), or null. */
  legacyId: string | null;
  genId: string | null;
};

export function photoData(r: Rec | undefined): PhotoData | null {
  const d = (r?.data ?? {}) as Partial<PhotoData>;
  if (!d.photo || typeof d.photo.id !== 'string') return null;
  return {
    photo: d.photo,
    caption: d.caption ?? '',
    simIds: Array.isArray(d.simIds) ? d.simIds : [],
    gameDay: typeof d.gameDay === 'number' ? d.gameDay : null,
    added: d.added ?? r?.edited_at ?? new Date(0).toISOString(),
    item: d.item && d.item.id ? d.item : null,
    clubId: typeof d.clubId === 'string' && d.clubId ? d.clubId : null,
    storylineId: typeof d.storylineId === 'string' && d.storylineId ? d.storylineId : null,
    legacyId: typeof d.legacyId === 'string' && d.legacyId ? d.legacyId : null,
    genId: typeof d.genId === 'string' && d.genId ? d.genId : null,
  };
}

export type PhotoRow = { id: string; p: PhotoData };
export const photoRows = (recs: Rec[]): PhotoRow[] => recs.flatMap((r) => { const p = photoData(r); return p ? [{ id: r.id, p }] : []; });

/**
 * Newest first. When the save tracks the game date, photos with a game date come first (latest game day first),
 * then the rest by the day they were added. Otherwise everything is by the day it was added.
 */
export function sortPhotos(rows: PhotoRow[], tracksDate: boolean): PhotoRow[] {
  const byAdded = (a: PhotoRow, b: PhotoRow) => b.p.added.localeCompare(a.p.added);
  return [...rows].sort((a, b) => {
    if (tracksDate) {
      const [x, y] = [a.p.gameDay, b.p.gameDay];
      if (x !== null && y !== null && x !== y) return y - x;
      if (x !== null && y === null) return -1;
      if (x === null && y !== null) return 1;
    }
    return byAdded(a, b);
  });
}

/** "Nov 4", or "Nov 4, 2025" when it isn't this year. */
export function addedText(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}

/**
 * The two date lines under a photo. The game date leads when there is one (that's what a player remembers),
 * with the day it was added small and quiet under it. With no game date, the added day leads on its own.
 */
export function photoDates(p: Pick<PhotoData, 'gameDay' | 'added'>, cal: Calendar | null, now = new Date()): { main: string; sub: string } {
  const added = addedText(p.added, now);
  if (p.gameDay !== null && cal) return { main: formatDate(dateOf(p.gameDay, cal), 'full'), sub: added ? `Added ${added}` : '' };
  return { main: added ? `Added ${added}` : '', sub: '' };
}

/** Photos of one Sim (tagged in them), newest first. */
export const photosOfSim = (rows: PhotoRow[], simId: string, tracksDate: boolean) => sortPhotos(rows.filter((r) => r.p.simIds.includes(simId)), tracksDate);
/** Photos tagged with one club. */
export const photosOfStory = (rows: PhotoRow[], storylineId: string, tracksDate: boolean) => sortPhotos(rows.filter((r) => r.p.storylineId === storylineId), tracksDate);
/** Photos tagged with a legacy (any generation) or, when `genId` is given, with that generation only. */
export const photosOfLegacy = (rows: PhotoRow[], legacyId: string, tracksDate: boolean, genId?: string) => sortPhotos(rows.filter((r) => r.p.legacyId === legacyId && (!genId || r.p.genId === genId)), tracksDate);
export const photosOfClub = (rows: PhotoRow[], clubId: string, tracksDate: boolean) => sortPhotos(rows.filter((r) => r.p.clubId === clubId), tracksDate);
/** Photos attached to one calendar item. */
export const photosOfItem = (rows: PhotoRow[], kind: PhotoItemKind, id: string, tracksDate: boolean) =>
  sortPhotos(rows.filter((r) => r.p.item?.kind === kind && r.p.item.id === id), tracksDate);

export type SortMode = 'game' | 'added';
type Group = { key: string; title: string };

/** Which grid section a photo belongs to. */
export function groupOf(r: PhotoRow, cal: Calendar | null, mode: SortMode): Group {
  if (mode === 'game' && cal) {
    if (r.p.gameDay === null) return { key: 'none', title: 'No game date' };
    const d = dateOf(r.p.gameDay, cal);
    return { key: `g${d.year}-${d.season}`, title: `${SEASONS[d.season]} · Year ${d.year}` };
  }
  const d = new Date(r.p.added);
  const ok = !Number.isNaN(d.getTime());
  return { key: ok ? `a${d.getFullYear()}-${d.getMonth()}` : 'a?', title: ok ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Earlier' };
}

/**
 * The grid's sections. By game season when sorting by game date ("Spring · Year 1", with "No game date" last),
 * otherwise by the month it was added ("November 2026"). Keeps the order it's given.
 */
export function groupPhotos(rows: PhotoRow[], cal: Calendar | null, mode: SortMode = 'game'): { key: string; title: string; rows: PhotoRow[] }[] {
  const out: { key: string; title: string; rows: PhotoRow[] }[] = [];
  for (const r of rows) {
    const g = groupOf(r, cal, mode);
    const last = out[out.length - 1];
    if (last && last.key === g.key) last.rows.push(r); else out.push({ ...g, rows: [r] });
  }
  return out;
}

// ---------- search and filters ----------
export const itemKey = (i: PhotoItem) => `${i.kind}:${i.id}`;
/** How the album turns ids into words. */
export type Namer = { simName(id: string): string; occasionName(item: PhotoItem): string; clubName(id: string): string };
/** `from` and `to` are game day numbers (first and last day, both counted), or null for any date. */
export type AlbumFilter = { simIds: string[]; from: number | null; to: number | null; occasion: string | null; club: string | null; q: string };
export const NO_ALBUM_FILTER: AlbumFilter = { simIds: [], from: null, to: null, occasion: null, club: null, q: '' };
export const hasRange = (f: Pick<AlbumFilter, 'from' | 'to'>) => f.from !== null && f.to !== null;
export const albumFilterOn = (f: AlbumFilter) => f.simIds.length > 0 || hasRange(f) || f.occasion !== null || f.club !== null || f.q.trim() !== '';

/** A date range in words. A whole season reads as the season ("Spring · Year 1"), otherwise "Spring 3 → Spring 12 · Year 1". */
export function rangeText(from: number | null, to: number | null, cal: Calendar): string {
  if (from === null || to === null) return '';
  const a = dateOf(from, cal); const b = dateOf(to, cal);
  const sd = (d: { season: number; day: number }) => `${SEASONS[d.season]} ${d.day}`;
  if (from === to) return `${sd(a)} · Year ${a.year}`;
  if (a.year === b.year && a.season === b.season && a.day === 1 && b.day === cal.seasonLength) return `${SEASONS[a.season]} · Year ${a.year}`;
  if (a.year === b.year) return `${sd(a)} → ${sd(b)} · Year ${a.year}`;
  return `${sd(a)} · Year ${a.year} → ${sd(b)} · Year ${b.year}`;
}

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'");

/** Every word typed has to be found in the caption, a tagged Sim's name or the occasion's name (in any order). */
export function matchesText(p: PhotoData, q: string, n: Namer): boolean {
  const ws = words(norm(q));
  if (!ws.length) return true;
  const hay = norm([p.caption, ...p.simIds.map(n.simName), p.item ? n.occasionName(p.item) : '', p.clubId ? n.clubName(p.clubId) : ''].join(' '));
  return ws.every((w) => hay.includes(w));
}

/** The filter sheet and the search box together. Several Sims means photos with all of them in. A date range only keeps photos that have a game date inside it. */
export function filterPhotos(rows: PhotoRow[], f: AlbumFilter, n: Namer): PhotoRow[] {
  return rows.filter((r) =>
    f.simIds.every((id) => r.p.simIds.includes(id))
    && (f.occasion === null || (r.p.item !== null && itemKey(r.p.item) === f.occasion))
    && (f.club === null || r.p.clubId === f.club)
    && (!hasRange(f) || (r.p.gameDay !== null && r.p.gameDay >= f.from! && r.p.gameDay <= f.to!))
    && matchesText(r.p, f.q, n));
}

export type Suggestions = {
  sims: { id: string; name: string; count: number }[];
  occasions: { key: string; name: string; count: number }[];
  clubs: { id: string; name: string; count: number }[];
  captions: { id: string; caption: string }[];
};

/** What to offer while typing, grouped like the Photos app: Sims, Occasions, then captions. */
export function suggest(rows: PhotoRow[], q: string, n: Namer, limit = 5): Suggestions {
  const ws = words(norm(q));
  const out: Suggestions = { sims: [], occasions: [], clubs: [], captions: [] };
  if (!ws.length) return out;
  const hit = (text: string) => { const t = norm(text); return ws.every((w) => t.includes(w)); };
  const sims = new Map<string, number>(); const occ = new Map<string, { name: string; count: number }>(); const clubs = new Map<string, number>();
  for (const r of rows) {
    for (const id of r.p.simIds) sims.set(id, (sims.get(id) ?? 0) + 1);
    if (r.p.item) { const k = itemKey(r.p.item); const o = occ.get(k); if (o) o.count++; else occ.set(k, { name: n.occasionName(r.p.item), count: 1 }); }
    if (r.p.clubId) clubs.set(r.p.clubId, (clubs.get(r.p.clubId) ?? 0) + 1);
    if (r.p.caption && hit(r.p.caption) && out.captions.length < limit) out.captions.push({ id: r.id, caption: r.p.caption });
  }
  for (const [id, count] of sims) { const name = n.simName(id); if (hit(name)) out.sims.push({ id, name, count }); }
  for (const [key, o] of occ) if (hit(o.name)) out.occasions.push({ key, name: o.name, count: o.count });
  for (const [id, count] of clubs) { const name = n.clubName(id); if (name && hit(name)) out.clubs.push({ id, name, count }); }
  out.clubs.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); out.clubs.length = Math.min(out.clubs.length, limit);
  out.sims.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); out.sims.length = Math.min(out.sims.length, limit);
  out.occasions.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); out.occasions.length = Math.min(out.occasions.length, limit);
  return out;
}
