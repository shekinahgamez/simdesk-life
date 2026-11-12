import type { Rec } from './sync/types';

/**
 * Legacy (the Legacy module). Two kinds of record:
 *  - `legacy`: one legacy (a family line), with its Story, households, and rules. No scoring.
 *  - `generation`: one generation of a legacy: heir, spares, goals, a Story, and a few details.
 * Generations are their own records so two devices never overwrite each other's edits. No minimum or maximum count.
 */
export type Goal = { text: string; done: boolean; optional: boolean };
export type LegacyData = {
  name: string;
  /** The legacy's Story (free text). */
  story: string;
  /** Household ids that belong to this legacy. */
  households: string[];
  rules: string[];
  /** The generation (record id) shown first. Empty = the first one with goals left. */
  current: string;
};
export const BLANK_LEGACY: LegacyData = { name: '', story: '', households: [], rules: [], current: '' };

export type GenData = {
  legacy: string;
  /** 1, 2, 3... */
  n: number;
  /** What the generation is called, like "Jade · Green". */
  title: string;
  story: string;
  heir: string | null;
  spares: string[];
  traits: string[];
  aspiration: string;
  career: string;
  skills: string;
  goals: Goal[];
};
export const BLANK_GEN: GenData = { legacy: '', n: 1, title: '', story: '', heir: null, spares: [], traits: [], aspiration: '', career: '', skills: '', goals: [] };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function legacyData(r: Rec | undefined): LegacyData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  return {
    name: str(d.name), story: str(d.story), households: ids(d.households),
    rules: Array.isArray(d.rules) ? d.rules.map((x) => str(x).trim()).filter(Boolean) : [], current: str(d.current),
  };
}

export function genData(r: Rec | undefined): GenData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const goals = Array.isArray(d.goals) ? d.goals.filter(isObj).map((g) => ({ text: str(g.text).trim(), done: !!g.done, optional: !!g.optional })).filter((g) => g.text) : [];
  return {
    legacy: str(d.legacy), n: typeof d.n === 'number' && Number.isFinite(d.n) ? d.n : 1, title: str(d.title), story: str(d.story),
    heir: typeof d.heir === 'string' && d.heir ? d.heir : null, spares: ids(d.spares),
    traits: Array.isArray(d.traits) ? d.traits.map((x) => str(x).trim()).filter(Boolean) : [], aspiration: str(d.aspiration), career: str(d.career), skills: str(d.skills), goals,
  };
}

export type LegacyRow = { id: string; l: LegacyData };
export type GenRow = { id: string; g: GenData };
export const legacyRows = (recs: Rec[]): LegacyRow[] => recs.map((r) => ({ id: r.id, l: legacyData(r) })).sort((a, b) => a.l.name.localeCompare(b.l.name));
export const genRows = (recs: Rec[]): GenRow[] => recs.map((r) => ({ id: r.id, g: genData(r) })).sort((a, b) => a.g.n - b.g.n);
export const gensOf = (rows: GenRow[], legacyId: string) => rows.filter((r) => r.g.legacy === legacyId);

/** "Gen 3". */
export const genLabel = (g: GenData) => `Gen ${g.n}`;
/** "Jade · Green", or "Generation 3" when it has no name yet. */
export const genTitle = (g: GenData) => g.title.trim() || `Generation ${g.n}`;

/** Goals that count (optional ones never block finishing). */
export function progress(g: GenData): { done: number; total: number } {
  const all = g.goals;
  return { done: all.filter((x) => x.done).length, total: all.length };
}
/** True when every goal that isn't optional is ticked (and there is at least one goal). */
export function finished(g: GenData): boolean {
  const must = g.goals.filter((x) => !x.optional);
  return must.length > 0 && must.every((x) => x.done);
}

/** The current generation: the one picked, else the first with goals left, else the last. */
export function currentGen(legacy: LegacyData, gens: GenRow[]): GenRow | null {
  if (!gens.length) return null;
  return gens.find((g) => g.id === legacy.current) ?? gens.find((g) => !finished(g.g)) ?? gens[gens.length - 1];
}

export type GenListItem = { kind: 'gen'; row: GenRow } | { kind: 'fold'; rows: GenRow[] };
/** More finished generations than this fold into one row. */
export const FOLD_AFTER = 5;
/**
 * What the Legacy page lists after the current generation: the others in order, with finished ones folded into one row
 * once there are more than FOLD_AFTER of them. Generations after the current one are never folded.
 */
export function listItems(gens: GenRow[], current: GenRow | null): GenListItem[] {
  const rest = gens.filter((g) => g.id !== current?.id);
  const done = rest.filter((g) => finished(g.g) && (!current || g.g.n < current.g.n));
  if (done.length <= FOLD_AFTER) return rest.map((row) => ({ kind: 'gen' as const, row }));
  const out: GenListItem[] = [{ kind: 'fold', rows: done }];
  for (const row of rest) if (!done.includes(row)) out.push({ kind: 'gen', row });
  return out;
}
/** "Gen 1 to 6 · done", or "5 generations · done" when they aren't one run. */
export function foldLabel(rows: GenRow[]): string {
  const ns = rows.map((r) => r.g.n).sort((a, b) => a - b);
  const run = ns.every((n, i) => i === 0 || n === ns[i - 1] + 1);
  return run ? `Gen ${ns[0]} to ${ns[ns.length - 1]} · done` : `${ns.length} generations · done`;
}

/** Pasted lines to generation titles. Drops blank lines and leading "1.", "Gen 2:", "- " markers. */
export function parseGenList(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim().replace(/^(?:[-*•]\s*|(?:gen(?:eration)?\s*)?\d+\s*[.):\-–]\s*)/i, '').trim()).filter(Boolean);
}
