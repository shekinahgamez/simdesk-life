import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react';
import { APP } from '../config/app';
import { Sparkle, Wordmark } from '../components/brand';
import { ObjIcon, DECK } from '../components/categories';
import { PasswordInput } from '../components/PasswordInput';
import { useIsPhone } from '../lib/useIsPhone';
import {
  AuthError, logIn, MIN_PASSWORD, sendReset, signUp, usernameAvailable, USERNAME_RE, USERNAME_RULES,
} from '../lib/auth';

type Mode = 'signup' | 'login' | 'reset';
const HEADINGS: Record<Mode, string> = { signup: 'Make your account', login: 'Welcome back', reset: 'Reset your password' };

/** The brand side plus a card. Used by every account screen. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const phone = useIsPhone();
  return (
    <main className="auth">
      <div className="auth-brand">
        <Wordmark size={phone ? 40 : 64} />
        <p className="auth-tag">{APP.tagline}</p>
        <div className="auth-pills">
          {DECK.map((c) => (
            <span key={c.id} className={`tag pill-lg ${c.id}`} title={c.label}>
              <ObjIcon cat={c.id} /> <span className="auth-pill-label">{c.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-card-head">
          <h1>{title}</h1>
          <Sparkle size={22} />
        </div>
        {children}
      </div>
    </main>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return <div className="form-error" role="alert">{children}</div>;
}

/** Checks the username while typing (after a short pause). */
export function useUsernameCheck(name: string) {
  const [state, setState] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'error'>('idle');
  const latest = useRef(name);
  useEffect(() => {
    latest.current = name;
    if (!name) return setState('idle');
    if (!USERNAME_RE.test(name)) return setState('invalid');
    setState('checking');
    const t = setTimeout(() => {
      usernameAvailable(name)
        .then((ok) => latest.current === name && setState(ok ? 'free' : 'taken'))
        .catch(() => latest.current === name && setState('error'));
    }, 400);
    return () => clearTimeout(t);
  }, [name]);
  return state;
}

const CANT_CHECK = 'Can’t check usernames right now. SimDesk can’t be reached. Check your internet and try again.';

export function UsernameHint({ id, state }: { id: string; state: ReturnType<typeof useUsernameCheck> }) {
  if (state === 'free') return <div id={id} className="hint ok"><CheckCircle size={14} weight="fill" /> Available</div>;
  if (state === 'taken') return <div id={id} className="hint bad">That username is taken. Try another.</div>;
  if (state === 'invalid') return <div id={id} className="hint bad">{USERNAME_RULES}</div>;
  if (state === 'checking') return <div id={id} className="hint">Checking…</div>;
  if (state === 'error') return <div id={id} className="hint bad">{CANT_CHECK}</div>;
  return <div id={id} className="hint">{USERNAME_RULES}</div>;
}

