/**
 * Tiny key-value storage on this device (IndexedDB). Holds the copy of the save that opens offline
 * and the edits that haven't synced yet. If the browser blocks IndexedDB (some private windows),
 * it quietly falls back to memory, so the app still works for that visit.
 */
const DB = 'simdesk';
const STORE = 'kv';
const mem = new Map<string, unknown>();
let dbp: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return mem.get(key) as T | undefined;
  return new Promise((resolve) => {
    try {
      const q = d.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => resolve((q.result as T | undefined) ?? (mem.get(key) as T | undefined));
      q.onerror = () => resolve(mem.get(key) as T | undefined);
    } catch {
      resolve(mem.get(key) as T | undefined);
    }
  });
}

function write(fn: (s: IDBObjectStore) => void): Promise<void> {
  return db().then((d) => {
    if (!d) return;
    return new Promise<void>((resolve) => {
      try {
        const t = d.transaction(STORE, 'readwrite');
        fn(t.objectStore(STORE));
        t.oncomplete = () => resolve();
        t.onerror = () => resolve();
        t.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

export function kvSet(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  return write((s) => s.put(value, key));
}

export function kvDel(key: string): Promise<void> {
  mem.delete(key);
  return write((s) => s.delete(key));
}

/** Deletes every key that starts with prefix (used on log out). */
export function kvDelPrefix(prefix: string): Promise<void> {
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
  return write((s) => s.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)));
}
