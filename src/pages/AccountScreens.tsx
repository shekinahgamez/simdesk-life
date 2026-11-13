import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Gear, SignOut } from '@phosphor-icons/react';
import { PasswordInput } from '../components/PasswordInput';
import { Confirm, Field, Modal, toast } from '../components/ui';
import { SaveTrash } from '../components/sync';
import { BackLink, MRow, Shell } from '../components/Shell';
import { BackupsCard, YouGroup } from './account/AccountParts';
import { supabase } from '../lib/supabase';
import type { CategoryId } from '../components/categories';
import { go, savePath, useRoute } from '../lib/router';
import { getLastSave, setLastSave } from '../lib/saves';
import { useIsPhone } from '../lib/useIsPhone';
import { More, OnItsWay } from './InApp';
import { TodayPage } from './Today';
import { RotationPage } from './rotation/Rotation';
import { rememberVisit, visitOf } from '../lib/recent';
import { HouseholdsList } from './households/HouseholdsList';
import { LotTypeRegistry } from './worlds/shared';
import { CalendarPage } from './calendar/CalendarPage';
import { PhotosPage } from './photos/PhotosPage';
import { ClubsPage } from './clubs/ClubsPage';
import { StorylinesPage } from './storylines/StorylinesPage';
import { LegacyPage } from './legacy/LegacyPage';
import { DocsPage } from './docs/DocsPage';
import { BusinessesPage } from './businesses/BusinessesPage';
import { isItemKind, ItemPage } from './calendar/ItemPage';
import { HouseholdPage } from './households/HouseholdPage';
import { SaveSettings } from './SaveSettings';
import { AppSettings } from './AppSettings';
import { AskSettings } from './worlds/AskSettings';
import { RealAgesSettings } from './sims/RealAgesSettings';
import { Setup } from './Setup';
import { Intro, introDue } from '../components/Intro';
import { SyncProvider, useSaves, useStore, useStoreVersion } from '../lib/sync/react';
import { SyncStore } from '../lib/sync/store';
import { supabaseBackend } from '../lib/sync/supabaseBackend';
import { MemoryBackend } from '../lib/sync/memoryBackend';
import { localPhotos, photoIdsIn, PhotoCtx, supabasePhotos, type PhotoService } from '../lib/photos';
import { SimProfile } from './sims/SimProfile';
import { SimsList } from './sims/SimsList';
import { WorldsHome } from './worlds/WorldsHome';
import { WorldPage } from './worlds/WorldPage';
import { ApartmentPage, LotPage } from './worlds/LotPage';
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

/** Account page: username, log out, app settings and deleted saves. (The full Account page comes in Phase 9.) */
function AccountPage({ profile, onProfile, pretend }: { profile: Profile; onProfile(p: Profile): void; pretend?: boolean }) {
  const [changing, setChanging] = useState(false);
  const [askLogOut, setAskLogOut] = useState(false);
  const store = useStore();
  const { trashed, active } = useSaves();
  const phone = useIsPhone();
  const leave = async () => {
    if (pretend) { endPretend(); return; }
    await store.wipe();
    localStorage.removeItem(PROFILE_KEY);
    await logOut();
  };
  const tryLogOut = () => (store.hasPending() ? setAskLogOut(true) : leave());
  const back = store.openId ? savePath(store.openId, phone ? 'more' : '') : '#/';
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { if (!pretend) supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null)).catch(() => {}); }, [pretend]);
  const body = (
    <>
      <div className="acct-head">
        <span className="acct-avatar" aria-hidden="true">{profile.username.slice(0, 1).toUpperCase()}</span>
        <div><div className="acct-name">{profile.username}</div>{pretend && <div className="muted small">Pretend account</div>}</div>
      </div>
      <YouGroup username={profile.username} email={email} pretend={pretend} onUsername={() => setChanging(true)} />
      <div className="m-group acct-group">
        <MRow href="#app-settings" title="App settings" sub="Theme, real-life ages, questions" icon={<span className="obj berry"><Gear size={16} weight="duotone" /></span>} />
      </div>
      {active.length > 0 && <BackupsCard saves={active} />}
      <section className="card acct-card">
        <div className="card-head"><h2>Deleted saves</h2></div>
        {trashed.length === 0
          ? <p className="small muted" style={{ margin: 0 }}>None. A deleted save stays here for 7 days, then it’s gone for good.</p>
          : <><p className="small muted" style={{ margin: 0 }}>A deleted save stays here for 7 days, then it’s gone for good.</p><SaveTrash saves={trashed} /></>}
      </section>
      <div className="acct-logout">
        <button type="button" className="btn danger" onClick={tryLogOut}><SignOut size={16} weight="duotone" /> {pretend ? 'Leave the pretend account' : 'Log out'}</button>
      </div>
    </>
  );
  return (
    <>
      {phone ? (
        <div className="m-stack">
          {store.openId && <BackLink href={back} label="More" />}
          <h1 className="m-h1">Account</h1>
          {body}
        </div>
      ) : (
        <div className="page" style={{ maxWidth: 640 }}>
          <div className="page-head"><div><h1>Account</h1></div></div>
          {body}
        </div>
      )}
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
    </>
  );
}