export function Auth({ confirmed, startLogin }: { confirmed?: boolean; startLogin?: boolean }) {
  const [mode, setMode] = useState<Mode>(confirmed || startLogin ? 'login' : 'signup');
  const [username, setUsername] = useState('');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [done, setDone] = useState<'' | 'signup' | 'reset'>('');
  const ids = { u: useId(), uh: useId(), l: useId(), e: useId(), p: useId(), ph: useId(), c: useId(), ch: useId() };
  const check = useUsernameCheck(mode === 'signup' ? username : '');

  const switchTo = (m: Mode) => {
    setMode(m);
    setError('');
    setEmailTaken(false);
    setPassword('');
    setConfirm('');
    setConfirmTouched(false);
  };

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirmTouched && confirm !== password;
  const canSignUp = check === 'free' && email.trim() !== '' && password.length >= MIN_PASSWORD && confirm === password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailTaken(false);
    if (mode === 'signup' && !canSignUp) {
      setConfirmTouched(true);
      if (check === 'taken') return setError('That username is taken. Try another.');
      if (check === 'error') return setError(CANT_CHECK);
      if (check === 'checking') return setError('One sec, still checking that username.');
      if (check !== 'free') return setError(`Pick a username: ${USERNAME_RULES}`);
      if (password.length < MIN_PASSWORD) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
      if (confirm !== password) return setError('Passwords don’t match.');
      return setError('Fill in every box.');
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(username, email.trim(), password);
        setDone('signup');
      } else if (mode === 'login') {
        await logIn(login, password);
      } else {
        await sendReset(email);
        setDone('reset');
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Try again?');
      setEmailTaken(err instanceof AuthError && err.code === 'email_taken');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={done === 'signup' ? 'Check your email' : 'Check your email'}>
        <div className="auth-done">
          <span className="obj lg berry"><EnvelopeSimple size={24} weight="duotone" /></span>
          {done === 'signup' ? (
            <p>We sent a link to <b>{email.trim()}</b>. Tap it to confirm your account, then come back and log in.</p>
          ) : (
            <p>If <b>{email.trim()}</b> has an account, a reset link is on its way.</p>
          )}
          <p className="muted small">It can take a minute. Check your spam folder too.</p>
          <button type="button" className="btn lg auth-wide" onClick={() => { setDone(''); switchTo('login'); }}>Back to log in</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={HEADINGS[mode]}>
      {confirmed && mode === 'login' && <div className="form-ok" role="status"><CheckCircle size={18} weight="fill" /> Your email is confirmed. Log in to start.</div>}
      <form className="auth-form" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor={ids.u}>Username</label>
            <input id={ids.u} className="input" value={username} onChange={(e) => setUsername(e.target.value.trim())}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30}
              aria-describedby={ids.uh} aria-invalid={check === 'taken' || check === 'invalid' || undefined} />
            <UsernameHint id={ids.uh} state={check} />
          </div>
        )}
        {mode === 'login' ? (
          <div className="field">
            <label htmlFor={ids.l}>Username or email</label>
            <input id={ids.l} className="input" value={login} onChange={(e) => setLogin(e.target.value)}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor={ids.e}>Email</label>
            <input id={ids.e} className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
        )}
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor={ids.p}>Password</label>
            <PasswordInput id={ids.p} value={password} onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              invalid={mode === 'signup' && tooShort} describedBy={mode === 'signup' ? ids.ph : undefined} />
            {mode === 'signup' && (
              <div id={ids.ph} className={`hint ${password.length >= MIN_PASSWORD ? 'ok' : ''}`}>
                {password.length >= MIN_PASSWORD ? <><CheckCircle size={14} weight="fill" /> Long enough</> : `At least ${MIN_PASSWORD} characters.`}
              </div>
            )}
          </div>
        )}
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor={ids.c}>Confirm password</label>
            <PasswordInput id={ids.c} value={confirm} onChange={(v) => { setConfirm(v); if (v.length >= password.length) setConfirmTouched(true); }}
              autoComplete="new-password" invalid={mismatch} describedBy={ids.ch} />
            <div id={ids.ch} className={`hint ${mismatch ? 'bad' : confirm && confirm === password ? 'ok' : ''}`}>
              {mismatch ? 'Passwords don’t match.' : confirm && confirm === password ? <><CheckCircle size={14} weight="fill" /> Matches</> : 'Type it again.'}
            </div>
          </div>
        )}
        {error && <FormError>{error}</FormError>}
        {emailTaken && (
          <div className="row">
            <button type="button" className="btn" onClick={() => { const em = email.trim(); switchTo('login'); setLogin(em); }}>Log in</button>
            <button type="button" className="btn" onClick={() => switchTo('reset')}>Reset your password</button>
          </div>
        )}
        <button type="submit" className="btn primary lg auth-wide" disabled={busy}>
          {busy ? 'One sec…' : mode === 'signup' ? 'Sign up' : mode === 'login' ? 'Log in' : 'Send reset link'}
        </button>
        {mode === 'login' && <button type="button" className="btn ghost auth-link" onClick={() => switchTo('reset')}>Forgot password?</button>}
        {mode === 'reset' && <button type="button" className="btn ghost auth-link" onClick={() => switchTo('login')}>Back to log in</button>}
        {mode === 'signup' && <p className="auth-swap">Already have an account? <button type="button" className="auth-swap-btn" onClick={() => switchTo('login')}>Log in</button></p>}
        {mode === 'login' && <p className="auth-swap">New to SimDesk? <button type="button" className="auth-swap-btn" onClick={() => switchTo('signup')}>Sign up</button></p>}
      </form>
    </AuthShell>
  );
}
