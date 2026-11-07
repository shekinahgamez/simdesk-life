import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowCounterClockwise, ArrowsClockwise, ArrowsLeftRight, CalendarPlus, CloudArrowDown, Command, FastForward, FlagCheckered,
  GearSix, HouseSimple, ImageSquare, MagnifyingGlass, MapPin, Moon, Play, Plus, SunHorizon, UserCircle, UserPlus,
  UsersThree, type Icon,
} from '@phosphor-icons/react';
import {
  available, COMMANDS, GROUPS, matchWord, opensBar, parseDays, parseMove, plainCommand, rank, splitName, splitSlash,
  type CommandDef, type CommandId, type Ctx,
} from '../lib/commands';
import { clubData } from '../lib/clubs';
import { layerCount, useLayer } from '../lib/layers';
import { lotData } from '../lib/lots';
import { recentOf } from '../lib/recent';
import { addHouseholds, DEFAULT_TURN, playNow, turnDay, turnLength, upNext } from '../lib/rotation';
import { go, savePath } from '../lib/router';
import { moduleOn, saveData } from '../lib/saves';
import { fullName, householdLabel, simData } from '../lib/sims';
import { useRecords, useStore } from '../lib/sync/react';
import type { Rec, SaveRow } from '../lib/sync/types';
import { plural } from '../lib/text';
import { setTheme } from '../lib/theme';
import { dateOf, formatDate } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';
import { EventForm } from '../pages/calendar/CalendarPage';
import { useCalCtx } from '../pages/calendar/shared';
import { ClubForm } from '../pages/clubs/ClubForm';
import { useClubs } from '../pages/clubs/shared';
import { NewHousehold } from '../pages/households/HouseholdsList';
import { usePhotoAdder } from '../pages/photos/PhotosPage';
import { EndTurnDialog, useRotation } from '../pages/rotation/Rotation';
import { SimForm } from '../pages/sims/SimForm';
import { SimAvatar, useHouseholds, useSaveInfo } from '../pages/sims/shared';
import { LotForm } from '../pages/worlds/WorldsHome';
import { useLotsCtx } from '../pages/worlds/shared';
import { CATEGORIES, needsPack, ObjIcon } from './categories';
import { JumpDialog, useMoveDays } from './DayMove';
import { Sheet, toast } from './ui';

// ---------- opening it from anywhere ----------
type Want = { kind: 'bar'; q: string } | { kind: 'quick' } | null;
let want: Want = null;
const subs = new Set<() => void>();
const set = (w: Want) => { want = w; subs.forEach((f) => f()); };
/** Desktop: opens the command bar (optionally with text typed in, like "/play "). */
export const openCommandBar = (q = '') => set({ kind: 'bar', q });
/** Phone: opens the Quick actions sheet. */
export const openQuickActions = () => set({ kind: 'quick' });
const useWant = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => want);

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const hotkeyLabel = () => (isMac() ? '⌘K' : 'Ctrl K');

const ICONS: Record<CommandId, Icon> = {
  play: Play, add: Plus, end: FlagCheckered, next: SunHorizon, jump: FastForward, back: ArrowCounterClockwise,
  sim: UserPlus, household: HouseSimple, lot: MapPin, club: UsersThree, event: CalendarPlus, photo: ImageSquare,
  move: ArrowsLeftRight, theme: Moon, backup: CloudArrowDown, settings: GearSix, help: Command,
};
const TINT: Record<CommandId, string> = {
  play: 'worlds', add: 'worlds', end: 'worlds', next: 'calendar', jump: 'calendar', back: 'calendar',
  sim: 'sims', household: 'households', lot: 'worlds', club: 'clubs', event: 'calendar', photo: 'photos',
  move: 'households', theme: 'berry', backup: 'berry', settings: 'berry', help: 'berry',
};
const CmdIcon = ({ id }: { id: CommandId }) => {
  const I = ICONS[id];
  return <span className={`obj ${TINT[id]}`} aria-hidden="true"><I size={16} weight={id === 'add' ? 'bold' : 'duotone'} /></span>;
};
/** On phone the play command reads the same as the Playing now card's button. */
const phoneLabel = (c: CommandDef) => (c.id === 'play' ? 'Play someone else' : c.id === 'backup' ? 'Backup' : c.label);

