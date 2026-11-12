/**
 * Import from game: reads a file written by the SimDesk Logger mod (cheat `simdesk.log`) and works out
 * what would change in SimDesk. Pure, so it can be tested. The review sheet (pages/GameImport.tsx)
 * shows the plan with a checkbox on every change and applies the ticked ones.
 *
 * Rules:
 * - Nothing is ever removed. Notes, photos, likes and anything typed in SimDesk are never touched.
 * - Sims are matched by their game id once known, otherwise by name. The id is kept after the first import.
 * - A career already typed in SimDesk (story titles like "A&R Head") is never overwritten unless the player ticks it.
 * - Life stage only changes when the stage itself changed (an age-up), never for daily drift.
 * - The date moves by how far the game moved since the last import. The first import just links the two.
 */
import { BY_ID, GAME } from '../data/game';
import type { SimData } from './sims';
import { fullName, initials, simAge, stageOf, BLANK_SIM } from './sims';
import { fmt, type MoneyData, type MoneyItem } from './money';
import { normalize } from './text';
import { bornDayFor, dateOf, formatDate, stageName, type Calendar, type StageId, type StageRow } from './time';

// ---------- the file ----------
export type LogSim = {
  id: string;
  first: string;
  last: string;
  gender: 'male' | 'female' | null;
  stage: StageId | null;
  traits: string[];
  aspiration: string | null;
  career: { name: string; level: number | null } | null;
  deceased: boolean;
};
export type LogAccount = { id: string; name: string; type: string; owners: string[]; balance: number };
/** One business in the file (optional; older files have none). */
export type LogBusiness = {
  id: string;
  name: string;
  type: 'RETAIL' | 'RESTAURANT' | 'VET' | 'SMALL_BUSINESS' | 'OTHER';
  /** Small business: its lifetime total (the game keeps one). */
  lifetime: number | null;
  /** Retail, restaurant, vet: profit for the last business day, once per close. */
  dayProfit: number | null;
  /** Which business day that profit belongs to, so one file is never counted twice. */
  closeKey: string;
  /** 0 to 5 (small business: its rank or reputation mapped onto five). */
  rating: number | null;
  /** Game ids of the Sims who work there. */
  staff: string[];
};
export type GameLog = {
  loggedAt: string;
  gameDay: number | null;
  household: { id: string; name: string; sims: LogSim[] };
  funds: number | null;
  snb: LogAccount[] | null;
  businesses: LogBusiness[];
  skipped: string[];
};

const STAGE_FROM_GAME: Record<string, StageId> = {
  BABY: 'newborn', INFANT: 'infant', TODDLER: 'toddler', CHILD: 'child', TEEN: 'teen',
  YOUNGADULT: 'youngAdult', ADULT: 'adult', ELDER: 'elder',
};

const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
const int = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : null);

export function parseLog(text: string): { log: GameLog } | { error: string } {
  let j: any;
  try { j = JSON.parse(text); } catch { return { error: 'That doesn’t look like a SimDesk Logger file.' }; }
  if (!j || j.format !== 'simdesk-log') return { error: 'That doesn’t look like a SimDesk Logger file.' };
  if (typeof j.version !== 'number' || j.version > 1) return { error: 'This file is from a newer Logger. Update SimDesk, then try again.' };
  const h = j.household;
  if (!h || !Array.isArray(h.sims)) return { error: 'The file has no household in it.' };
  const sims: LogSim[] = h.sims.filter((s: any) => s && (str(s.first) || str(s.last))).map((s: any) => ({
    id: String(s.id ?? ''),
    first: str(s.first), last: str(s.last),
    gender: s.gender === 'male' || s.gender === 'female' ? s.gender : null,
    stage: STAGE_FROM_GAME[str(s.age?.stage).toUpperCase()] ?? null,
    traits: (Array.isArray(s.traits) ? s.traits : []).map((t: any) => str(t?.name)).filter(Boolean),
    aspiration: str(s.aspiration?.name) || null,
    career: s.career && str(s.career.name) ? { name: str(s.career.name), level: int(s.career.level) } : null,
    deceased: !!s.deceased,
  }));
  const snb = Array.isArray(j.money?.snbAccounts) ? j.money.snbAccounts.map((a: any): LogAccount => ({
    id: String(a?.id ?? ''), name: str(a?.name), type: str(a?.type).toUpperCase(),
    owners: (Array.isArray(a?.owners) ? a.owners : []).map(String), balance: Math.max(0, int(a?.balance) ?? 0),
  })).filter((a: LogAccount) => a.id) : null;
  const TYPES = ['RETAIL', 'RESTAURANT', 'VET', 'SMALL_BUSINESS'];
  const businesses: LogBusiness[] = (Array.isArray(j.businesses) ? j.businesses : []).filter((b: any) => b && String(b.id ?? '') && str(b.name)).map((b: any): LogBusiness => {
    const t = str(b.type).toUpperCase();
    const rating = int(b.rating);
    return {
      id: String(b.id), name: str(b.name), type: (TYPES.includes(t) ? t : 'OTHER') as LogBusiness['type'],
      lifetime: int(b.lifetime) !== null && int(b.lifetime)! >= 0 ? int(b.lifetime) : null, dayProfit: int(b.dayProfit), closeKey: str(b.closeKey) || String(b.closeDay ?? ''),
      rating: rating === null ? null : Math.min(5, Math.max(0, rating)), staff: (Array.isArray(b.staff) ? b.staff : []).map(String).filter(Boolean),
    };
  });
  return {
    log: {
      businesses, loggedAt: str(j.loggedAt), gameDay: int(j.game?.absoluteDay),
      household: { id: String(h.id ?? ''), name: str(h.name), sims },
      funds: int(j.money?.funds), snb, skipped: (Array.isArray(j.skipped) ? j.skipped : []).map(str).filter(Boolean),
    },
  };
}

