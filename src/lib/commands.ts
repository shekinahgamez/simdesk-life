import { normalize } from './text';

/**
 * The command bar's commands and the small parsing it needs. Pure, so it can be tested.
 * The bar itself (src/components/CommandBar.tsx) turns these into rows and runs them.
 */
export type CommandId =
  | 'play' | 'add' | 'end' | 'next' | 'jump' | 'back'
  | 'sim' | 'household' | 'lot' | 'club' | 'event' | 'photo'
  | 'move' | 'theme' | 'stream' | 'backup' | 'settings' | 'help';

/** What the command needs after its word. */
export type ArgKind = 'household' | 'household-out' | 'days' | 'name' | 'move' | 'theme' | null;

/** What has to be on for the command to show. */
export type Needs = 'rotation' | 'turn' | 'date' | 'clubs';

export type CommandDef = {
  id: CommandId;
  /** The word after the slash. */
  word: string;
  label: string;
  group: 'Play' | 'Date' | 'Make' | 'Change' | 'App';
  /** One short line under the label in the command list. */
  hint?: string;
  /** Shown in /help. */
  example: string;
  arg: ArgKind;
  needs?: Needs;
};

export const COMMANDS: CommandDef[] = [
  { id: 'play', word: 'play', label: 'Switch household', group: 'Play', hint: 'Pick who you’re playing now', example: '/play Coriana', arg: 'household', needs: 'rotation' },
  { id: 'add', word: 'add', label: 'Add to rotation', group: 'Play', hint: 'Put a household in the loop', example: '/add Baptiste', arg: 'household-out', needs: 'rotation' },
  { id: 'end', word: 'end', label: 'End turn', group: 'Play', hint: 'Opens the End turn sheet', example: '/end', arg: null, needs: 'turn' },
  { id: 'next', word: 'next', label: 'Next day', group: 'Date', example: '/next', arg: null, needs: 'date' },
  { id: 'jump', word: 'jump', label: 'Jump ahead', group: 'Date', hint: '/jump 3 moves 3 days', example: '/jump 3', arg: 'days', needs: 'date' },
  { id: 'back', word: 'back', label: 'Go back', group: 'Date', hint: 'For a crash or rollback', example: '/back 2', arg: 'days', needs: 'date' },
  { id: 'sim', word: 'sim', label: 'New Sim', group: 'Make', hint: '/sim Maya Brooks fills in the name', example: '/sim Maya Brooks', arg: 'name' },
  { id: 'household', word: 'household', label: 'New household', group: 'Make', example: '/household Fletcher', arg: 'name' },
  { id: 'lot', word: 'lot', label: 'New lot', group: 'Make', example: '/lot 21 Chic Street', arg: 'name' },
  { id: 'club', word: 'club', label: 'New club', group: 'Make', example: '/club Night Owls', arg: 'name', needs: 'clubs' },
  { id: 'event', word: 'event', label: 'New event', group: 'Make', example: '/event Cori’s wedding', arg: 'name' },
  { id: 'photo', word: 'photo', label: 'Add photos', group: 'Make', example: '/photo', arg: null },
  { id: 'move', word: 'move', label: 'Move a Sim', group: 'Change', hint: '/move Kai to Coriana', example: '/move Kai to Coriana', arg: 'move' },
  { id: 'theme', word: 'theme', label: 'Light or dark', group: 'App', example: '/theme dark', arg: 'theme' },
  { id: 'stream', word: 'stream', label: 'Streaming mode', group: 'App', hint: 'Hides planned moments', example: '/stream', arg: null },
  { id: 'backup', word: 'backup', label: 'Download a backup', group: 'App', hint: 'Opens Account', example: '/backup', arg: null },
  { id: 'settings', word: 'settings', label: 'Save settings', group: 'App', example: '/settings', arg: null },
  { id: 'help', word: 'help', label: 'All commands', group: 'App', hint: 'The cheat sheet', example: '/help', arg: null },
];

export const GROUPS: CommandDef['group'][] = ['Play', 'Date', 'Make', 'Change', 'App'];

export type Ctx = { rotation: boolean; turn: boolean; date: boolean; clubs: boolean };