// ---------- what the bar needs from the save ----------
type Dialog =
  | { t: 'end' } | { t: 'jump'; mode: 'ahead' | 'back' }
  | { t: 'sim' | 'household' | 'lot' | 'club' | 'event'; name: string }
  | null;

function useEnv(save: SaveRow) {
  const store = useStore();
  const d = saveData(save);
  const rot = useRotation(save);
  const move = useMoveDays(save);
  const sims = useRecords('sim');
  const lots = useRecords('lot');
  const clubs = useRecords('club');
  const hh = useHouseholds();
  const ctx: Ctx = {
    rotation: rot.on,
    turn: rot.on && !!rot.r.current && upNext(rot.r).length > 0,
    date: d.trackDate,
    clubs: d.packs.includes('get-together'),
  };
  const cmds = available(ctx);
  const living = useMemo(() => sims.filter((r) => !simData(r).deceased), [sims]);
  const members = (hhId: string) => living.filter((r) => simData(r).householdId === hhId).length;
  const hhName = (id: string | null) => (id ? householdLabel(hh.nameOf(id)) : '');
  const when = (day: number) => formatDate(dateOf(day, d.calendar), 'short');
  const play = (id: string) => {
    let r = rot.r;
    if (!r.order.includes(id)) r = addHouseholds(r, [id], DEFAULT_TURN, d.today);
    r = playNow(r, id, d.today);
    rot.update(r, `Now playing ${hh.nameOf(id)}`);
  };
  const add = (id: string) => rot.update(addHouseholds(rot.r, [id], DEFAULT_TURN, d.today), `${rot.name(id)} added to the rotation`);
  const moveSim = (simId: string, hhId: string) => {
    const rec = store.get(simId);
    if (!rec) return;
    const before = simData(rec).householdId ?? null;
    const put = (h: string | null) => { const r = store.get(simId); if (r) store.put('sim', { ...r.data, householdId: h }, simId); };
    put(hhId);
    toast(`Moved ${simData(rec).first || 'them'} to ${hhName(hhId)}`, { label: 'Undo', run: () => put(before) });
  };
  return { save, d, rot, move, sims, living, lots, clubs, hh, ctx, cmds, members, hhName, when, play, add, moveSim };
}
type Env = ReturnType<typeof useEnv>;

// ---------- rows ----------
type Row = {
  key: string;
  group: string;
  icon: ReactNode;
  title: ReactNode;
  sub?: string;
  /** The slash word shown on the right (desktop). */
  k?: string;
  tag?: { text: string; gray?: boolean };
  /** Text Tab (and Enter, when there's nothing to run yet) puts in the box. */
  fill?: string;
  run?: () => void;
  help?: { word: string; example: string };
};

type Runner = {
  env: Env;
  phone: boolean;
  close(): void;
  dialog(d: Dialog): void;
  photo(): void;
  setQ(q: string): void;
};

/** What Enter does on a command with nothing typed after it. */
function runBare(c: CommandDef, x: Runner) {
  const { env } = x;
  switch (c.id) {
    case 'play': case 'add': case 'move': case 'theme': x.setQ(`/${c.word} `); return;
    case 'help': x.setQ('/help '); return;
    case 'end': x.close(); x.dialog({ t: 'end' }); return;
    case 'next': x.close(); env.move(1); return;
    case 'jump': x.close(); x.dialog({ t: 'jump', mode: 'ahead' }); return;
    case 'back': x.close(); x.dialog({ t: 'jump', mode: 'back' }); return;
    case 'sim': case 'household': case 'lot': case 'club': case 'event': x.close(); x.dialog({ t: c.id, name: '' }); return;
    case 'photo': x.close(); x.photo(); return;
    case 'backup': x.close(); go('#/account'); return;
    case 'settings': x.close(); go(savePath(env.save.id, 'settings')); return;
  }
}

function cmdRow(c: CommandDef, x: Runner, group: string = c.group): Row {
  const needsArg = c.arg === 'household' || c.arg === 'household-out' || c.arg === 'move' || c.arg === 'theme' || c.id === 'help';
  return {
    key: `cmd-${c.id}`, group, icon: <CmdIcon id={c.id} />, title: x.phone ? phoneLabel(c) : c.label, sub: c.hint, k: `/${c.word}`,
    fill: `/${c.word} `, run: needsArg ? undefined : () => runBare(c, x),
  };
}

const hhIcon = <span className="obj households" aria-hidden="true"><HouseSimple size={16} weight="duotone" /></span>;

