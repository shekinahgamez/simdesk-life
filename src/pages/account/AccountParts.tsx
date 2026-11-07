import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowCounterClockwise, At, Desktop, DownloadSimple, FileArrowDown, FileArrowUp, Images, Key, Table, User, Warning } from '@phosphor-icons/react';
import { MRow } from '../../components/Shell';
import { Modal, Sheet, toast } from '../../components/ui';
import { PasswordInput } from '../../components/PasswordInput';
import { MIN_PASSWORD, setNewPassword } from '../../lib/auth';
import { backupCounts, downloadBackup, lastBackupOf, readBackup, restoreBackup, type BackupFile } from '../../lib/sync/backup';
import { useAccount, useStore } from '../../lib/sync/react';
import { downloadSpreadsheet } from '../../lib/sync/spreadsheet';
import { downloadPhotos } from '../../lib/sync/photoZip';
import type { CustomTrait } from '../../lib/sims';
import type { SaveRow } from '../../lib/sync/types';
import { usePhotos } from '../../lib/photos';
import { saveData, todayOf } from '../../lib/saves';
import { formatDate } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';

const shortDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });

/** A bottom sheet on phone, a centered window on desktop. */
function Pop({ title, onClose, footer, children }: { title: string; onClose(): void; footer(close: () => void): ReactNode; children: ReactNode }) {
  const phone = useIsPhone();
  if (phone) return <Sheet title={title} onClose={onClose}><div className="acct-sheet">{children}<div className="acct-sheet-foot">{footer(onClose)}</div></div></Sheet>;
  return <Modal title={title} onClose={onClose} autoFocus={false} footer={footer}>{children}</Modal>;
}

/** Username, email and password as rows. */
export function YouGroup({ username, email, onUsername, pretend }: { username: string; email: string | null; onUsername(): void; pretend?: boolean }) {
  const [pw, setPw] = useState(false);
  return (
    <>
      <div className="m-group acct-group">
        <MRow icon={<span className="obj berry"><User size={16} weight="duotone" /></span>} title="Username" value={username} onClick={pretend ? undefined : onUsername} />
        {email && <MRow icon={<span className="obj berry"><At size={16} weight="duotone" /></span>} title="Email" value={email} chevron={false} />}
        {!pretend && <MRow icon={<span className="obj berry"><Key size={16} weight="duotone" /></span>} title="Password" value="Change" onClick={() => setPw(true)} />}
      </div>
      {pw && <ChangePassword onClose={() => setPw(false)} />}
    </>
  );
}

function ChangePassword({ onClose }: { onClose(): void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = { p: useId(), c: useId() };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords don’t match.');
    setBusy(true);
    try { await setNewPassword(password); toast('Password changed'); onClose(); } catch (err) { setError((err as Error).message || 'That didn’t work. Try again?'); } finally { setBusy(false); }
  };
  return (
    <Pop title="Change password" onClose={onClose}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={() => submit()}>{busy ? 'One sec…' : 'Save new password'}</button></>}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.p}>New password</label>
          <PasswordInput id={ids.p} value={password} onChange={setPassword} autoComplete="new-password" />
          <div className="hint">At least {MIN_PASSWORD} characters.</div>
        </div>
        <div className="field">
          <label htmlFor={ids.c}>Confirm new password</label>
          <PasswordInput id={ids.c} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error && <p className="acct-error" role="alert"><Warning size={16} weight="fill" /> {error}</p>}
      </form>
    </Pop>
  );
}

/** Backups: download a file per save, or bring one back as a new save. */
export function BackupsCard({ saves }: { saves: SaveRow[] }) {
  const phone = useIsPhone();
  const [picking, setPicking] = useState<SaveRow | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [, bump] = useState(0);
  return (
    <section className="card acct-card">
      <div className="card-head"><h2>Backups</h2></div>
      {phone ? (
        <div className="acct-desk"><Desktop size={20} weight="duotone" /><span>Backups are on the computer version.</span></div>
      ) : <>
      <div className="acct-saves">
        {saves.map((s) => {
          const d = saveData(s);
          const last = lastBackupOf(s);
          return (
            <div key={s.id} className="acct-save">
              <span className="save-dot" style={{ background: d.color }} aria-hidden="true" />
              <span className="grow">
                <b>{d.name}</b>
                <span className="muted small">{d.trackDate ? `${formatDate(todayOf(d), 'short')}, Year ${todayOf(d).year} · ` : ''}{last ? `Last backup ${shortDay(last)}` : 'Never backed up'}</span>
              </span>
              <button type="button" className="btn sm" onClick={() => setPicking(s)}><DownloadSimple size={14} weight="bold" /> Download</button>
            </div>
          );
        })}
      </div>
      <div className="acct-restore">
        <button type="button" className="btn" onClick={() => setRestoring(true)}><ArrowCounterClockwise size={16} weight="bold" /> Restore from a backup</button>
      </div>
      </>}
      {picking && <DownloadDialog save={picking} onClose={() => setPicking(null)} onDone={() => bump((n) => n + 1)} />}
      {restoring && <RestoreDialog onClose={() => setRestoring(false)} />}
    </section>
  );
}

