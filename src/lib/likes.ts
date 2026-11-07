/**
 * Likes, dislikes, turn ons and turn offs on a Sim. Each is a list of words the player typed.
 * Likes and dislikes share one list of choices, turn ons and turn offs share another; the
 * choices are every word already used on any Sim in the save (nothing is stored separately).
 */
export type LikeKey = 'likes' | 'dislikes' | 'turnOns' | 'turnOffs';

export type LikeField = { k: LikeKey; label: string; one: string; opposite: LikeKey };
export const LIKE_FIELDS: LikeField[] = [
  { k: 'likes', label: 'Likes', one: 'like', opposite: 'dislikes' },
  { k: 'dislikes', label: 'Dislikes', one: 'dislike', opposite: 'likes' },
  { k: 'turnOns', label: 'Turn ons', one: 'turn on', opposite: 'turnOffs' },
  { k: 'turnOffs', label: 'Turn offs', one: 'turn off', opposite: 'turnOns' },
];
export const likeField = (k: LikeKey) => LIKE_FIELDS.find((f) => f.k === k)!;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Trims, drops empty and repeated words (ignoring capitals), keeps the first spelling. */
export function cleanLikes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim().replace(/\s+/g, ' ');
    if (t && !out.some((o) => same(o, t))) out.push(t);
  }
  return out.slice(0, 60);
}

export const hasLike = (list: string[], word: string) => list.some((x) => same(x, word));
export const addLike = (list: string[], word: string) => (hasLike(list, word) || !word.trim() ? list : cleanLikes([...list, word]));
export const dropLike = (list: string[], word: string) => list.filter((x) => !same(x, word));

export type LikeChoice = { label: string; sims: number };

/**
 * The choices for one field: every word used in that field or its partner on any Sim,
 * with how many Sims use it. Spelled the way it was first typed. A to Z.
 */
export function likeChoices(all: Partial<Record<LikeKey, unknown>>[], k: LikeKey): LikeChoice[] {
  const pair = [k, likeField(k).opposite];
  const map = new Map<string, LikeChoice>();
  for (const d of all) {
    const seen = new Set<string>();
    for (const key of pair) {
      for (const w of cleanLikes(d[key])) {
        const id = w.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);
        const c = map.get(id);
        if (c) c.sims += 1; else map.set(id, { label: w, sims: 1 });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
