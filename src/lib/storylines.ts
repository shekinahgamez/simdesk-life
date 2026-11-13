import type { Rec } from './sync/types';
import { normalize } from './text';

/**
 * Storylines (the Lore & Storylines module). Four kinds of record:
 *  - `storyline`: one arc, with its cast, a status, tags, open questions and episode notes.
 *  - `beat`: one thing that happened in a storyline, on a game day.
 *  - `secret`: who knows what. Each Sim in the cast is Knows, Guess or No.
 *  - `feeling`: how one Sim feels about another, and why.
 * Beats, secrets and feelings are their own records (not inside the storyline) so two devices never overwrite each other's edits.
 */
export type Status = 'brewing' | 'hot' | 'resolved';
export const STATUSES: { id: Status; label: string }[] = [
  { id: 'brewing', label: 'Brewing' }, { id: 'hot', label: 'Heating up' }, { id: 'resolved', label: 'Resolved' },
];
export const statusLabel = (s: Status) => STATUSES.find((x) => x.id === s)?.label ?? s;

export type Question = { text: string; done: boolean };
export type StorylineData = {
  name: string;
  status: Status;
  /** Sim ids. */
  cast: string[];
  pinned: boolean;
  tags: string[];
  /** Episode notes for content planning. */
  notes: string;
  questions: Question[];
};
export const BLANK_STORYLINE: StorylineData = { name: '', status: 'brewing', cast: [], pinned: false, tags: [], notes: '', questions: [] };

/** How exactly a beat's date is known. For 'season' and 'year' the `day` is a stand-in (middle of the season, middle of the year) so sorting still works. */
export type Precision = 'day' | 'season' | 'year';

export type BeatData = {
  storyline: string;
  text: string;
  sims: string[];
  /** Game day number (negative before the save began), or null when it has no date. */
  day: number | null;
  /** How exact the date is. Older beats without it are exact days. */
  precision: Precision;
  video: boolean;
  secret: boolean;
  /** Not happened yet. Old moments read as false. Planned moments stay out of the timeline until marked as happened. */
  planned: boolean;
  /** Real date it was added (ISO). */
  addedAt: string;
};

export type Know = 'knows' | 'guess' | 'no';
export const KNOWS: { id: Know; label: string }[] = [{ id: 'knows', label: 'Knows' }, { id: 'guess', label: 'Guess' }, { id: 'no', label: 'No' }];
export type SecretData = {
  title: string;
  /** The storyline it belongs to, or null. */
  storyline: string | null;
  /** Everyone knows now. */
  out: boolean;
  /** Sim id to what they know. A Sim missing here doesn't know. */
  knows: Record<string, Know>;
  /** Sim ids who are part of it (their rows show up in the table). */
  cast: string[];
};
export const BLANK_SECRET: SecretData = { title: '', storyline: null, out: false, knows: {}, cast: [] };

export type FeelKind = 'crush' | 'close' | 'mad' | 'wary' | 'other';
export const FEEL_KINDS: { id: FeelKind; label: string }[] = [
  { id: 'crush', label: 'Crush' }, { id: 'close', label: 'Close' }, { id: 'mad', label: 'Mad' }, { id: 'wary', label: 'Wary' }, { id: 'other', label: 'Other' },
];
export const feelLabel = (k: FeelKind) => FEEL_KINDS.find((x) => x.id === k)?.label ?? k;
export type FeelingData = { from: string; to: string; word: string; why: string; kind: FeelKind };
export const BLANK_FEELING: FeelingData = { from: '', to: '', word: '', why: '', kind: 'other' };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function storylineData(r: Rec | undefined): StorylineData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const questions = Array.isArray(d.questions)
    ? d.questions.filter(isObj).map((q) => ({ text: str(q.text).trim(), done: !!q.done })).filter((q) => q.text)
    : [];
  const tags = Array.isArray(d.tags) ? cleanTags(d.tags) : [];
  return {
    name: str(d.name), status: d.status === 'hot' || d.status === 'resolved' ? d.status : 'brewing',
    cast: ids(d.cast), pinned: !!d.pinned, tags, notes: str(d.notes), questions,
  };
}

export function beatData(r: Rec | undefined): BeatData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  return {
    storyline: str(d.storyline), text: str(d.text), sims: ids(d.sims), day: typeof d.day === 'number' && Number.isFinite(d.day) ? d.day : null,
    precision: d.precision === 'season' || d.precision === 'year' ? d.precision : 'day',
    video: !!d.video, secret: !!d.secret, planned: !!d.planned, addedAt: str(d.addedAt),
  };
}