const SECTION_CATS: Record<string, CategoryId> = { sims: 'sims', households: 'households', worlds: 'worlds', lots: 'worlds', calendar: 'calendar', photos: 'photos', clubs: 'clubs', storylines: 'storylines' };

/** Everything after logging in, with the opening intro over it on the first open of each day. */
export function AppRoot(props: { userId: string; profile: Profile; onProfile(p: Profile): void; pretend?: boolean }) {
  const [intro, setIntro] = useState(() => !props.pretend && introDue(props.userId));
  return (
    <>
      <AppPages {...props} />
      {intro && <Intro onDone={() => setIntro(false)} />}
    </>
  );
}

/** Picks the page from the address and keeps the right save open. */
function AppPages({ userId, profile, onProfile, pretend }: { userId: string; profile: Profile; onProfile(p: Profile): void; pretend?: boolean }) {
  const route = useRoute();
  const store = useStore();
  useStoreVersion();
  const { active } = useSaves();
  const phone = useIsPhone();
  const ready = store.savesState === 'ready';
  const routeSave = route.page === 'save' ? active.find((s) => s.id === route.saveId) ?? null : null;

  useEffect(() => {
    if (!ready) return;
    if (route.page === 'home') {
      if (active.length === 0) {
        if (!store.savesChecked) return; // wait for the account before deciding there are no saves
        return go('#/setup', { replace: true });
      }
      const last = getLastSave(userId);
      const target = active.find((s) => s.id === last) ?? active[0];
      return go(savePath(target.id, phone ? 'today' : ''), { replace: true });
    }
    if (route.page === 'save') {
      if (!routeSave) return go('#/', { replace: true });
      if (phone && route.section === '') return go(savePath(routeSave.id, 'today'), { replace: true });
      if (!phone && (route.section === 'today' || route.section === 'more')) return go(savePath(routeSave.id), { replace: true });
      setLastSave(userId, routeSave.id);
      const v = visitOf(route.section, route.rest);
      if (v) rememberVisit(routeSave.id, v.kind, v.id);
      if (store.openId !== routeSave.id) void store.openSave(routeSave.id);
      else store.purgeExpired();
    }
  }, [ready, route, routeSave, active.length, phone, userId, store, store.savesChecked]);

  if (store.savesState === 'error') {
    return (
      <AuthShell title="Can’t reach SimDesk">
        <p className="muted" style={{ margin: 0 }}>Check your connection, then try again. Once your saves have loaded on this device, they open even without internet.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn primary" onClick={() => void store.retry()}>Try again</button>
          <button type="button" className="btn ghost" onClick={() => logOut()}>Log out</button>
        </div>
      </AuthShell>
    );
  }
  if (!ready) return <div className="loading" role="status">Loading your saves…</div>;
  if (route.page === 'setup') return <Setup userKey={userId} />;

  const shellSave = routeSave ?? (store.openId ? active.find((s) => s.id === store.openId) ?? null : null);
  if (route.page === 'app-settings') return <Shell save={shellSave} route={route}><AppSettings inShell extra={<><RealAgesSettings phone={phone} /><AskSettings phone={phone} /></>} /></Shell>;
  if (route.page === 'account') return <Shell save={shellSave} route={route}><AccountPage profile={profile} onProfile={onProfile} pretend={pretend} /></Shell>;
  if (!routeSave || route.page !== 'save') return <div className="loading" role="status">Opening your save…</div>;

  const sec = route.section;
  let page: ReactNode;
  if (sec === 'settings') page = <SaveSettings save={routeSave} />;
  else if (sec === 'today') page = <TodayPage save={routeSave} />;
  else if (sec === 'more') page = <More save={routeSave} />;
  else if (sec === 'rotation') page = <RotationPage save={routeSave} />;
  else if (sec === 'worlds' || sec === 'lots') {
    const [a, b] = sec === 'lots' ? ['lots'] : route.rest;
    if (a === 'lot' && b) page = <LotPage key={b} save={routeSave} lotId={b} />;
    else if (a === 'apt' && b) page = <ApartmentPage key={b} save={routeSave} gameId={b} />;
    else if (a && a !== 'lots') page = <WorldPage key={a} save={routeSave} worldId={a} />;
    else page = <WorldsHome save={routeSave} tab={a === 'lots' ? 'lots' : 'worlds'} />;
  }
  else if (sec === 'calendar' && isItemKind(route.rest[0]) && route.rest[1]) page = <ItemPage key={route.rest.join('/')} save={routeSave} kind={route.rest[0]} id={route.rest[1]} when={route.rest[2]} />;
  else if (sec === 'calendar') page = <CalendarPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'photos') page = <PhotosPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'clubs') page = <ClubsPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'storylines') page = <StorylinesPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'businesses') page = <BusinessesPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'docs') page = <DocsPage key={route.rest[0] ?? ''} save={routeSave} rest={route.rest} />;
  else if (sec === 'legacy') page = <LegacyPage key={route.rest.join('/')} save={routeSave} rest={route.rest} />;
  else if (sec === 'households') page = route.rest[0] ? <HouseholdPage key={route.rest[0]} save={routeSave} hhId={route.rest[0]} /> : <HouseholdsList save={routeSave} />;
  else if (sec === 'sims') page = route.rest[0] ? <SimProfile key={route.rest[0]} save={routeSave} simId={route.rest[0]} /> : <SimsList save={routeSave} />;
  else if (SECTION_CATS[sec]) page = <OnItsWay cat={SECTION_CATS[sec]} />;
  else page = <TodayPage save={routeSave} />;
  return <><LotTypeRegistry /><Shell save={routeSave} route={route}>{page}</Shell></>;
}