// ---------- matching game names to SimDesk's lists ----------
const key = (s: string) => normalize(s).replace(/^trait[_ ]/, '').replace(/[^a-z0-9]/g, '');
const TRAIT_BY_KEY = new Map(GAME.traits.flatMap((t) => [[key(t.name), t.id], [key(t.id), t.id]] as [string, string][]));
const ASPIRATION_BY_KEY = new Map(GAME.aspirations.flatMap((a) => [[key(a.name), a.id], [key(a.id), a.id]] as [string, string][]));
export const matchTrait = (name: string) => TRAIT_BY_KEY.get(key(name)) ?? null;
export const matchAspiration = (name: string) => ASPIRATION_BY_KEY.get(key(name)) ?? null;

// ---------- the plan ----------
export type Change = {
  id: string;
  kind: 'stage' | 'traits' | 'career' | 'aspiration' | 'gender' | 'link';
  label: string;
  was: string;
  now: string;
  /** A second line ("Added: Ambitious"). */
  note: string;
  on: boolean;
  patch: Partial<SimData>;
};
export type SimPlan = {
  key: string;
  simId: string;
  isNew: boolean;
  name: string;
  initials: string;
  gameId: string;
  /** The whole Sim for a new one. */
  create: SimData | null;
  changes: Change[];
};
export type MoneyRow = { id: string; label: string; sub: string; was: number | null; now: number; kind: 'funds' | 'item'; item?: MoneyItem; on: boolean };
export type Plan = {
  householdId: string;
  householdName: string;
  householdIsNew: boolean;
  /** Ticked rows only; the date row. */
  date: { id: string; was: number; now: number; text: string; on: boolean } | null;
  linkNote: string | null;
  turn: { id: string; text: string; on: boolean } | null;
  money: MoneyRow[];
  sims: SimPlan[];
  /** Names of Sims with nothing to change. */
  quiet: string[];
  notes: string[];
  skipped: string[];
  /** Every ticked-by-default change id, so "Add N changes" has a starting count. */
  total: number;
};

export type Ctx = {
  sims: { id: string; data: SimData }[];
  households: { id: string; name: string; gameId?: string }[];
  today: number;
  calendar: Calendar;
  trackDate: boolean;
  table: StageRow[];
  /** Only when the Rotation module is on. */
  rotation: { current: string | null; order: string[] } | null;
  link: { game: number; desk: number } | null;
  /** The household's money, when Household funds is on. */
  money: { data: MoneyData; snb: boolean } | null;
  newId(): string;
};

const hhKey = (s: string) => normalize(s).replace(/\b(household|family)\b/g, '').replace(/^the\s/, '').replace(/[^a-z0-9]/g, '');

const stageText = (id: StageId | null) => (id ? stageName(id) : 'Not set');

