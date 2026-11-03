import { useEffect, useId, useState, type FormEvent } from 'react';
import { CheckCircle, Gear, Palette, SignOut } from '@phosphor-icons/react';
import { Wordmark } from '../components/brand';
import { PasswordInput } from '../components/PasswordInput';
import { Confirm, Field, Modal, toast } from '../components/ui';
import { SyncCloud, SyncLine } from '../components/sync';
import { SyncProvider, useStore } from '../lib/sync/react';
import { SyncStore } from '../lib/sync/store';
import { supabaseBackend } from '../lib/sync/supabaseBackend';
import { NetworkError } from '../lib/sync/types';
import {
  AuthError, changeUsername, claimUsername, loadProfile, logOut, MIN_PASSWORD, nextUsernameChange, recentUsernameChanges,
  setNewPassword, type Profile,
} from '../lib/auth';
import { AuthShell, FormError, UsernameHint, useUsernameCheck } from './Auth';

const errText = (e: unknown) => (e instanceof AuthError ? e.message : 'Something went wrong. Try again?');
const day = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** Opened from the reset link in the email. */
export function SetPassword({ onDone }: { onDone(): void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = { p: useId(), c: useId() };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords don’t match.');
    setBusy(true);
    try {
      await setNewPassword(password);
      toast('Password changed');
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Set a new password">
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.p}>New password</label>
          <PasswordInput id={ids.p} value={password} onChange={setPassword} autoComplete="new-password" />
          <div className="hint">At least {MIN_PASSWORD} characters.</div>
        </div>
        <div className="field">
          <label htmlFor={ids.c}>Confirm new password</label>
          <PasswordInput id={ids.c} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>
        {error && <FormError>{error}</FormError>}
        <button type="submit" className="btn primary lg auth-wide" disabled={busy}>{busy ? 'One sec…' : 'Save new password'}</button>
      </form>
    </AuthShell>
  );
}

/** For an account made before usernames existed. */
function PickUsername({ onDone }: { onDone(): void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = { u: useId(), h: useId() };
  const check = useUsernameCheck(name);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (check !== 'free') return;
    setBusy(true);
    setError('');
    try {
      await claimUsername(name);
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Pick a username">
      <p className="muted" style={{ margin: '0 0 16px' }}>Your account was made before SimDesk had usernames. Pick one to keep going.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={ids.u}>Username</label>
          <input id={ids.u} className="input" value={name} onChange={(e) => setName(e.target.value.trim())} maxLength={30}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={ids.h} />
          <UsernameHint id={ids.h} state={check} />
        </div>
        {error && <FormError>{error}</FormError>}
        <button type="submit" className="btn primary lg auth-wide" disabled={busy || check !== 'free'}>{busy ? 'One sec…' : 'Save username'}</button>
        <button type="button" className="btn ghost auth-link" onClick={() => logOut()}>Log out</button>
      </form>
    </AuthShell>
  );
}

function ChangeUsername({ profile, onClose, onSaved }: { profile: Profile; onClose(): void; onSaved(name: string): void }) {
  const [name, setName] = useState(profile.username);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nextOpen, setNextOpen] = useState<Date | null | undefined>(undefined);
  const hintId = useId();
  const same = name.toLowerCase() === profile.username.toLowerCase();
  const check = useUsernameCheck(same ? '' : name);
  useEffect(() => {
    recentUsernameChanges().then((r) => setNextOpen(nextUsernameChange(r))).catch(() => setNextOpen(null));
  }, []);
  const locked = !!nextOpen && nextOpen > new Date();
  const casingOnly = same && name !== profile.username;
  const canSave = !locked && !busy && (casingOnly || check === 'free');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await changeUsername(profile.user_id, name);
      onSaved(name);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Change username" onClose={onClose} dirty={name !== profile.username}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={!canSave} onClick={save}>{busy ? 'One sec…' : 'Save'}</button></>}>
      {locked ? (
        <p style={{ margin: 0 }}>You’ve changed your username twice in the last 14 days. You can change it again on <b>{day(nextOpen!)}</b>.</p>
      ) : (
        <div className="stack">
          <Field label="Username">
            {(id) => (
              <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value.trim())} maxLength={30}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={hintId} />
            )}
          </Field>
          {same ? <div id={hintId} className="hint">You can change your username twice in any 14 days.</div> : <UsernameHint id={hintId} state={check} />}
          {error && <FormError>{error}</FormError>}
        </div>
      )}
    </Modal>
  );
}

