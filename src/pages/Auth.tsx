import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import { APP } from '../config/app';
import { Sparkle, Wordmark } from '../components/brand';
import { CATEGORIES } from '../components/categories';
import { Field, Seg } from '../components/ui';

export function AuthPage() {
  const startGuest = useStore((s) => s.startGuest);
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } });
        if (error) throw error;
        if (!data.session) setMsg({ kind: 'ok', text: `Check your email to confirm your account, then come back and log in.` });
      } else if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'If that email has an account, a reset link is on its way.' });
      }
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong. Try again?' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 940, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, alignItems: 'center' }}>
        <div className="stack" style={{ gap: 18 }}>
          <Wordmark size={64} />
          <p style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', margin: '-12px 0 0', color: 'var(--muted)' }}>
            {APP.tagline}
          </p>
          <div className="row" style={{ gap: 8 }}>
            {CATEGORIES.filter((c) => !c.module && c.id !== 'clubs').map((c) => (
              <span key={c.id} className={`tag ${c.id} pill-lg`}>
                <c.icon size={15} weight="duotone" color={`var(--${c.id}-ink)`} aria-hidden="true" />
                {c.id === 'worlds' ? 'Worlds' : c.label /* one word per pill on this page only */}
              </span>
            ))}
          </div>
        </div>

        <form className="card" style={{ padding: 28, borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow)' }} onSubmit={submit}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
            <h1 style={{ fontSize: 24 }}>{mode === 'up' ? 'Make your account' : mode === 'in' ? 'Welcome back' : 'Reset your password'}</h1>
            <Sparkle size={22} />
          </div>
          {!supabase ? (
            <p className="small muted">Accounts aren’t set up on this copy of {APP.name} yet. You can still try it on this device.</p>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              {mode !== 'reset' && (
                <Seg label="Account" value={mode} onChange={(v) => { setMode(v); setMsg(null); }} options={[{ v: 'up', label: 'Sign up' }, { v: 'in', label: 'Log in' }]} />
              )}
              <Field label="Email">
                {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              {mode !== 'reset' && (
                <Field label="Password" hint={mode === 'up' ? 'At least 8 characters.' : undefined}>
                  {(id) => (
                    <input id={id} className="input" type="password" minLength={mode === 'up' ? 8 : undefined} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required value={pw} onChange={(e) => setPw(e.target.value)} />
                  )}
                </Field>
              )}
              {msg && (
                <div className="small" role="alert" style={{ padding: '10px 12px', borderRadius: 10, background: msg.kind === 'ok' ? 'var(--worlds-tint)' : 'var(--sims-tint)' }}>
                  {msg.text}
                </div>
              )}
              <button className="btn primary lg" disabled={busy}>
                {busy ? 'One sec…' : mode === 'up' ? 'Sign up' : mode === 'in' ? 'Log in' : 'Send reset link'}
              </button>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                {mode === 'in' && <button type="button" className="btn ghost sm" onClick={() => setMode('reset')}>Forgot password?</button>}
                {mode === 'reset' && <button type="button" className="btn ghost sm" onClick={() => setMode('in')}>Back to log in</button>}
              </div>
            </div>
          )}
          <div className="divider" />
          <button type="button" className="btn ghost" style={{ width: '100%' }} onClick={() => void startGuest()}>
            Try it without an account
          </button>
          <p className="tiny muted" style={{ textAlign: 'center', margin: '6px 0 0' }}>Guest saves stay on this device only.</p>
        </form>
      </div>
    </div>
  );
}
