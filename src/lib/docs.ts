import type { Rec } from './sync/types';
import iconNames from './iconSetNames.json';

/**
 * Docs (the Docs module, id `journal`). Two kinds of record:
 *  - `doc`: one document, a title.
 *  - `doctab`: one tab of a doc. A tab has a page of its own. A tab with no `parent` is a top-level tab;
 *    a tab with a `parent` is a sub-tab. Sub-tabs go ONE level deep: a sub-tab can't have sub-tabs.
 * Tabs are their own records so two devices never overwrite each other's pages.
 */
export type DocData = { title: string };
export const BLANK_DOC: DocData = { title: '' };

export type TabData = {
  doc: string;
  /** Parent tab id, or '' for a top-level tab. */
  parent: string;
  title: string;
  /** Icon file name from the icon set (like "115-world"). */
  icon: string;
  /** A hex ink for the icon, or '' for the icon's own color. */
  color: string;
  /** Position among its siblings. */
  order: number;
  /** The page. Plain text with `#` / `##` headings and `-` bullets. */
  body: string;
};
export const DEFAULT_ICON = '186-journal';
export const BLANK_TAB: TabData = { doc: '', parent: '', title: '', icon: DEFAULT_ICON, color: '', order: 0, body: '' };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function docData(r: Rec | undefined): DocData {
  return { title: str((r?.data as Record<string, unknown> | undefined)?.title) };
}
export function tabData(r: Rec | undefined): TabData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const order = typeof d.order === 'number' && Number.isFinite(d.order) ? d.order : 0;
  return { doc: str(d.doc), parent: str(d.parent), title: str(d.title), icon: str(d.icon) || DEFAULT_ICON, color: /^#[0-9A-Fa-f]{6}$/.test(str(d.color)) ? str(d.color) : '', order, body: str(d.body) };
}

export type TabRow = { id: string; t: TabData; /** 0 for a tab, 1 for a sub-tab. */ depth: 0 | 1; children: TabRow[] };

/** The tabs of one doc as a tree (tabs, each with its sub-tabs), in order. A sub-tab whose parent is gone (or is itself a sub-tab) shows as a top-level tab so nothing is lost. */
export function tabTree(recs: Rec[], docId: string): TabRow[] {
  const all = recs.filter((r) => !r.deleted_at).map((r) => ({ id: r.id, t: tabData(r) })).filter((x) => x.t.doc === docId);
  const byId = new Map(all.map((x) => [x.id, x]));
  const cmp = (a: { id: string; t: TabData }, b: { id: string; t: TabData }) => a.t.order - b.t.order || (a.id < b.id ? -1 : 1);
  const isTop = (x: { id: string; t: TabData }) => !x.t.parent || !byId.has(x.t.parent) || !!byId.get(x.t.parent)!.t.parent;
  const tops = all.filter(isTop).sort(cmp);
  return tops.map((x) => ({
    ...x, depth: 0 as const,
    children: all.filter((y) => y.t.parent === x.id && !isTop(y)).sort(cmp).map((y) => ({ ...y, depth: 1 as const, children: [] })),
  }));
}

/** Every tab in reading order: a tab, then its sub-tabs. */
export const flatTabs = (tree: TabRow[]): TabRow[] => tree.flatMap((t) => [t, ...t.children]);

/** The order numbers that put `id` one step up (-1) or down (+1) among its siblings. Returns the changes as id to new order, or null at the end of the list. */
export function moveOrders(tree: TabRow[], id: string, dir: -1 | 1): Map<string, number> | null {
  const top = tree.findIndex((t) => t.id === id);
  const sibs = top >= 0 ? tree : tree.find((t) => t.children.some((c) => c.id === id))?.children ?? [];
  const i = sibs.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return null;
  const ids = sibs.map((s) => s.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return new Map(ids.map((x, n) => [x, n]));
}

/** The order number for a new tab at the end of its siblings. */
export function nextOrder(tree: TabRow[], parent: string): number {
  const sibs = parent ? tree.find((t) => t.id === parent)?.children ?? [] : tree;
  return sibs.reduce((m, s) => Math.max(m, s.t.order + 1), 0);
}

/** A tab and its sub-tabs (the ids that go to Trash together). */
export function subtreeIds(tree: TabRow[], id: string): string[] {
  const t = tree.find((x) => x.id === id);
  return t ? [t.id, ...t.children.map((c) => c.id)] : [id];
}

/** How many tabs a doc has (sub-tabs count). */
export const tabCount = (recs: Rec[], docId: string) => flatTabs(tabTree(recs, docId)).length;

/** Where the page lands when a doc opens: the tab you last read if it still exists, else the first one. */
export function landingTab(tree: TabRow[], last: string | null): string | null {
  const flat = flatTabs(tree);
  return flat.find((t) => t.id === last)?.id ?? flat[0]?.id ?? null;
}

// ---------- the page text ----------
export type Block = { kind: 'h1' | 'h2' | 'p'; text: string } | { kind: 'ul'; items: string[] };
/** Turns the page text into blocks. `# ` and `## ` make headings, `- ` makes bullets, blank lines split paragraphs. */
export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join('\n') }); para = []; } };
  for (const line of body.replace(/\r/g, '').split('\n')) {
    const h = /^(#{1,2})\s+(.*)$/.exec(line);
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (h) { flush(); out.push({ kind: h[1].length === 1 ? 'h1' : 'h2', text: h[2] }); }
    else if (li) {
      flush();
      const last = out[out.length - 1];
      if (last && last.kind === 'ul') last.items.push(li[1]); else out.push({ kind: 'ul', items: [li[1]] });
    } else if (!line.trim()) flush();
    else para.push(line);
  }
  flush();
  return out;
}

// ---------- icons ----------
export const ICONS: { file: string; name: string }[] = iconNames as { file: string; name: string }[];
/** A short first row in the icon picker. */
export const SUGGESTED_ICONS = ['186-journal', '115-world', '129-neighborhood', '116-lot', '187-storyline', '174-lore', '185-rules', '184-challenge', '100-law', '067-rival', '073-household', '092-business', '183-legacy', '071-club', '065-gossip', '135-calendar', '178-photo', '202-favorite'];
/** The inks the set already uses, for the color row. */
export const INKS = ['#6B49C2', '#2F62D6', '#167C6D', '#4C7A12', '#A86F00', '#D6492E', '#B23A7D', '#6E6168'];

/** The icon's SVG text in the chosen ink. `native` is the SVG as it comes in the set. */
export function inkSvg(native: string, color: string): string {
  return color ? native.replace(/#[0-9A-Fa-f]{6}/g, color) : native;
}
export const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const iconMatches = (q: string) => {
  const n = q.trim().toLowerCase();
  return n ? ICONS.filter((i) => i.name.toLowerCase().includes(n)) : ICONS.filter((i) => SUGGESTED_ICONS.includes(i.file)).sort((a, b) => SUGGESTED_ICONS.indexOf(a.file) - SUGGESTED_ICONS.indexOf(b.file));
};
