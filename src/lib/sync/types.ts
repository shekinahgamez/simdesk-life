/** One saved thing in a save: a Sim, household, lot, holiday, club... `kind` says which. */
export type Rec = {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  /** When it was last edited (on whichever device). The newest edit wins. */
  edited_at: string;
  /** Set when it's in Trash. Cleared again when restored. */
  deleted_at: string | null;
};

export type SaveData = { name: string } & Record<string, unknown>;

export type SaveRow = {
  id: string;
  data: SaveData;
  edited_at: string;
  deleted_at: string | null;
  created_at?: string;
};

/** Account-wide things (custom traits, display choices). One per account; the newest edit wins. */
export type AccountDoc = { data: Record<string, unknown>; edited_at: string };

export type DraftRow = { key: string; save_id: string | null; data: Record<string, unknown>; updated_at: string };

export type RemoteEvent = { type: 'record'; saveId: string; rec: Rec } | { type: 'save'; save: SaveRow } | { type: 'account'; doc: AccountDoc };

/** Thrown when the internet (or Supabase) can't be reached. Edits stay waiting and retry. */
export class NetworkError extends Error {}
/** Thrown when the save is gone on the server (deleted for good on another device). */
export class GoneError extends Error {}

/** Where saves live. The app uses Supabase; the style check test uses a pretend one. */
export interface Backend {
  listSaves(): Promise<SaveRow[]>;
  pushSave(s: SaveRow): Promise<SaveRow>;
  purgeSave(id: string): Promise<void>;
  loadRecords(saveId: string): Promise<Rec[]>;
  pushRecords(saveId: string, items: Rec[]): Promise<Rec[]>;
  purgeRecords(saveId: string, ids: string[]): Promise<void>;
  listDrafts(): Promise<DraftRow[]>;
  putDraft(d: DraftRow): Promise<void>;
  deleteDraft(key: string): Promise<void>;
  loadAccount(): Promise<AccountDoc | null>;
  pushAccount(doc: AccountDoc): Promise<AccountDoc>;
  /** Live changes from other devices. Returns a function that stops listening. */
  subscribe(onEvent: (e: RemoteEvent) => void, onReconnect: () => void): () => void;
}

export const TRASH_DAYS = 7;
export const DRAFT_DAYS = 14;
export const DRAFT_WARN_DAYS = 3;
export const DAY = 86_400_000;