export function planImport(log: GameLog, ctx: Ctx): Plan {
  const hh = log.household;
  const matchedHh = ctx.households.find((h) => h.gameId === hh.id) ?? ctx.households.find((h) => hhKey(h.name) === hhKey(hh.name) && hhKey(hh.name));
  const householdId = matchedHh?.id ?? ctx.newId();
  const notes: string[] = [];

  // --- Sims
  const used = new Set<string>();
  const byGameId = new Map(ctx.sims.filter((s) => s.data.gameId).map((s) => [s.data.gameId as string, s]));
  const nameKey = (f: string, l: string) => normalize(`${f} ${l}`).replace(/\s+/g, ' ');
  const byName = new Map(ctx.sims.map((s) => [nameKey(s.data.first, s.data.last), s]));
  const gameToDesk = new Map<string, string>();
  const sims: SimPlan[] = [];
  const quiet: string[] = [];
  const unmatched = new Set<string>();
  let nameMatched = 0;

  for (const ls of hh.sims) {
    let found = byGameId.get(ls.id);
    if (!found || used.has(found.id)) {
      const n = byName.get(nameKey(ls.first, ls.last));
      found = n && !used.has(n.id) ? n : undefined;
      if (found) nameMatched++;
    }
    const traitIds = ls.traits.map((t) => ({ name: t, id: matchTrait(t) }));
    traitIds.filter((t) => !t.id).forEach((t) => unmatched.add(t.name));
    const gameTraits = [...new Set(traitIds.map((t) => t.id).filter((x): x is string => !!x))];
    const aspId = ls.aspiration ? matchAspiration(ls.aspiration) : null;

    if (!found) {
      const id = ctx.newId();
      gameToDesk.set(ls.id, id);
      const stage = ls.stage;
      const data: SimData = {
        ...BLANK_SIM, first: ls.first, last: ls.last, gender: ls.gender, householdId, gameId: ls.id,
        traits: gameTraits, aspiration: aspId, career: ls.career?.name ?? '', careerLevel: ls.career?.level ?? null,
        stage: ctx.trackDate ? null : stage, addedDay: ctx.today,
        bornDay: ctx.trackDate && stage ? bornDayFor({ stage, fresh: true }, ctx.today, ctx.table) : null,
        deceased: ls.deceased ? { day: ctx.today, cause: '', notes: '' } : null,
      };
      sims.push({
        key: `sim:${id}`, simId: id, isNew: true, name: fullName(data), initials: initials(data), gameId: ls.id, create: data,
        changes: [{ id: `new:${id}`, kind: 'link', label: 'New Sim', was: '', now: stageText(stage), note: '', on: true, patch: {} }],
      });
      continue;
    }
    used.add(found.id);
    gameToDesk.set(ls.id, found.id);
    const d = found.data;
    const changes: Change[] = [];
    const push = (c: Omit<Change, 'id'>) => changes.push({ ...c, id: `${found!.id}:${c.kind}` });

    // life stage: only when the stage itself changed
    const nowStage = stageOf(simAge(d, ctx.today, ctx.table, ctx.trackDate));
    if (ls.stage && ls.stage !== nowStage) {
      const patch: Partial<SimData> = ctx.trackDate
        ? { bornDay: bornDayFor({ stage: ls.stage, fresh: true }, ctx.today, ctx.table) }
        : { stage: ls.stage };
      push({ kind: 'stage', label: 'Life stage', was: stageText(nowStage), now: stageText(ls.stage), note: nowStage ? 'Aged up in game' : '', on: true, patch });
    }
    // traits: only ever added
    const add = gameTraits.filter((t) => !d.traits.includes(t));
    if (add.length) {
      const names = add.map((t) => BY_ID.traits.get(t)?.name ?? t);
      push({ kind: 'traits', label: 'Traits', was: String(d.traits.length), now: String(d.traits.length + add.length), note: `Added: ${names.join(', ')}`, on: true, patch: { traits: [...d.traits, ...add] } });
    }
    // aspiration: only fills a blank one
    if (aspId && !d.aspiration) {
      push({ kind: 'aspiration', label: 'Aspiration', was: '', now: BY_ID.aspirations.get(aspId)?.name ?? aspId, note: '', on: true, patch: { aspiration: aspId } });
    }
    // career: typed story titles are never overwritten without a tick
    if (ls.career) {
      const gameText = ls.career.level ? `${ls.career.name} · Level ${ls.career.level}` : ls.career.name;
      const deskText = d.career.trim() ? (d.careerLevel ? `${d.career.trim()} · Level ${d.careerLevel}` : d.career.trim()) : '';
      const same = normalize(d.career) === normalize(ls.career.name);
      if (gameText !== deskText && !(same && d.careerLevel === ls.career.level)) {
        const typed = !!d.career.trim() && !same;
        push({ kind: 'career', label: 'Career', was: deskText, now: gameText, note: typed ? 'SimDesk has your own title. Tick to replace it.' : '', on: !typed, patch: { career: ls.career.name, careerLevel: ls.career.level } });
      }
    }
    if (ls.gender && !d.gender) push({ kind: 'gender', label: 'Gender', was: '', now: ls.gender === 'male' ? 'Male' : 'Female', note: '', on: true, patch: { gender: ls.gender } });
    // the link itself is silent (no row): the id is saved with whatever else is ticked, or alone
    if (!changes.length) quiet.push(d.first || fullName(d));
    sims.push({ key: `sim:${found.id}`, simId: found.id, isNew: false, name: d.first || fullName(d), initials: initials(d), gameId: ls.id, create: null, changes });
  }
  if (nameMatched) notes.push('Matched by name this time. From now on SimDesk knows them by their in-game ID, so renaming a Sim won’t make a copy.');
  if (unmatched.size) notes.push(`Not in SimDesk’s trait list, so skipped: ${[...unmatched].join(', ')}.`);

  // --- date
  let date: Plan['date'] = null;
  let linkNote: string | null = null;
  if (ctx.trackDate && log.gameDay !== null) {
    if (!ctx.link) linkNote = `First import: SimDesk stays on ${formatDate(dateOf(ctx.today, ctx.calendar), 'short')} and is now linked to game day ${log.gameDay}.`;
    else {
      const delta = log.gameDay - ctx.link.game;
      const target = ctx.link.desk + delta;
      if (delta > 0 && target !== ctx.today) {
        const diff = target - ctx.today;
        date = {
          id: 'date', was: ctx.today, now: target, on: true,
          text: `${formatDate(dateOf(ctx.today, ctx.calendar), 'short')} → ${formatDate(dateOf(target, ctx.calendar), 'short')}`,
        };
        void diff;
      }
    }
  }

  // --- turn
  let turn: Plan['turn'] = null;
  if (ctx.rotation && matchedHh && ctx.rotation.order.includes(matchedHh.id) && ctx.rotation.current !== matchedHh.id) {
    turn = { id: 'turn', text: `Start ${matchedHh.name}’s turn`, on: true };
  }

  // --- money
  const money: MoneyRow[] = [];
  if (ctx.money && log.funds !== null && log.funds !== ctx.money.data.funds) {
    money.push({ id: 'money:funds', label: 'Household funds', sub: '', was: ctx.money.data.funds, now: log.funds, kind: 'funds', on: true });
  }
  if (ctx.money && log.snb?.length) {
    if (!ctx.money.snb) notes.push('SNB accounts were logged. Turn on SNB in Save settings to import them.');
    else for (const a of log.snb) {
      const id = `snb:${a.id}`;
      const old = ctx.money.data.items.find((i) => i.id === id);
      if (old && old.amount === a.balance) continue;
      const type = /SAV/.test(a.type) ? 'snb-savings' : /CHECK/.test(a.type) ? 'snb-checking' : /EDU/.test(a.type) ? 'snb-edu' : 'snb-main';
      const owners = a.owners.map((o) => gameToDesk.get(o)).filter((x): x is string => !!x);
      const item: MoneyItem = { id, type, name: a.name, owners: old?.owners ?? owners, amount: a.balance, note: old?.note ?? '' };
      const first = owners[0] ? sims.find((s) => s.simId === owners[0])?.name : '';
      money.push({ id: `money:${id}`, label: `${{ 'snb-savings': 'Savings', 'snb-checking': 'Checking', 'snb-edu': 'Education Fund', 'snb-main': 'Account' }[type]}${first ? ` · ${first}` : ''}`, sub: 'SNB', was: old ? old.amount : null, now: a.balance, kind: 'item', item, on: true });
    }
  }
  const skipped = [...log.skipped];
  if (log.snb === null && !skipped.some((s) => /SNB/i.test(s))) { /* SNB not installed: nothing to say */ }
  skipped.push('SimFinancial and loans (coming later)');

  const total = sims.reduce((n, s) => n + s.changes.filter((c) => c.on).length, 0) + money.length + (date ? 1 : 0) + (turn ? 1 : 0);
  return {
    householdId, householdName: matchedHh?.name ?? hh.name, householdIsNew: !matchedHh, date, linkNote, turn, money, sims, quiet, notes, skipped, total,
  };
}

/** Money rows → the household's new money data (funds and SNB accounts). Pure; the caller logs the net worth. */
export function applyMoney(data: MoneyData, rows: MoneyRow[]): MoneyData {
  let funds = data.funds;
  const items = [...data.items];
  for (const r of rows) {
    if (r.kind === 'funds') funds = r.now;
    else if (r.item) {
      const i = items.findIndex((x) => x.id === r.item!.id);
      if (i >= 0) items[i] = { ...items[i], amount: r.item.amount }; else items.push(r.item);
    }
  }
  return { ...data, funds, items };
}

export const moneyText = (r: MoneyRow) => (r.was === null ? `${r.label}: ${fmt(r.now)}` : `${r.label}: ${fmt(r.was)} → ${fmt(r.now)}`);