/** Rows for a chosen command and what's typed after it. `verb` puts the action in the title ("Play Coriana"). */
function argRows(c: CommandDef, rest: string, x: Runner, verb = false): Row[] {
  const { env } = x;
  const r = env.rot.r;
  const grp = (g: string) => (verb ? 'Do' : g);
  switch (c.arg) {
    case 'household': {
      const loop = r.current ? [r.current, ...upNext(r)] : [];
      const inRot = rank(loop.map((id) => env.hh.byId.get(id)).filter((h): h is Rec => !!h), rest, (h) => env.hh.nameOf(h.id));
      const out = rank(env.hh.list.filter((h) => !loop.includes(h.id)), rest, (h) => env.hh.nameOf(h.id));
      const row = (h: Rec, inLoop: boolean): Row => {
        const now = h.id === r.current;
        const next = upNext(r)[0] === h.id;
        const n = env.members(h.id);
        return {
          key: `play-${h.id}`, group: grp(inLoop ? 'In the rotation' : 'Not in the rotation'), icon: verb ? <CmdIcon id="play" /> : hhIcon,
          title: verb ? `Play ${env.hh.nameOf(h.id)}` : env.hh.nameOf(h.id),
          sub: verb ? (inLoop ? 'Makes them Playing now' : 'Adds them to the rotation and makes them Playing now') : plural(n, 'Sim'),
          k: verb && !x.phone ? '/play' : undefined,
          tag: now ? { text: 'Playing now' } : next && !verb ? { text: 'Up next', gray: true } : undefined,
          run: now ? undefined : () => { x.close(); env.play(h.id); },
        };
      };
      return [...inRot.map((h) => row(h, true)), ...out.map((h) => row(h, false))].filter((row) => !(verb && row.tag?.text === 'Playing now'));
    }
    case 'household-out': {
      const out = rank(env.hh.list.filter((h) => !r.order.includes(h.id)), rest, (h) => env.hh.nameOf(h.id));
      return out.map((h) => ({
        key: `add-${h.id}`, group: grp('Not in the rotation'), icon: verb ? <CmdIcon id="add" /> : hhIcon,
        title: verb ? `Add ${env.hh.nameOf(h.id)} to the rotation` : env.hh.nameOf(h.id),
        sub: verb ? 'Goes in at the end of the line' : plural(env.members(h.id), 'Sim'), k: verb && !x.phone ? '/add' : undefined,
        run: () => { x.close(); env.add(h.id); },
      }));
    }
    case 'days': {
      const n = parseDays(rest);
      const ahead = c.id === 'jump';
      if (n == null) return [{ ...cmdRow(c, x, grp(c.group)), sub: ahead ? 'Pick the day on the calendar' : 'Pick the day to go back to', fill: undefined, run: () => runBare(c, x) }];
      const to = ahead ? env.d.today + n : Math.max(0, env.d.today - n);
      return [{
        key: `days-${c.id}-${n}`, group: grp(c.group), icon: <CmdIcon id={c.id} />,
        title: ahead ? `Jump ahead ${plural(n, 'day')}` : `Go back ${plural(env.d.today - to, 'day')}`, sub: `To ${env.when(to)}`, k: x.phone ? undefined : `/${c.word}`,
        run: () => { x.close(); env.move(to - env.d.today); },
      }];
    }
    case 'name': {
      const name = rest.trim();
      return [{
        key: `new-${c.id}`, group: grp(c.group), icon: <CmdIcon id={c.id} />,
        title: name ? `${c.label} “${name}”` : c.label, sub: name ? 'Opens the form with the name filled in' : 'Type a name to fill it in', k: x.phone ? undefined : `/${c.word}`,
        run: () => { x.close(); x.dialog({ t: c.id as 'sim', name }); },
      }];
    }
    case 'move': {
      const m = parseMove(rest);
      const named = (r2: Rec) => fullName(simData(r2));
      if (!m.toTyped) {
        return rank(env.living, m.sim, named).slice(0, 30).map((s) => {
          const sd = simData(s);
          return {
            key: `mv-${s.id}`, group: grp('Pick a Sim'), icon: <SimAvatar sim={sd} size={28} />, title: verb ? `Move ${named(s)}` : named(s),
            sub: sd.householdId ? env.hhName(sd.householdId) : 'No household', fill: `/move ${named(s)} to `, run: () => x.setQ(`/move ${named(s)} to `),
          };
        });
      }
      const sim = rank(env.living, m.sim, named)[0];
      if (!sim) return [];
      const cur = simData(sim).householdId;
      return rank(env.hh.list.filter((h) => h.id !== cur), m.household, (h) => env.hh.nameOf(h.id)).map((h) => ({
        key: `mvto-${h.id}`, group: grp(`Move ${simData(sim).first || named(sim)} to`), icon: hhIcon, title: verb ? `Move ${named(sim)} to ${env.hh.nameOf(h.id)}` : env.hh.nameOf(h.id),
        sub: plural(env.members(h.id), 'Sim'), run: () => { x.close(); env.moveSim(sim.id, h.id); },
      }));
    }
    case 'theme': {
      const opts: { id: 'light' | 'dark' | 'system'; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Match device' }];
      return rank(opts, rest, (o) => o.label).map((o) => ({
        key: `theme-${o.id}`, group: grp('Light or dark'), icon: <CmdIcon id="theme" />, title: o.label,
        run: () => { x.close(); setTheme(o.id); },
      }));
    }
    default:
      return [cmdRow(c, x, grp(c.group))];
  }
}

function helpRows(x: Runner): Row[] {
  return x.env.cmds.map((c) => ({ ...cmdRow(c, x), key: `help-${c.id}`, sub: undefined, k: undefined, help: { word: `/${c.word}`, example: c.example } }));
}

function quickRows(x: Runner): Row[] {
  const { env } = x;
  const rows: Row[] = [];
  const r = env.rot.r;
  const find = (id: CommandId) => env.cmds.find((c) => c.id === id);
  const play = find('play');
  if (play && r.current) rows.push({ ...cmdRow(play, x, 'Quick'), sub: `Playing now: ${env.hh.nameOf(r.current)}` });
  else if (play) rows.push(cmdRow(play, x, 'Quick'));
  const end = find('end');
  if (end && r.current) rows.push({ ...cmdRow(end, x, 'Quick'), title: `End ${env.hh.nameOf(r.current)}’s turn`, sub: env.d.trackDate ? `Day ${turnDay(r, env.d.today)} of ${turnLength(r, r.current)}` : undefined });
  const next = find('next');
  if (next) rows.push({ ...cmdRow(next, x, 'Quick'), sub: env.when(env.d.today + 1) });
  rows.push({ ...cmdRow(find('sim')!, x, 'Quick'), sub: undefined });
  return [...rows, ...recentRows(x)];
}

function recentRows(x: Runner): Row[] {
  const { env } = x;
  const sid = env.save.id;
  const out: Row[] = [];
  for (const v of recentOf(sid)) {
    if (out.length >= 4) break;
    if (v.kind === 'sim') {
      const s = env.sims.find((r) => r.id === v.id);
      if (s) out.push({ key: `r-${v.id}`, group: 'Jump back in', icon: <SimAvatar sim={simData(s)} size={28} />, title: fullName(simData(s)), sub: 'Sim', run: () => { x.close(); go(savePath(sid, `sims/${v.id}`)); } });
    } else if (v.kind === 'household') {
      if (env.hh.byId.get(v.id)) out.push({ key: `r-${v.id}`, group: 'Jump back in', icon: hhIcon, title: env.hh.nameOf(v.id), sub: `Household · ${plural(env.members(v.id), 'Sim')}`, run: () => { x.close(); go(savePath(sid, `households/${v.id}`)); } });
    } else if (v.kind === 'lot') {
      const l = env.lots.find((r) => r.id === v.id);
      if (l) out.push({ key: `r-${v.id}`, group: 'Jump back in', icon: <ObjIcon cat="worlds" />, title: lotData(l).name || 'Unnamed lot', sub: 'Lot', run: () => { x.close(); go(savePath(sid, `worlds/lot/${v.id}`)); } });
    } else {
      const c = env.clubs.find((r) => r.id === v.id);
      if (c) out.push({ key: `r-${v.id}`, group: 'Jump back in', icon: <ObjIcon cat="clubs" />, title: clubData(c).name || 'Unnamed club', sub: 'Club', run: () => { x.close(); go(savePath(sid, `clubs/${v.id}`)); } });
    }
  }
  return out;
}

/** The pages you can jump to by name. */
function pages(env: Env) {
  const d = env.d;
  const sid = env.save.id;
  const list: { id: string; label: string; icon: ReactNode; href: string }[] = CATEGORIES
    .filter((c) => (!c.module || moduleOn(d, c.module)) && needsPack(c, d.packs))
    .map((c) => ({ id: c.id, label: c.label, icon: <ObjIcon cat={c.id} />, href: savePath(sid, c.path) }));
  list.unshift({ id: 'today', label: 'Today', icon: <span className="obj berry"><SunHorizon size={16} weight="duotone" /></span>, href: savePath(sid, 'today') });
  if (env.rot.on) list.push({ id: 'rotation', label: 'Rotation', icon: <span className="obj worlds"><ArrowsClockwise size={16} weight="duotone" /></span>, href: savePath(sid, 'rotation') });
  list.push({ id: 'settings', label: 'Save settings', icon: <span className="obj berry"><GearSix size={16} weight="duotone" /></span>, href: savePath(sid, 'settings') });
  list.push({ id: 'account', label: 'Account', icon: <span className="obj berry"><UserCircle size={16} weight="duotone" /></span>, href: '#/account' });
  return list;
}

function searchRows(q: string, x: Runner): Row[] {
  const { env } = x;
  const sid = env.save.id;
  const rows: Row[] = [];
  // Do: plain-word commands ("play cor", "new sim Maya"), households you could play, and matching commands.
  const pc = plainCommand(q, env.cmds);
  if (pc) rows.push(...argRows(pc.cmd, pc.rest, x, true).slice(0, 3));
  else {
    if (env.ctx.rotation) {
      const play = env.cmds.find((c) => c.id === 'play')!;
      const hits = argRows(play, q, x, true).slice(0, 2);
      rows.push(...hits);
      const first = hits[0] && env.hh.list.find((h) => `play-${h.id}` === hits[0].key);
      if (first && !env.rot.r.order.includes(first.id)) {
        rows.push({ key: `add-${first.id}`, group: 'Do', icon: <CmdIcon id="add" />, title: `Add ${env.hh.nameOf(first.id)} to the rotation`, sub: 'Goes in at the end of the line', k: x.phone ? undefined : '/add', run: () => { x.close(); env.add(first.id); } });
      }
    }
    rows.push(...rank(env.cmds, q, (c) => `${c.label} ${c.word}`).slice(0, 3).map((c) => cmdRow(c, x, 'Do')));
  }
  rows.push(...rank(env.hh.list, q, (h) => env.hh.nameOf(h.id)).slice(0, 5).map((h) => ({
    key: `hh-${h.id}`, group: 'Households', icon: hhIcon, title: env.hh.nameOf(h.id), sub: plural(env.members(h.id), 'Sim'),
    run: () => { x.close(); go(savePath(sid, `households/${h.id}`)); },
  })));
  rows.push(...rank(env.sims, q, (s) => fullName(simData(s))).slice(0, 6).map((s) => {
    const sd = simData(s);
    return {
      key: `sim-${s.id}`, group: 'Sims', icon: <SimAvatar sim={sd} size={28} />, title: fullName(sd),
      sub: sd.deceased ? 'Passed' : sd.householdId ? env.hhName(sd.householdId) : 'No household',
      run: () => { x.close(); go(savePath(sid, `sims/${s.id}`)); },
    };
  }));
  rows.push(...rank(env.lots, q, (l) => lotData(l).name).slice(0, 5).map((l) => ({
    key: `lot-${l.id}`, group: 'Lots', icon: <ObjIcon cat="worlds" />, title: lotData(l).name || 'Unnamed lot',
    run: () => { x.close(); go(savePath(sid, `worlds/lot/${l.id}`)); },
  })));
  if (env.ctx.clubs) {
    rows.push(...rank(env.clubs, q, (c) => clubData(c).name).slice(0, 5).map((c) => ({
      key: `club-${c.id}`, group: 'Clubs', icon: <ObjIcon cat="clubs" />, title: clubData(c).name || 'Unnamed club',
      run: () => { x.close(); go(savePath(sid, `clubs/${c.id}`)); },
    })));
  }
  rows.push(...rank(pages(env), q, (p) => p.label).slice(0, 4).map((p) => ({
    key: `page-${p.id}`, group: 'Pages', icon: p.icon, title: p.label, run: () => { x.close(); go(p.href); },
  })));
  // One row per key (a household can show up under Do and Households, which is fine; the same row twice is not).
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
}

/** All the rows for what's typed, plus the command shown as a chip (if one is chosen). */
export function rowsFor(q: string, x: Runner): { rows: Row[]; chip: CommandDef | null; rest: string; hint?: string } {
  const s = splitSlash(q);
  if (!s) return q.trim() ? { rows: searchRows(q, x), chip: null, rest: q } : { rows: quickRows(x), chip: null, rest: '' };
  if (s.spaced) {
    const c = x.env.cmds.find((c2) => c2.word === s.word.toLowerCase());
    if (c) {
      if (c.id === 'help') return { rows: helpRows(x), chip: c, rest: s.rest, hint: 'Every command, with an example. Pick one to start it.' };
      const rows = argRows(c, s.rest, x);
      const hint = c.arg === 'household' ? 'Pick a household. Type to narrow it down.'
        : c.arg === 'household-out' ? 'Pick a household to add at the end of the line.'
          : c.arg === 'move' && !parseMove(s.rest).toTyped ? 'Pick a Sim, then where they’re moving.' : undefined;
      return { rows, chip: c, rest: s.rest, hint };
    }
  }
  const list = matchWord(s.word, x.env.cmds);
  const rows = s.word ? list.map((c) => cmdRow(c, x, 'Commands')) : GROUPS.flatMap((g) => list.filter((c) => c.group === g).map((c) => cmdRow(c, x)));
  return { rows, chip: null, rest: '' };
}

// ---------- the list ----------
function RowList({ rows, sel, setSel, phone, onPick }: { rows: Row[]; sel: number; setSel(i: number): void; phone: boolean; onPick(i: number): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  let last = '';
  return (
    <div className="cb-list" ref={ref} role="listbox" aria-label="Results">
      {rows.map((r, i) => {
        const head = r.group !== last ? <div className="cb-h" role="presentation">{r.group}</div> : null;
        last = r.group;
        const on = !phone && i === sel; // phones tap; there's no keyboard selection to show
        return (
          <div key={r.key} style={{ display: 'contents' }}>
            {head}
            <div role="option" aria-selected={on} data-i={i} id={`cb-opt-${i}`} className={`cb-r${on ? ' on' : ''}${r.help ? ' cb-help' : ''}${!r.run && !r.fill ? ' off' : ''}`}
              onMouseMove={() => { if (!phone && !on) setSel(i); }} onClick={() => onPick(i)}>
              {r.icon}
              {r.help && <span className="kw">{r.help.word}</span>}
              <span className="g">
                <span className="t">{r.title}</span>
                {r.sub && <span className="s">{r.sub}</span>}
                {r.help && <span className="s ex">{r.help.example}</span>}
              </span>
              {r.tag && <span className={`cb-tag${r.tag.gray ? ' gray' : ''}`}>{r.tag.text}</span>}
              {!phone && r.k && <span className="k">{r.k}</span>}
              {!phone && on && (r.run || r.fill) && <span className="k" aria-hidden="true">↵</span>}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <div className="cb-empty">Nothing matches that.</div>}
    </div>
  );
}

/** The search box, the chip and the list. Desktop shows it in the bar; phone shows it in a sheet for picking. */
function Panel({ x, q, setQ, phone, onClose }: { x: Omit<Runner, 'setQ'>; q: string; setQ(q: string): void; phone: boolean; onClose(): void }) {
  const runner: Runner = { ...x, setQ };
  const { rows, chip, rest, hint } = rowsFor(q, runner);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  // Start on the first row that does something (Playing now can't be picked again).
  const firstOk = Math.max(0, rows.findIndex((r) => r.run || r.fill));
  useEffect(() => { setSel(firstOk); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!phone) input.current?.focus(); }, [phone, chip?.id]);
  const pick = (i: number) => {
    const r = rows[i];
    if (!r) return;
    if (r.run) r.run();
    else if (r.fill) setQ(r.fill);
    input.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
    else if (e.key === 'Tab') {
      const r = rows[sel];
      if (r?.fill) { e.preventDefault(); setQ(r.fill); }
      else e.preventDefault();
    } else if (e.key === 'Backspace' && chip && !rest && !phone) { e.preventDefault(); setQ(`/${chip.word}`); }
  };
  const value = chip ? rest : q;
  const change = (v: string) => setQ(chip ? `/${chip.word} ${v}` : v);
  const ChipIcon = chip ? ICONS[chip.id] : null;
  const ph = chip ? (chip.arg === 'household' || chip.arg === 'household-out' ? 'Household name' : chip.arg === 'move' ? 'Sim, then “to” and a household' : chip.arg === 'name' ? 'Name' : '')
    : phone ? 'Search' : 'Search or type / for commands';
  return (
    <>
      <div className="cb-in">
        <MagnifyingGlass size={20} aria-hidden="true" />
        {chip && ChipIcon && !phone && <span className={`cb-tok ${TINT[chip.id]}`}><ChipIcon size={16} weight="bold" aria-hidden="true" /> {chip.word}</span>}
        <input ref={input} className="cb-input" value={value} onChange={(e) => change(e.target.value)} onKeyDown={onKey} placeholder={ph}
          aria-label={chip ? `${chip.label}: ${ph}` : 'Search or type a command'} role="combobox" aria-expanded="true" aria-controls="cb-list"
          aria-activedescendant={rows[sel] ? `cb-opt-${sel}` : undefined} autoComplete="off" spellCheck={false} />
        {phone ? null : <button type="button" className="cb-esc" onClick={onClose}>Esc</button>}
      </div>
      {hint && <div className="cb-hint">{hint}</div>}
      <RowList rows={rows} sel={sel} setSel={setSel} phone={phone} onPick={pick} />
      {!q && !phone && <div className="cb-hint cb-tip">Tip: type <b>/</b> to see commands, or <b>/help</b> for the cheat sheet.</div>}
      {!phone && (
        <div className="cb-ft" aria-hidden="true">
          <span><b>↑↓</b>Move</span><span><b>Enter</b>Open</span><span><b>Tab</b>Fill in</span><span><b>/</b>Commands</span>
          <span style={{ marginLeft: 'auto' }}><b>{hotkeyLabel()}</b>anywhere</span>
        </div>
      )}
    </>
  );
}

function DesktopBar({ x, start, onClose }: { x: Omit<Runner, 'setQ'>; start: string; onClose(): void }) {
  const [q, setQ] = useState(start);
  useLayer(onClose);
  return createPortal(
    <div className="cb-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cb" role="dialog" aria-modal="true" aria-label="Command bar">
        <Panel x={x} q={q} setQ={setQ} phone={false} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

/** Phone: the Quick actions sheet. No typing; every action is one tap. */
function QuickSheet({ x, onClose, onPick }: { x: Omit<Runner, 'setQ'>; onClose(): void; onPick(q: string): void }) {
  const { env } = x;
  const runner: Runner = { ...x, setQ: onPick };
  const groups: { name: string; ids: CommandId[] }[] = [
    { name: 'Play', ids: ['play', 'add', 'end'] },
    { name: 'Date', ids: ['next', 'jump', 'back'] },
    { name: 'Make', ids: ['sim', 'household', 'lot', 'club', 'event', 'photo'] },
    { name: 'More', ids: ['move', 'theme', 'backup', 'settings'] },
  ];
  const recent = recentRows(runner).slice(0, 3);
  return (
    <Sheet title="Quick actions" onClose={onClose}>
      <div className="qa">
        {groups.map((g) => {
          const cmds = g.ids.map((id) => env.cmds.find((c) => c.id === id)).filter((c): c is CommandDef => !!c);
          if (!cmds.length) return null;
          return (
            <div key={g.name}>
              <div className="cb-h">{g.name}</div>
              <div className="qa-tiles">
                {cmds.map((c) => (
                  <button key={c.id} type="button" className="qa-tile" onClick={() => runBare(c, runner)}>
                    <CmdIcon id={c.id} /><span>{phoneLabel(c)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {recent.length > 0 && (
          <div>
            <div className="cb-h">Jump back in</div>
            {recent.map((r) => (
              <button key={r.key} type="button" className="cb-r qa-row" onClick={r.run}>
                {r.icon}<span className="g"><span className="t">{r.title}</span>{r.sub && <span className="s">{r.sub}</span>}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function PhonePick({ x, start, onClose }: { x: Omit<Runner, 'setQ'>; start: string; onClose(): void }) {
  const [q, setQ] = useState(start);
  const s = splitSlash(q);
  const c = s && COMMANDS.find((c2) => c2.word === s.word);
  return (
    <Sheet title={c ? phoneLabel(c) : 'Pick'} onClose={onClose}>
      <div className="cb ph-pick"><Panel x={x} q={q} setQ={setQ} phone onClose={onClose} /></div>
    </Sheet>
  );
}

// ---------- forms the commands open ----------
function NewSim({ save, name, onClose }: { save: SaveRow; name: string; onClose(): void }) {
  const info = useSaveInfo(save);
  return <SimForm info={info} simId={null} preset={name ? splitName(name) : undefined} onClose={onClose}
    onSaved={(id, another) => { if (!another) { onClose(); go(savePath(save.id, `sims/${id}`)); } }} />;
}
function NewLot({ save, name, onClose }: { save: SaveRow; name: string; onClose(): void }) {
  const ctx = useLotsCtx(save);
  return <LotForm ctx={ctx} lotId={null} name={name} onClose={onClose} onSaved={(id) => { onClose(); go(savePath(save.id, `worlds/lot/${id}`)); }} />;
}
function NewClub({ save, name, onClose }: { save: SaveRow; name: string; onClose(): void }) {
  const ctx = useClubs(save);
  return <ClubForm ctx={ctx} id={null} name={name} onClose={onClose} onSaved={(id) => { onClose(); go(savePath(save.id, `clubs/${id}`)); }} />;
}
function NewEvent({ save, name, onClose }: { save: SaveRow; name: string; onClose(): void }) {
  const ctx = useCalCtx(save);
  return <EventForm ctx={ctx} id={null} day={saveData(save).today} name={name} onClose={onClose} />;
}

// ---------- the host: one per save, inside the Shell ----------
/** Listens for Ctrl K and "/" (desktop), and owns the bar, the Quick actions sheet and whatever they open. */
export function CommandHost({ save }: { save: SaveRow }) {
  const env = useEnv(save);
  const phone = useIsPhone();
  const w = useWant();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pickQ, setPickQ] = useState<string | null>(null);
  const photo = usePhotoAdder(save);
  const close = () => set(null);

  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const hit = opensBar(e, typing);
      if (!hit) return;
      if (want?.kind === 'bar') { if (hit === 'open') { e.preventDefault(); close(); } return; }
      if (layerCount() > 0) return; // another pop-up is open
      e.preventDefault();
      openCommandBar(hit === 'slash' ? '/' : '');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone]);

  const x = { env, phone, close, dialog: setDialog, photo: photo.start };
  const done = () => setDialog(null);
  return (
    <>
      {w?.kind === 'bar' && !phone && <DesktopBar x={x} start={w.q} onClose={close} />}
      {w?.kind === 'quick' && phone && <QuickSheet x={x} onClose={close} onPick={(q) => { close(); setPickQ(q); }} />}
      {pickQ !== null && <PhonePick x={{ ...x, close: () => setPickQ(null) }} start={pickQ} onClose={() => setPickQ(null)} />}
      {dialog?.t === 'end' && <EndTurnDialog rot={env.rot} phone={phone} onClose={done} />}
      {dialog?.t === 'jump' && <JumpDialog save={save} mode={dialog.mode} onClose={done} />}
      {dialog?.t === 'sim' && <NewSim save={save} name={dialog.name} onClose={done} />}
      {dialog?.t === 'household' && <NewHousehold start={dialog.name} onClose={done} onSaved={(id) => { done(); go(savePath(save.id, `households/${id}`)); }} />}
      {dialog?.t === 'lot' && <NewLot save={save} name={dialog.name} onClose={done} />}
      {dialog?.t === 'club' && <NewClub save={save} name={dialog.name} onClose={done} />}
      {dialog?.t === 'event' && <NewEvent save={save} name={dialog.name} onClose={done} />}
      {photo.ui}
    </>
  );
}

/** Desktop sidebar: the Search button that opens the bar. */
export function SideSearch() {
  return (
    <button type="button" className="side-search" onClick={() => openCommandBar()} aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}>
      <MagnifyingGlass size={16} aria-hidden="true" /><span>Search</span><span className="kk">{hotkeyLabel()}</span>
    </button>
  );
}

/** Phone top bar: the plus button that opens Quick actions. */
export function QuickButton() {
  return (
    <button type="button" className="qa-btn" onClick={openQuickActions} aria-label="Quick actions">
      <Plus size={20} weight="bold" />
    </button>
  );
}