/** Placeholder for the signed-in app until setup and navigation are built (Phase 2). */
function SignedInHome({ profile, onProfile }: { profile: Profile; onProfile(p: Profile): void }) {
  const [changing, setChanging] = useState(false);
  const [askLogOut, setAskLogOut] = useState(false);
  const store = useStore();
  const leave = async () => {
    await store.wipe();
    localStorage.removeItem(PROFILE_KEY);
    await logOut();
  };
  const tryLogOut = () => (store.hasPending() ? setAskLogOut(true) : leave());
  return (
    <main className="signed-in">
      <Wordmark size={40} />
      <div className="card stack signed-in-card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="form-ok"><CheckCircle size={18} weight="fill" /> You’re logged in.</div>
          <SyncCloud />
        </div>
        <SyncLine />
        <div>
          <div className="small muted">Username</div>
          <div className="signed-in-name">{profile.username}</div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Your saves come next. For now this page just shows that your account works.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => setChanging(true)}>Change username</button>
          <button type="button" className="btn danger" onClick={tryLogOut}><SignOut size={16} weight="duotone" /> Log out</button>
        </div>
        <div className="row">
          <a className="btn ghost sm" href="#app-settings"><Gear size={16} weight="duotone" /> App settings</a>
          <a className="btn ghost sm" href="#style-check"><Palette size={16} weight="duotone" /> Style check</a>
        </div>
      </div>
      {askLogOut && (
        <Confirm title="Some changes haven’t synced yet"
          text={store.isOnline() ? 'They’re still sending. If you log out now, they’ll be lost.' : 'You’re offline, so they’re only on this device. If you log out now, they’ll be lost.'}
          onCancel={() => setAskLogOut(false)}
          actions={[
            { label: 'Stay logged in', kind: 'primary', run: () => setAskLogOut(false) },
            { label: 'Log out anyway', kind: 'danger', run: () => { setAskLogOut(false); leave(); } },
          ]} />
      )}
      {changing && (
        <ChangeUsername profile={profile} onClose={() => setChanging(false)}
          onSaved={(name) => { setChanging(false); onProfile({ ...profile, username: name }); toast(`You’re now ${name}`); }} />
      )}
    </main>
  );
}

const PROFILE_KEY = 'sd:profile';

/** Remembers the account on this device so the app can open with no internet. */
function cachedProfile(userId: string): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as Profile | null;
    return p && p.user_id === userId ? p : null;
  } catch {
    return null;
  }
}

export function SignedIn({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [store, setStore] = useState<SyncStore | null>(null);

  useEffect(() => {
    const s = new SyncStore(supabaseBackend, userId);
    setStore(s);
    s.start({ listenToWindow: true });
    return () => s.stop();
  }, [userId]);

  const remember = (p: Profile | null) => {
    setProfile(p);
    try { if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  };
  const load = () => {
    setError('');
    loadProfile().then(remember).catch((e) => {
      const cached = cachedProfile(userId);
      // Offline: open with what this device remembers instead of an error.
      if (cached && (e instanceof NetworkError || !navigator.onLine || /reach/i.test(errText(e)))) setProfile(cached);
      else setError(errText(e));
    });
  };
  useEffect(load, [userId]);
  if (error) {
    return (
      <AuthShell title="Couldn’t load your account">
        <FormError>{error}</FormError>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn primary" onClick={load}>Try again</button>
          <button type="button" className="btn ghost" onClick={() => logOut()}>Log out</button>
        </div>
      </AuthShell>
    );
  }
  if (profile === undefined || !store) return <div className="loading" role="status">Loading your account…</div>;
  if (profile === null) return <PickUsername onDone={load} />;
  return (
    <SyncProvider store={store}>
      <SignedInHome profile={profile} onProfile={remember} />
    </SyncProvider>
  );
}
