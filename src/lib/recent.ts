/** The last pages you opened in a save (Sims, households, lots, clubs), for "Jump back in" on Today. Kept on this device only. */
export type RecentKind = 'sim' | 'household' | 'lot' | 'club';
export type Recent = { kind: RecentKind; id: string };
const KEY = (saveId: string) => `sd:recent:${saveId}`;

export function recentOf(saveId: string): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(saveId)) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && ['sim', 'household', 'lot', 'club'].includes(x.kind)) : [];
  } catch { return []; }
}

export function rememberVisit(saveId: string, kind: RecentKind, id: string) {
  const list = [{ kind, id }, ...recentOf(saveId).filter((r) => !(r.kind === kind && r.id === id))].slice(0, 10);
  try { localStorage.setItem(KEY(saveId), JSON.stringify(list)); } catch { /* private mode: no recents */ }
}

/** Which page an address is, if it's one worth remembering. */
export function visitOf(section: string, rest: string[]): Recent | null {
  if (section === 'sims' && rest[0]) return { kind: 'sim', id: rest[0] };
  if (section === 'households' && rest[0]) return { kind: 'household', id: rest[0] };
  if (section === 'worlds' && rest[0] === 'lot' && rest[1]) return { kind: 'lot', id: rest[1] };
  if (section === 'clubs' && rest[0]) return { kind: 'club', id: rest[0] };
  return null;
}