export function secretData(r: Rec | undefined): SecretData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const knows: Record<string, Know> = {};
  if (isObj(d.knows)) for (const [k, v] of Object.entries(d.knows)) if (v === 'knows' || v === 'guess' || v === 'no') knows[k] = v;
  return { title: str(d.title), storyline: typeof d.storyline === 'string' && d.storyline ? d.storyline : null, out: !!d.out, knows, cast: ids(d.cast) };
}

export function feelingData(r: Rec | undefined): FeelingData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  return { from: str(d.from), to: str(d.to), word: str(d.word), why: str(d.why), kind: FEEL_KINDS.some((k) => k.id === d.kind) ? (d.kind as FeelKind) : 'other' };
}

export function cleanTags(v: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    const t = typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '';
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out;
}

export type StoryRow = { id: string; s: StorylineData };
export type BeatRow = { id: string; b: BeatData };
export type SecretRow = { id: string; sec: SecretData };
export type FeelRow = { id: string; f: FeelingData };

export const storyRows = (recs: Rec[]): StoryRow[] => recs.map((r) => ({ id: r.id, s: storylineData(r) }));
export const beatRows = (recs: Rec[]): BeatRow[] => recs.map((r) => ({ id: r.id, b: beatData(r) }));
export const secretRows = (recs: Rec[]): SecretRow[] => recs.map((r) => ({ id: r.id, sec: secretData(r) }));
export const feelRows = (recs: Rec[]): FeelRow[] => recs.map((r) => ({ id: r.id, f: feelingData(r) }));

/** Newest first: by game day, then by the real day it was added. A beat with no game day sorts by when it was added. */
export function sortBeats(rows: BeatRow[]): BeatRow[] {
  return [...rows].sort((a, b) => (b.b.day ?? -Infinity) - (a.b.day ?? -Infinity) || b.b.addedAt.localeCompare(a.b.addedAt));
}

/** Due: planned, has a date, and the day has come. Undated planned moments are never due. */
export const isDue = (b: BeatData, today: number | null) => b.planned && b.day != null && today != null && b.day <= today;

/** Planned moments in the order the Planned card and Today show them: due first, then soonest, then undated. */
export function sortPlanned(rows: BeatRow[], today: number | null): BeatRow[] {
  const rank = (r: BeatRow) => (isDue(r.b, today) ? 0 : r.b.day != null ? 1 : 2);
  return [...rows].sort((a, b) => rank(a) - rank(b) || (a.b.day ?? 0) - (b.b.day ?? 0) || a.b.addedAt.localeCompare(b.b.addedAt));
}

/** Where a storyline last moved: the newest beat. */
export function latestBeat(beats: BeatRow[], storyId: string): BeatRow | null {
  return sortBeats(beats.filter((x) => x.b.storyline === storyId))[0] ?? null;
}

/** Every Sim in a storyline: the cast plus anyone in its beats. */
export function castOf(s: StorylineData, beats: BeatRow[], storyId: string): string[] {
  const set = new Set(s.cast);
  for (const b of beats) if (b.b.storyline === storyId) for (const id of b.b.sims) set.add(id);
  return [...set];
}

export type StoryFilter = { q: string; sims: string[]; households: string[]; statuses: Status[]; tags: string[] };
export const NO_FILTER: StoryFilter = { q: '', sims: [], households: [], statuses: [], tags: [] };
export const filterCount = (f: StoryFilter) => (f.sims.length ? 1 : 0) + (f.households.length ? 1 : 0) + (f.statuses.length ? 1 : 0) + (f.tags.length ? 1 : 0);
export const filterActive = (f: StoryFilter) => !!f.q.trim() || filterCount(f) > 0;

/**
 * Which storylines show. Several Sims means storylines with all of them in. Households: any Sim from any chosen household.
 * Search looks at the name, tags and beats.
 */
