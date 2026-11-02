import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Moon, SignOut, Sun, Trash, UserCircle } from '@phosphor-icons/react';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { nowIso, uid } from '../lib/ids';
import { applyTheme, getTheme, type ThemePref } from '../lib/theme';
import { APP } from '../config/app';
import { Field, Seg, toast } from '../components/ui';

export default function AccountPage() {
  const { session, backend, signOut, customTraits, saveCustomTraits, deleteCustomTrait, saves } = useStore();
  const [theme, setTheme] = useState<ThemePref>(getTheme());
  const [one, setOne] = useState({ name: '', pack: '', creator: '' });
  const [paste, setPaste] = useState({ text: '', pack: '', creator: '' });
  const [pw, setPw] = useState('');
  const guest = backend?.mode === 'local';

  const grouped = useMemo(() => {
    const m = new Map<string, typeof customTraits>();
    for (const t of [...customTraits].sort((a, b) => a.name.localeCompare(b.name))) m.set(t.pack || 'No pack', [...(m.get(t.pack || 'No pack') ?? []), t]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [customTraits]);

  const addPasted = () => {
    const names = [...new Set(paste.text.split(/\r?\n/).map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean))];
    const existing = new Set(customTraits.filter((t) => (t.pack ?? '') === paste.pack.trim()).map((t) => t.name.toLowerCase()));
    const fresh = names.filter((n) => !existing.has(n.toLowerCase()));
    saveCustomTraits(fresh.map((name) => ({ id: uid(), name, pack: paste.pack.trim() || undefined, creator: paste.creator.trim() || undefined, createdAt: nowIso() })));
    toast(`Added ${fresh.length} trait${fresh.length === 1 ? '' : 's'}${names.length - fresh.length ? ` (${names.length - fresh.length} already there)` : ''}.`);
    setPaste({ ...paste, text: '' });
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <h1 className="row" style={{ gap: 12 }}><span className="obj berry lg"><UserCircle size={24} weight="duotone" /></span> {guest ? 'Guest mode' : 'Account'}</h1>
          <div className="sub">{guest ? 'Your saves live in this browser only.' : session?.user.email}</div>
        </div>
        <button className="btn" onClick={() => void signOut()}><SignOut size={16} weight="bold" /> {guest ? 'Leave guest mode' : 'Log out'}</button>
      </div>

      {guest && (
        <section className="card" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
          <h2>Want your saves on every device?</h2>
          <p className="small" style={{ marginBottom: 0 }}>Make a free account to sync across your computer and phone. Guest saves stay on this device, so leave guest mode and sign up before you build too much.</p>
        </section>
      )}

      {saves.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Your saves</h2><Link className="btn sm" to="/setup">New save</Link></div>
          <div className="stack" style={{ gap: 2 }}>
            {saves.map((s) => (
              <Link key={s.id} to={`/s/${s.id}`} className="list-item">
                <span style={{ width: 12, height: 12, borderRadius: 4, background: s.color }} />
                <span className="grow bold">{s.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Look</h2></div>
        <Seg<ThemePref>
          label="Theme"
          value={theme}
          onChange={(t) => { setTheme(t); applyTheme(t); }}
          options={[{ v: 'system', label: 'Match my device' }, { v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }]}
        />
        <div className="row tiny muted" style={{ marginTop: 8 }}><Monitor size={14} /> <Sun size={14} /> <Moon size={14} /></div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Custom traits</h2><span className="small muted">{customTraits.length}</span></div>
        <p className="small muted" style={{ marginTop: 0 }}>Modded traits live on your account, so a trait pack added once works in every save.</p>
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (!one.name.trim()) return; saveCustomTraits([{ id: uid(), name: one.name.trim(), pack: one.pack.trim() || undefined, creator: one.creator.trim() || undefined, createdAt: nowIso() }]); setOne({ ...one, name: '' }); }}>
          <Field label="Trait name">{(id) => <input id={id} className="input" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} />}</Field>
          <Field label="Trait pack">{(id) => <input id={id} className="input" list="trait-packs" value={one.pack} onChange={(e) => setOne({ ...one, pack: e.target.value })} />}</Field>
          <Field label="Creator">{(id) => <input id={id} className="input" value={one.creator} onChange={(e) => setOne({ ...one, creator: e.target.value })} />}</Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={!one.name.trim()}>Add trait</button></div>
        </form>
        <datalist id="trait-packs">{grouped.map(([p]) => <option key={p} value={p === 'No pack' ? '' : p} />)}</datalist>
        <div className="divider" />
        <div className="stack">
          <Field label="Or paste a whole trait pack" hint="One trait per line. Bullets and numbers are cleaned up for you.">
            {(id) => <textarea id={id} className="textarea" placeholder={'Hopeless Romantic\nPeople Pleaser\nTrust Issues'} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />}
          </Field>
          <div className="form-grid">
            <Field label="Pack name">{(id) => <input id={id} className="input" list="trait-packs" value={paste.pack} onChange={(e) => setPaste({ ...paste, pack: e.target.value })} />}</Field>
            <Field label="Creator">{(id) => <input id={id} className="input" value={paste.creator} onChange={(e) => setPaste({ ...paste, creator: e.target.value })} />}</Field>
          </div>
          <div><button className="btn primary" disabled={!paste.text.trim()} onClick={addPasted}>Add these traits</button></div>
        </div>
        {grouped.length > 0 && (
          <>
            <div className="divider" />
            <div className="stack" style={{ gap: 14 }}>
              {grouped.map(([pack, list]) => (
                <div key={pack}>
                  <div className="label" style={{ marginBottom: 6 }}>{pack} <span className="muted">· {list.length}{list[0]?.creator ? ` · by ${list[0].creator}` : ''}</span></div>
                  <div className="tags">
                    {list.map((t) => (
                      <span key={t.id} className="tag sims">{t.name}<button type="button" aria-label={`Delete ${t.name}`} onClick={() => deleteCustomTrait(t.id)}><Trash size={12} /></button></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {!guest && supabase && (
        <section className="card">
          <div className="card-head"><h2>Password</h2></div>
          <form className="row" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase!.auth.updateUser({ password: pw }); toast(error ? error.message : 'Password updated.'); if (!error) setPw(''); }}>
            <input className="input grow" type="password" minLength={8} autoComplete="new-password" aria-label="New password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn" disabled={pw.length < 8}>Change password</button>
          </form>
        </section>
      )}
      <p className="tiny muted" style={{ textAlign: 'center' }}>{APP.name} · {APP.domain} · Free plan</p>
    </div>
  );
}
