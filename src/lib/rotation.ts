/**
 * Rotation: which households take turns, in what order, and for how long.
 *
 * Stored on the save (SaveData.rotation). `order` is a loop: after the last household it goes back
 * to the first. `current` is the household being played now; its turn began on `startDay`. A round
 * is one trip around the loop; it ticks over each time the turn reaches `roundStart` again.
 * Ending a turn never moves the date. Next day / Jump ahead do that.
 */
export type Rotation = {
  order: string[];
  /** Days per turn, per household. Missing means DEFAULT_TURN. */
  lengths: Record<string, number>;
  current: string | null;
  startDay: number;
  round: number;
  /** The household each new round starts with. */
  roundStart: string | null;
};

export const DEFAULT_TURN = 3;
export const TURN_CHOICES = [1, 2, 3, 4, 5, 7, 14];
export const EMPTY_ROTATION: Rotation = { order: [], lengths: {}, current: null, startDay: 0, round: 1, roundStart: null };

/** Cleans a stored rotation and drops households that no longer exist. */
export function cleanRotation(raw: unknown, exists?: (id: string) => boolean): Rotation {
  const o = (raw ?? {}) as Partial<Rotation>;
  const order = [...new Set((Array.isArray(o.order) ? o.order : []).filter((x): x is string => typeof x === 'string' && (!exists || exists(x))))];
  const lengths: Record<string, number> = {};
  for (const id of order) {
    const n = o.lengths?.[id];
    if (typeof n === 'number' && n >= 1) lengths[id] = Math.round(n);
  }
  const current = typeof o.current === 'string' && order.includes(o.current) ? o.current : (order[0] ?? null);
  const roundStart = typeof o.roundStart === 'string' && order.includes(o.roundStart) ? o.roundStart : (order[0] ?? null);
  return {
    order, lengths, current, roundStart,
    startDay: typeof o.startDay === 'number' ? o.startDay : 0,
    round: typeof o.round === 'number' && o.round >= 1 ? Math.floor(o.round) : 1,
  };
}

export const turnLength = (r: Rotation, id: string) => r.lengths[id] ?? DEFAULT_TURN;

/** Households after the one playing now, in the order they'll play. */
export function upNext(r: Rotation): string[] {
  if (!r.current) return [];
  const i = r.order.indexOf(r.current);
  return [...r.order.slice(i + 1), ...r.order.slice(0, i)];
}

/** Which day of the turn today is (1 = the day it started). */
export const turnDay = (r: Rotation, today: number) => Math.max(1, today - r.startDay + 1);

/** The days the current turn covered, for the End turn sheet: start day to today. */
export const turnSpan = (r: Rotation, today: number) => ({ from: r.startDay, to: Math.max(r.startDay, today), days: turnDay(r, today) });

/** Starts `id`'s turn today. The round ticks over when the turn comes back around to roundStart. */
function startTurn(r: Rotation, id: string, today: number): Rotation {
  const newRound = id === r.roundStart && r.current !== null && id !== r.current;
  return { ...r, current: id, startDay: today, round: newRound ? r.round + 1 : r.round };
}

/** Ends the current turn; the next household in the loop starts today. */
export function endTurn(r: Rotation, today: number): Rotation {
  const next = upNext(r)[0];
  if (!next) return { ...r, startDay: today };
  return startTurn(r, next, today);
}

/** Moves `id` to right after the one playing now. */
export function playNext(r: Rotation, id: string): Rotation {
  if (!r.current || id === r.current || !r.order.includes(id)) return r;
  const rest = upNext(r).filter((x) => x !== id);
  return { ...r, order: [r.current, id, ...rest] };
}

/** `id` starts playing today. Whoever was up keeps their place after them. */
export function playNow(r: Rotation, id: string, today: number): Rotation {
  if (id === r.current || !r.order.includes(id)) return r;
  return startTurn(playNext(r, id), id, today);
}

/** Puts the up-next list in a new order (the one playing now stays put). */
export function reorder(r: Rotation, next: string[]): Rotation {
  if (!r.current) return r;
  const keep = upNext(r);
  const clean = next.filter((x) => keep.includes(x));
  if (clean.length !== keep.length) return r;
  return { ...r, order: [r.current, ...clean] };
}

/** Adds households at the end of the line. The first one added to an empty rotation starts playing today. */
export function addHouseholds(r: Rotation, ids: string[], days: number, today: number): Rotation {
  const fresh = ids.filter((x) => !r.order.includes(x));
  if (!fresh.length) return r;
  const lengths = { ...r.lengths };
  for (const id of fresh) if (days !== DEFAULT_TURN) lengths[id] = days;
  // New households join just before the one playing now comes back around (the end of the loop).
  const loop = r.current ? [r.current, ...upNext(r)] : [];
  const order = [...loop, ...fresh];
  if (!r.current) return { ...r, order, lengths, current: fresh[0], startDay: today, round: 1, roundStart: fresh[0] };
  return { ...r, order, lengths };
}

export const setLength = (r: Rotation, id: string, days: number): Rotation => {
  const lengths = { ...r.lengths };
  if (days === DEFAULT_TURN) delete lengths[id]; else lengths[id] = Math.max(1, Math.round(days));
  return { ...r, lengths };
};

/** Takes a household out. If it was playing, the next one starts today. */
export function removeHousehold(r: Rotation, id: string, today: number): Rotation {
  if (!r.order.includes(id)) return r;
  let out = r;
  if (r.current === id) out = upNext(r).length ? endTurn(r, today) : { ...r, current: null };
  const order = out.order.filter((x) => x !== id);
  const lengths = { ...out.lengths };
  delete lengths[id];
  let roundStart = out.roundStart;
  if (roundStart === id) {
    const i = r.order.indexOf(id);
    roundStart = order.length ? r.order[(i + 1) % r.order.length] : null;
    if (roundStart === id) roundStart = null;
  }
  if (!order.length) return { ...EMPTY_ROTATION };
  return { ...out, order, lengths, roundStart, current: out.current && order.includes(out.current) ? out.current : order[0] };
}

/** Where `id` stands: playing, or how many turns away. */
export function standing(r: Rotation, id: string): { kind: 'now' } | { kind: 'next'; place: number } | null {
  if (r.current === id) return { kind: 'now' };
  const i = upNext(r).indexOf(id);
  return i < 0 ? null : { kind: 'next', place: i + 1 };
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