/** The commands this save can use (Rotation off hides the play commands, and so on). */
export const available = (c: Ctx) => COMMANDS.filter((x) => !x.needs || c[x.needs]);

/** Commands whose word starts with what was typed ("/pl" -> play). Exact word first. */
export function matchWord(typed: string, list: CommandDef[] = COMMANDS): CommandDef[] {
  const t = normalize(typed);
  if (!t) return list;
  return list.filter((c) => c.word.startsWith(t)).sort((a, b) => (a.word === t ? -1 : b.word === t ? 1 : 0));
}

/**
 * Splits what's typed after the slash: "/play cor" -> { word: 'play', rest: 'cor', spaced: true }.
 * `spaced` is true once there is a space after the word (the command is chosen).
 */
export function splitSlash(q: string): { word: string; rest: string; spaced: boolean } | null {
  if (!q.startsWith('/')) return null;
  const body = q.slice(1);
  const i = body.indexOf(' ');
  if (i < 0) return { word: body, rest: '', spaced: false };
  return { word: body.slice(0, i), rest: body.slice(i + 1).trimStart(), spaced: true };
}

/** Plain words that start a command without the slash ("play cor", "next day", "new sim Maya"). */
export function plainCommand(q: string, list: CommandDef[]): { cmd: CommandDef; rest: string } | null {
  const t = q.trim();
  const m = /^(\S+)(?:\s+(.*))?$/.exec(t);
  if (!m) return null;
  let word = normalize(m[1]);
  let rest = m[2] ?? '';
  if (word === 'new' && rest) { // "new sim Maya"
    const m2 = /^(\S+)(?:\s+(.*))?$/.exec(rest)!;
    word = normalize(m2[1]);
    rest = m2[2] ?? '';
    const make = list.find((c) => c.group === 'Make' && c.word === word);
    return make ? { cmd: make, rest } : null;
  }
  const cmd = list.find((c) => c.word === word);
  if (!cmd) return null;
  // "next day" is just the next command; don't treat "day" as an argument.
  if (cmd.id === 'next') return /^(day)?$/i.test(rest.trim()) ? { cmd, rest: '' } : null;
  return { cmd, rest };
}

/** "3" or "3 days" -> 3. Anything else -> null. */
export function parseDays(s: string): number | null {
  const m = /^\s*(\d{1,3})\s*(d|day|days)?\s*$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

/** "Kai to Coriana" -> { sim: 'Kai', household: 'Coriana', toTyped: true }. Before " to ", it's all Sim. */
export function parseMove(s: string): { sim: string; household: string; toTyped: boolean } {
  const m = /^(.*?)\s+to(?:\s+(.*))?$/i.exec(s);
  if (!m) return { sim: s.trim(), household: '', toTyped: false };
  return { sim: m[1].trim(), household: (m[2] ?? '').trim(), toTyped: true };
}

/** "Maya Brooks" -> first Maya, last Brooks. One word is the first name. */
export function splitName(s: string): { first: string; last: string } {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/**
 * How well `text` matches the search. 0 = no match. Whole-name start beats a word start beats inside a word.
 * Every typed word has to be found.
 */
export function score(text: string, q: string): number {
  const t = normalize(text);
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let total = 0;
  for (const w of words) {
    if (t.startsWith(w)) total += 3;
    else if (new RegExp(`(^|[\\s\\-’'&+.(])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) total += 2;
    else if (t.includes(w)) total += 1;
    else return 0;
  }
  return total;
}

/** Sorts by score (best first), then by name, and drops the misses. With nothing typed, the list stays as it was. */
export function rank<T>(items: T[], q: string, text: (x: T) => string): T[] {
  if (!normalize(q)) return items; // nothing typed: keep the given order (like the rotation's)
  return items
    .map((x) => ({ x, s: score(text(x), q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || text(a.x).localeCompare(text(b.x), undefined, { sensitivity: 'base' }))
    .map((r) => r.x);
}

/** Ctrl K (Cmd K on a Mac) anywhere, or "/" when you're not typing in a box. */
export function opensBar(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, typing: boolean): 'open' | 'slash' | null {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') return 'open';
  if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) return 'slash';
  return null;
}