/** Download: a backup file (comes back into SimDesk) or a spreadsheet (for reading anywhere else). */
function DownloadDialog({ save, onClose, onDone }: { save: SaveRow; onClose(): void; onDone(): void }) {
  const store = useStore();
  const photos = usePhotos();
  const acct = useAccount();
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState<'json' | 'xlsx' | 'zip' | null>(null);
  const name = saveData(save).name;
  const go = async (kind: 'json' | 'xlsx' | 'zip') => {
    setBusy(kind);
    if (kind === 'zip') {
      const n = await downloadPhotos(store, save.id, photos).catch(() => -1);
      setBusy(null);
      if (n < 0) return toast('Couldn’t make the file. Try again?');
      if (n === 0) return toast(`${name} has no photos yet`);
      toast(`Downloaded ${n} photo${n === 1 ? '' : 's'}`);
      return onClose();
    }
    const custom = ((acct.data as { customTraits?: CustomTrait[] }).customTraits) ?? [];
    const ok = await (kind === 'json' ? downloadBackup(store, save.id, withPhotos ? photos : null) : downloadSpreadsheet(store, save.id, custom)).catch(() => false);
    setBusy(null);
    if (!ok) return toast('Couldn’t make the file. Try again?');
    toast(kind === 'json' ? `Backed up ${name}` : `Downloaded ${name} as a spreadsheet`);
    onDone(); onClose();
  };
  return (
    <Pop title={`Download ${name}`} onClose={onClose} footer={(close) => <button type="button" className="btn" onClick={close}>Cancel</button>}>
      <div className="acct-dl">
        <div className="acct-dlopt">
          <button type="button" className="acct-dlbtn" disabled={!!busy} onClick={() => go('json')}>
            <span className="obj berry"><FileArrowDown size={18} weight="duotone" /></span>
            <span className="grow"><b>{busy === 'json' ? 'Making it…' : 'Backup file'}</b><span className="muted small">.json · Can be restored</span></span>
          </button>
          <label className="acct-check acct-dlphotos">
            <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
            <span><b>Include photos</b></span>
          </label>
        </div>
        <button type="button" className="acct-dlbtn acct-dlopt" disabled={!!busy} onClick={() => go('xlsx')}>
          <span className="obj worlds"><Table size={18} weight="duotone" /></span>
          <span className="grow"><b>{busy === 'xlsx' ? 'Making it…' : 'Spreadsheet'}</b><span className="muted small">.xlsx · Can’t be restored</span></span>
        </button>
        <button type="button" className="acct-dlbtn acct-dlopt" disabled={!!busy} onClick={() => go('zip')}>
          <span className="obj photos"><Images size={18} weight="duotone" /></span>
          <span className="grow"><b>{busy === 'zip' ? 'Gathering photos…' : 'Photos'}</b><span className="muted small">.zip of JPGs · Can’t be restored</span></span>
        </button>
      </div>
    </Pop>
  );
}

function RestoreDialog({ onClose }: { onClose(): void }) {
  const store = useStore();
  const photos = usePhotos();
  const phone = useIsPhone();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; data: BackupFile } | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    try {
      const data = readBackup(await f.text());
      setFile({ name: f.name, data });
      setName(`${saveData({ data: data.save.data } as SaveRow).name} (restored)`);
    } catch {
      setFile(null);
      setError('That file isn’t a SimDesk backup. Pick the .json file you downloaded from SimDesk.');
    }
  };
  const go = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await restoreBackup(store, file.data, name.trim(), photos);
      onClose();
      toast(`Restored ${name.trim()}`, { label: 'Open it', run: () => { location.hash = `#/s/${id}${phone ? '/today' : ''}`; } });
    } catch {
      setBusy(false);
      setError('Couldn’t restore it. Check your connection and try again.');
    }
  };
  const c = file ? backupCounts(file.data) : null;
  const d = file ? saveData({ data: file.data.save.data } as SaveRow) : null;
  return (
    <Pop title="Restore from a backup" onClose={onClose}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!file || !name.trim() || busy} onClick={go}>{busy ? 'Restoring…' : 'Restore as a new save'}</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => pick(e.target.files?.[0])} />
        {!file ? (
          <button type="button" className="acct-drop" onClick={() => input.current?.click()}>
            <FileArrowUp size={28} weight="duotone" />
            <b>Pick a backup file</b>
            <span className="muted small">.json</span>
          </button>
        ) : (
          <>
            <div className="acct-preview">
              <span className="save-dot" style={{ background: d!.color }} aria-hidden="true" />
              <div className="grow">
                <b>{d!.name}</b>
                <div className="muted small">Backed up {shortDay(file.data.exported_at)}{d!.trackDate ? ` · ${formatDate(todayOf(d!), 'short')}, Year ${todayOf(d!).year}` : ''}</div>
                <div className="acct-counts">{c!.map((x) => <span key={x}>{x}</span>)}</div>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>Change</button>
            </div>
            <div className="field">
              <label htmlFor={nameId}>Name the restored save</label>
              <input id={nameId} className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <p className="muted small" style={{ margin: 0 }}>Comes back as a new save. Nothing gets replaced.</p>
          </>
        )}
        {error && <p className="acct-error" role="alert"><Warning size={16} weight="fill" /> {error}</p>}
      </div>
    </Pop>
  );
}
