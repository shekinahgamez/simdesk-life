import { useState, type ReactNode } from 'react';
import {
  ArrowCounterClockwise, CheckCircle, CloudArrowUp, CloudSlash, CloudWarning, DownloadSimple, Trash, WarningCircle,
} from '@phosphor-icons/react';
import { downloadBackup } from '../lib/sync/backup';
import { useStore, useSyncStatus } from '../lib/sync/react';
import { STATUS_TEXT, trashDaysLeft } from '../lib/sync/store';
import type { Rec, SaveRow } from '../lib/sync/types';
import { plural } from '../lib/text';
import { Confirm, toast } from './ui';

const deletesIn = (iso: string) => {
  const d = trashDaysLeft(iso);
  return d === 1 ? 'Deletes for good within a day' : `Deletes for good in ${d} days`;
};

/** Desktop sidebar line: colored dot plus words. */
export function SyncLine() {
  const { status, error, pending } = useSyncStatus();
  const text = status === 'offline' && pending > 0 ? `Offline. ${plural(pending, 'change')} saved on this device.` : STATUS_TEXT[status];
  return (
    <div className="sync-line" role="status" title={status === 'error' ? error : undefined}>
      <span className={`sync-dot ${status === 'synced' ? '' : status}`} aria-hidden="true" />
      {text}
    </div>
  );
}

/** Phone: a small cloud that only shows while something isn't synced. Tap it for the words. */
export function SyncCloud() {
  const { status, pending } = useSyncStatus();
  if (status === 'synced') return null;
  const I = status === 'offline' ? CloudSlash : status === 'error' ? CloudWarning : CloudArrowUp;
  const text = status === 'offline' && pending > 0 ? `Offline. ${plural(pending, 'change')} saved on this device.` : STATUS_TEXT[status];
  return (
    <button type="button" className={`sync-cloud ${status}`} aria-label={text} onClick={() => toast(text)}>
      <I size={22} weight="duotone" />
    </button>
  );
}

/** Shown in a form when another device changed (or trashed) the same thing while it was open. */
export function ChangedElsewhere({ what, theirs, onKeep, onTheirs }: { what: string; theirs: Rec; onKeep(): void; onTheirs(): void }) {
  const trashed = !!theirs.deleted_at;
  return (
    <div className="notice warn" role="alert">
      <WarningCircle size={20} weight="duotone" />
      <div className="notice-body">
        <b>{trashed ? `This ${what} was moved to Trash on another device.` : `This ${what} was changed on another device.`}</b>
        <span>{trashed ? 'Keep mine brings it back with your changes.' : 'Keep mine saves your version over theirs. Use theirs reloads this form.'}</span>
        <div className="row">
          <button type="button" className="btn sm primary" onClick={onKeep}>Keep mine</button>
          {!trashed && <button type="button" className="btn sm" onClick={onTheirs}>Use theirs</button>}
        </div>
      </div>
    </div>
  );
}

/** Top of a form that reopened a draft. Warns in the last 3 days. */
export function DraftNote({ savedAt, daysLeft, expiringSoon, onDiscard }: {
  savedAt: Date; daysLeft: number; expiringSoon: boolean; onDiscard(): void;
}) {
  const when = savedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div className={`notice ${expiringSoon ? 'warn' : ''}`} role="status">
      {expiringSoon ? <WarningCircle size={20} weight="duotone" /> : <CheckCircle size={20} weight="duotone" />}
      <div className="notice-body">
        <b>Picked up your draft from {when}.</b>
        <span>{expiringSoon ? `This draft expires in ${plural(daysLeft, 'day')}. Save it to keep it.` : `Drafts are kept for 14 days.`}</span>
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={onDiscard}>Start over</button>
        </div>
      </div>
    </div>
  );
}

