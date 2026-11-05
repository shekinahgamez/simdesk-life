import type { Rec } from './sync/types';
import type { StageId } from './time';

/**
 * Clubs (The Sims 4: Get Together). One record per club. A club has people, a place it meets, rules about activities,
 * who can join, and perks. Activities, requirements and perks are typed in; the game has far too many to list.
 */
export const GET_TOGETHER = 'get-together';
/** A Sim can be in this many clubs at once. */
export const MAX_CLUBS_PER_SIM = 3;
export const MAX_ACTIVITIES = 5;
export const MAX_REQUIREMENTS = 5;

export type Activity = { text: string; /** Another club this is aimed at ("Be Nice" to Night Owls), or null. */ club: string | null };
export type ReqCat = 'age' | 'career' | 'marital' | 'wealth' | 'trait' | 'skill';
export const REQ_CATS: { id: ReqCat; label: string }[] = [
  { id: 'age', label: 'Age' }, { id: 'career', label: 'Career' }, { id: 'marital', label: 'Marital status' },
  { id: 'wealth', label: 'Wealth' }, { id: 'trait', label: 'Trait' }, { id: 'skill', label: 'Skill' },
];
export const reqCatLabel = (c: ReqCat) => REQ_CATS.find((x) => x.id === c)?.label ?? c;
export type Requirement = { cat: ReqCat; value: string };
export type PerkKind = 'status' | 'vibe' | 'skill' | 'other';
export const PERK_KINDS: { id: PerkKind; label: string }[] = [
  { id: 'status', label: 'Status' }, { id: 'vibe', label: 'Vibe' }, { id: 'skill', label: 'Skill' }, { id: 'other', label: 'Other' },
];
export const perkKindLabel = (k: PerkKind) => PERK_KINDS.find((x) => x.id === k)?.label ?? k;
export type Perk = { kind: PerkKind; text: string };
/** Where it meets: one of your lots, any lot of a type, or nowhere in particular (the leader's lot). */
export type Place = { kind: 'lot' | 'type'; id: string };
export type Admission = 'open' | 'invite';

export type ClubData = {
  name: string;
  description: string;
  admission: Admission;
  /** Sim ids. */
  members: string[];
  /** A Sim id, always one of the members, or null. */
  leader: string | null;
  place: Place | null;
  encouraged: Activity[];
  banned: Activity[];
  requirements: Requirement[];
  perks: Perk[];
  notes: string;
};
export const BLANK_CLUB: ClubData = {
  name: '', description: '', admission: 'open', members: [], leader: null, place: null,
  encouraged: [], banned: [], requirements: [], perks: [], notes: '',
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';

export function clubData(r: Rec | undefined): ClubData {
  const d = (r?.data ?? {}) as Record<string, unknown>;
  const members = list(d.members, (x): x is string => typeof x === 'string');
  const leader = typeof d.leader === 'string' && members.includes(d.leader) ? d.leader : null;
  const place = isObj(d.place) && (d.place.kind === 'lot' || d.place.kind === 'type') && typeof d.place.id === 'string' && d.place.id ? { kind: d.place.kind, id: d.place.id } as Place : null;
  const acts = (v: unknown) => list(v, isObj).map((a) => ({ text: str(a.text), club: typeof a.club === 'string' ? a.club : null })).filter((a) => a.text.trim()).slice(0, MAX_ACTIVITIES);
  return {
    name: str(d.name), description: str(d.description), admission: d.admission === 'invite' ? 'invite' : 'open',
    members, leader, place,
    encouraged: acts(d.encouraged), banned: acts(d.banned),
    requirements: list(d.requirements, isObj).filter((x) => REQ_CATS.some((c) => c.id === x.cat) && str(x.value).trim()).map((x) => ({ cat: x.cat as ReqCat, value: str(x.value) })).slice(0, MAX_REQUIREMENTS),
    perks: list(d.perks, isObj).filter((x) => PERK_KINDS.some((k) => k.id === x.kind) && str(x.text).trim()).map((x) => ({ kind: x.kind as PerkKind, text: str(x.text) })),
    notes: str(d.notes),
  };
}

export type ClubRow = { id: string; club: ClubData };
export const clubRows = (recs: Rec[]): ClubRow[] =>
  recs.map((r) => ({ id: r.id, club: clubData(r) })).sort((a, b) => a.club.name.localeCompare(b.club.name, undefined, { sensitivity: 'base' }));

/** Clubs a Sim belongs to, and whether they lead each. */
export const clubsOfSim = (rows: ClubRow[], simId: string) => rows.filter((r) => r.club.members.includes(simId)).map((r) => ({ ...r, leads: r.club.leader === simId }));
/** How many clubs a Sim is in, not counting one club (the one being edited). */
export const clubCountOf = (rows: ClubRow[], simId: string, exceptClub?: string | null) => rows.filter((r) => r.id !== exceptClub && r.club.members.includes(simId)).length;

/** The game lets Child Sims and older join. Newborns, infants and toddlers can't. An unknown age is allowed. */
const TOO_YOUNG: StageId[] = ['newborn', 'infant', 'toddler'];
export const canJoinClub = (stage: StageId | null) => !stage || !TOO_YOUNG.includes(stage);

/** Changing the members keeps the leader one of them: a missing leader falls back to the first member. */
export function withMembers(club: ClubData, members: string[]): ClubData {
  const leader = club.leader && members.includes(club.leader) ? club.leader : members[0] ?? null;
  return { ...club, members, leader };
}

/** Drop blank activities, trim text, and clear aims at a club that's gone or is this club. */
export function cleanClub(club: ClubData, selfId: string | null, existing: Set<string>): ClubData {
  const acts = (a: Activity[]) => a.map((x) => ({ text: x.text.trim(), club: x.club && x.club !== selfId && existing.has(x.club) ? x.club : null })).filter((x) => x.text).slice(0, MAX_ACTIVITIES);
  return {
    ...club, name: club.name.trim(), description: club.description.trim(), notes: club.notes.trim(),
    encouraged: acts(club.encouraged), banned: acts(club.banned),
    requirements: club.requirements.filter((r) => r.value.trim()).slice(0, MAX_REQUIREMENTS),
    perks: club.perks.map((p) => ({ ...p, text: p.text.trim() })).filter((p) => p.text),
  };
}

/** Activities other clubs already use that match what's typed (a different spelling of the same thing is the usual slip). */
export function activitySuggestions(rows: ClubRow[], selfId: string | null, typed: string, limit = 4): { text: string; from: string }[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const seen = new Map<string, { text: string; from: string }>();
  for (const r of rows) {
    if (r.id === selfId) continue;
    for (const a of [...r.club.encouraged, ...r.club.banned]) {
      const k = a.text.trim().toLowerCase();
      if (k.includes(q) && k !== q && !seen.has(k)) seen.set(k, { text: a.text.trim(), from: r.club.name });
    }
  }
  return [...seen.values()].slice(0, limit);
}

export const admissionLabel = (a: Admission) => (a === 'open' ? 'Open invitation' : 'Invite only');