const PROFILE_KEY = 'sd:profile';

// ---------- photos ----------
const pretendPhotos = localPhotos('sd:pretend-account');
const photoServices = new Map<string, PhotoService>();
function photosFor(userId: string) {
  let p = photoServices.get(userId);
  if (!p) { p = supabasePhotos(userId); photoServices.set(userId, p); }
  return p;
}
/** Things deleted for good take their photos with them. */
function wirePhotos(store: SyncStore, photos: PhotoService) {
  store.onPurge = (recs) => {
    const ids = recs.flatMap((r) => photoIdsIn(r.data));
    if (ids.length) void photos.remove(ids).catch(() => { /* tidied up next time */ });
  };
  store.onPurgeSave = (saveId) => {
    const cover = photoIdsIn(store.saves.get(saveId)?.data);
    void photos.removeForSave(saveId).catch(() => {});
    if (cover.length) void photos.remove(cover).catch(() => {});
  };
}

// ---------- pretend account (for trying the app where Supabase can't be reached, like a preview link) ----------
const PRETEND_KEY = 'sd:pretend';
export function isPretend() { try { return sessionStorage.getItem(PRETEND_KEY) === '1'; } catch { return false; } }
export function startPretend() { try { sessionStorage.setItem(PRETEND_KEY, '1'); } catch { /* ignore */ } location.hash = '#/'; location.reload(); }
function endPretend() { try { sessionStorage.removeItem(PRETEND_KEY); } catch { /* ignore */ } location.hash = '#style-guide'; location.reload(); }

export function PretendApp() {
  const [store] = useState(() => {
    const s = new SyncStore(new MemoryBackend('sd:pretend-account'), 'pretend');
    wirePhotos(s, pretendPhotos);
    void s.start({ listenToWindow: true });
    return s;
  });
  const [profile, setProfile] = useState<Profile>({ user_id: 'pretend', username: 'PretendSimmer', plan: 'free' });
  return (
    <SyncProvider store={store}>
      <PhotoCtx.Provider value={pretendPhotos}>
      <div className="pretend-bar">Pretend account · saved in this browser only</div>
      <AppRoot userId="pretend" profile={profile} onProfile={setProfile} pretend />
      </PhotoCtx.Provider>
    </SyncProvider>
  );
}

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
    wirePhotos(s, photosFor(userId));
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
    const cached = cachedProfile(userId);
    // A slow or hanging connection: after 4 seconds, open with what this device remembers.
    const slow = cached ? setTimeout(() => setProfile((p) => p ?? cached), 4000) : undefined;
    loadProfile().then((p) => { clearTimeout(slow); remember(p); }).catch((e) => {
      clearTimeout(slow);
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
      <PhotoCtx.Provider value={photosFor(userId)}>
        <AppRoot userId={userId} profile={profile} onProfile={remember} />
      </PhotoCtx.Provider>
    </SyncProvider>
  );
}