/** Trash for the open save. `describe` gives each thing's name and icon. */
export function TrashList({ items, describe }: { items: Rec[]; describe(r: Rec): { name: string; icon: ReactNode } }) {
  const store = useStore();
  const [forever, setForever] = useState<Rec | 'all' | null>(null);
  if (items.length === 0) {
    return <p className="muted small" style={{ margin: 0 }}>Trash is empty. Deleted things stay here for 7 days, then they’re gone for good.</p>;
  }
  const target = forever === 'all' ? null : forever;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="muted small" style={{ margin: 0 }}>Deleted things stay here for 7 days, then they’re gone for good.</p>
      <div className="trash-list">
        {items.map((r) => {
          const d = describe(r);
          return (
            <div key={r.id} className="trash-row">
              {d.icon}
              <div className="trash-txt">
                <b>{d.name}</b>
                <span>{deletesIn(r.deleted_at!)}</span>
              </div>
              <button type="button" className="btn sm" onClick={() => { store.restore(r.id); toast(`${d.name} restored`); }}>
                <ArrowCounterClockwise size={16} weight="bold" /> Restore
              </button>
              <button type="button" className="btn sm ghost icon" aria-label={`Delete ${d.name} for good`} onClick={() => setForever(r)}>
                <Trash size={18} weight="duotone" />
              </button>
            </div>
          );
        })}
      </div>
      <div><button type="button" className="btn sm danger" onClick={() => setForever('all')}><Trash size={16} weight="duotone" /> Empty Trash</button></div>
      {forever && (
        <Confirm
          title={target ? `Delete ${describe(target).name} for good?` : `Empty Trash?`}
          text={target ? 'This can’t be undone.' : `${plural(items.length, 'thing')} will be deleted for good. This can’t be undone.`}
          onCancel={() => setForever(null)}
          actions={[
            { label: 'Cancel', run: () => setForever(null) },
            { label: target ? 'Delete for good' : 'Empty Trash', kind: 'danger', run: () => {
              if (target) store.deleteForever([target.id]); else store.emptyTrash();
              setForever(null);
            } },
          ]}
        />
      )}
    </div>
  );
}

/** Asks before deleting a whole save, and offers a backup download first. */
export function DeleteSaveDialog({ save, onClose }: { save: SaveRow; onClose(): void }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const backup = async () => {
    setBusy(true);
    const ok = await downloadBackup(store, save.id).catch(() => false);
    setBusy(false);
    if (ok) setDone(true);
    else toast('Couldn’t make the backup. Try again?');
  };
  return (
    <Confirm
      title={`Delete ${save.data.name}?`}
      text="It goes to Trash for 7 days, then it’s gone for good, with every Sim, household and lot in it. Want a backup file first?"
      onCancel={onClose}
      actions={[
        { label: done ? <><CheckCircle size={18} weight="fill" /> Backup downloaded</> : <><DownloadSimple size={18} weight="bold" /> {busy ? 'Making backup…' : 'Download a backup first'}</>,
          kind: done ? undefined : 'primary', disabled: busy || done, run: backup },
        { label: 'Cancel', run: onClose },
        { label: 'Delete save', kind: 'danger', run: () => { store.trashSave(save.id); onClose(); } },
      ]}
    />
  );
}

/** Saves in Trash, with Restore and Delete for good. */
export function SaveTrash({ saves }: { saves: SaveRow[] }) {
  const store = useStore();
  const [forever, setForever] = useState<SaveRow | null>(null);
  if (saves.length === 0) return null;
  return (
    <div className="trash-list">
      {saves.map((s) => (
        <div key={s.id} className="trash-row">
          <span className="obj berry" aria-hidden="true"><Trash size={16} weight="duotone" /></span>
          <div className="trash-txt"><b>{s.data.name}</b><span>{deletesIn(s.deleted_at!)}</span></div>
          <button type="button" className="btn sm" onClick={() => { store.restoreSave(s.id); toast(`${s.data.name} restored`); }}>
            <ArrowCounterClockwise size={16} weight="bold" /> Restore
          </button>
          <button type="button" className="btn sm ghost icon" aria-label={`Delete ${s.data.name} for good`} onClick={() => setForever(s)}>
            <Trash size={18} weight="duotone" />
          </button>
        </div>
      ))}
      {forever && (
        <Confirm title={`Delete ${forever.data.name} for good?`} text="Every Sim, household and lot in it will be gone. This can’t be undone."
          onCancel={() => setForever(null)}
          actions={[
            { label: 'Cancel', run: () => setForever(null) },
            { label: 'Delete for good', kind: 'danger', run: () => { store.deleteSaveForever(forever.id); setForever(null); } },
          ]} />
      )}
    </div>
  );
}