export function filterStories(
  rows: StoryRow[], beats: BeatRow[], f: StoryFilter,
  opts: { householdOf(simId: string): string | null; simName(simId: string): string },
): StoryRow[] {
  const q = normalize(f.q);
  return rows.filter((r) => {
    const cast = castOf(r.s, beats, r.id);
    if (f.sims.length && !f.sims.every((id) => cast.includes(id))) return false;
    if (f.households.length && !cast.some((id) => { const h = opts.householdOf(id); return !!h && f.households.includes(h); })) return false;
    if (f.statuses.length && !f.statuses.includes(r.s.status)) return false;
    if (f.tags.length && !f.tags.every((t) => r.s.tags.some((x) => x.toLowerCase() === t.toLowerCase()))) return false;
    if (q) {
      const hay = normalize([r.s.name, ...r.s.tags, ...cast.map(opts.simName), ...beats.filter((b) => b.b.storyline === r.id).map((b) => b.b.text)].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Pinned first, then by status (heating up before brewing), then the newest activity. Resolved ones last. */
export function sortStories(rows: StoryRow[], beats: BeatRow[]): StoryRow[] {
  const rank = (s: Status) => (s === 'hot' ? 0 : s === 'brewing' ? 1 : 2);
  const last = (id: string) => latestBeat(beats, id)?.b.day ?? -Infinity;
  return [...rows].sort((a, b) =>
    Number(b.s.pinned) - Number(a.s.pinned) || rank(a.s.status) - rank(b.s.status) || last(b.id) - last(a.id) || a.s.name.localeCompare(b.s.name));
}

/** Tags in use, with a count of storylines for each. */
export function tagChoices(rows: StoryRow[]): { label: string; n: number }[] {
  const m = new Map<string, { label: string; n: number }>();
  for (const r of rows) for (const t of r.s.tags) { const k = t.toLowerCase(); const e = m.get(k); if (e) e.n++; else m.set(k, { label: t, n: 1 }); }
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Who is in the table for a secret: its own cast, plus anyone it has an answer for. */
export function secretPeople(s: SecretData): string[] {
  return [...new Set([...s.cast, ...Object.keys(s.knows)])];
}

export function knowOf(s: SecretData, simId: string): Know { return s.knows[simId] ?? 'no'; }

/** "1 knows, 1 guesses" style summary. */
export function knowsSummary(s: SecretData): string {
  if (s.out) return 'Out in the open';
  const people = secretPeople(s);
  const knows = people.filter((id) => knowOf(s, id) === 'knows').length;
  const guess = people.filter((id) => knowOf(s, id) === 'guess').length;
  if (!people.length) return 'No one added yet';
  if (knows === people.length) return people.length === 1 ? 'Only one Sim knows' : 'Everyone knows';
  const parts: string[] = [];
  if (knows) parts.push(`${knows} ${knows === 1 ? 'knows' : 'know'}`);
  if (guess) parts.push(`${guess} ${guess === 1 ? 'guesses' : 'guess'}`);
  return parts.length ? parts.join(', ') : 'No one knows yet';
}

/** Storylines a Sim is in (cast or a beat), most recent activity first. */
export function storiesOfSim(rows: StoryRow[], beats: BeatRow[], simId: string): StoryRow[] {
  return sortStories(rows.filter((r) => castOf(r.s, beats, r.id).includes(simId)), beats);
}

/** The markdown note for one storyline (for Obsidian). */
export function storyMarkdown(
  r: StoryRow, beats: BeatRow[], secrets: SecretRow[],
  n: { simName(id: string): string; dayText(day: number | null, precision?: Precision): string },
): string {
  const mine = sortBeats(beats.filter((b) => b.b.storyline === r.id)).reverse();
  const cast = castOf(r.s, beats, r.id).map((id) => `[[${n.simName(id)}]]`).join(', ');
  const lines: string[] = [`# ${r.s.name || 'Unnamed storyline'}`, '', `Status: ${statusLabel(r.s.status)}`];
  if (r.s.tags.length) lines.push(`Tags: ${r.s.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ')}`);
  if (cast) lines.push(`Cast: ${cast}`);
  lines.push('', '## What happened', '');
  if (!mine.length) lines.push('Nothing yet.');
  for (const b of mine) {
    const when = n.dayText(b.b.day, b.b.precision);
    lines.push(`- ${when ? `**${when}** ` : ''}${b.b.text}${b.b.video ? ' (content material)' : ''}${b.b.secret ? ' (secret)' : ''}`);
  }
  const sec = secrets.filter((s) => s.sec.storyline === r.id);
  if (sec.length) {
    lines.push('', '## Who knows what', '');
    for (const s of sec) {
      lines.push(`### ${s.sec.title || 'Unnamed secret'}${s.sec.out ? ' (out in the open)' : ''}`);
      for (const id of secretPeople(s.sec)) lines.push(`- ${n.simName(id)}: ${KNOWS.find((k) => k.id === knowOf(s.sec, id))!.label}`);
      lines.push('');
    }
  }
  const open = r.s.questions.filter((q) => !q.done);
  if (open.length) { lines.push('', '## Open questions', '', ...open.map((q) => `- ${q.text}`)); }
  if (r.s.notes.trim()) lines.push('', '## Episode notes', '', r.s.notes.trim());
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}
