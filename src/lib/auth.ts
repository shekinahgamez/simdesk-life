import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { SUPABASE } from '../config/supabase';

/** Rules shared by the sign-up form, the username change form and the database. */
export const USERNAME_RE = /^[A-Za-z0-9._]{3,30}$/;
export const USERNAME_RULES = '3–30 letters, numbers, periods or underscores. No spaces.';
export const MIN_PASSWORD = 10;

export type Profile = { user_id: string; username: string; plan: string };

/** Error messages in SimDesk's own words. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That username, email or password doesn’t match. Try again?',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link we sent.',
  rate_limited: 'Too many tries just now. Wait a minute, then try again.',
  email_rate_limited: 'We’ve sent a lot of emails in the last hour. Try again a bit later.',
  email_taken: 'There’s already an account with that email. Log in or reset your password.',
  username_taken: 'That username is taken. Try another.',
  username_change_limit: 'You’ve changed your username twice in the last 14 days.',
  weak_password: `Pick a stronger password, at least ${MIN_PASSWORD} characters.`,
  bad_email: 'That email address doesn’t look right.',
  same_password: 'That’s your current password. Pick a new one.',
  offline: 'Can’t reach SimDesk right now. Check your connection and try again.',
  unknown: 'Something went wrong. Try again?',
};
export const message = (code: string) => MESSAGES[code] ?? MESSAGES.unknown;

export class AuthError extends Error {
  constructor(public code: string) {
    super(message(code));
  }
}

function codeFor(e: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!e) return 'unknown';
  const c = e.code ?? '';
  const m = (e.message ?? '').toLowerCase();
  if (c === 'invalid_credentials') return 'invalid_credentials';
  if (c === 'email_not_confirmed') return 'email_not_confirmed';
  if (c === 'over_email_send_rate_limit') return 'email_rate_limited';
  if (c === 'over_request_rate_limit' || e.status === 429) return 'rate_limited';
  if (c === 'user_already_exists' || c === 'email_exists') return 'email_taken';
  if (c === 'weak_password') return 'weak_password';
  if (c === 'email_address_invalid' || c === 'validation_failed') return 'bad_email';
  if (c === 'same_password') return 'same_password';
  if (c === '23505' || m.includes('duplicate') || m.includes('database error saving new user')) return 'username_taken';
  if (m.includes('username_change_limit')) return 'username_change_limit';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'offline';
  return 'unknown';
}
const fail = (e: unknown): never => {
  throw new AuthError(codeFor(e as never));
};

/** Where the confirmation and reset links in emails send people back to. */
const backHere = () => `${location.origin}${location.pathname}`;

export async function usernameAvailable(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { name });
  if (error) fail(error);
  return data === true;
}

export async function signUp(username: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: backHere() },
  });
  if (error) fail(error);
  // Supabase doesn't create a second account or send an email when the address is already confirmed;
  // it answers with a user that has no identities. Tell the player instead of leaving them waiting.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new AuthError('email_taken');
}

/** Log in with a username or an email. */
export async function logIn(login: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE.url}/functions/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE.publishableKey },
      body: JSON.stringify({ login: login.trim(), password }),
    });
  } catch {
    throw new AuthError('offline');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new AuthError(body.error ?? 'unknown');
  const { error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  if (error) fail(error);
}

export async function sendReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: backHere() });
  if (error) fail(error);
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error);
}

export async function logOut() {
  await supabase.auth.signOut();
}

export async function loadProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('user_id, username, plan').maybeSingle();
  if (error) fail(error);
  return data;
}

export async function claimUsername(name: string) {
  const { error } = await supabase.rpc('claim_username', { name });
  if (error) fail(error);
}

/** The last two username changes, newest first. Used to work out when the next change is allowed. */
export async function recentUsernameChanges(): Promise<Date[]> {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const { data, error } = await supabase
    .from('username_changes').select('changed_at').gt('changed_at', since).order('changed_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((r) => new Date(r.changed_at));
}

/** Two changes in 14 days: the next one opens 14 days after the older of the two. */
export function nextUsernameChange(recent: Date[]): Date | null {
  if (recent.length < 2) return null;
  return new Date(recent[1].getTime() + 14 * 864e5);
}

export async function changeUsername(userId: string, name: string) {
  const { error } = await supabase.from('profiles').update({ username: name }).eq('user_id', userId);
  if (error) fail(error);
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; confirmed?: boolean }
  | { status: 'recovery'; session: Session }
  | { status: 'signed-in'; session: Session };

/** Who's signed in, kept up to date. Also notices when a password-reset link was opened. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => {
    const fromLink = new URLSearchParams(location.search);
    const linkError = fromLink.get('error_code');
    const cameFromLink = fromLink.has('code') || !!linkError;
    const clean = () => cameFromLink && history.replaceState(null, '', location.pathname + location.hash);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setState({ status: 'recovery', session });
      else if (session) setState((s) => (s.status === 'recovery' && event !== 'SIGNED_OUT' ? { status: 'recovery', session } : { status: 'signed-in', session }));
      else if (event !== 'INITIAL_SESSION' || !cameFromLink) setState({ status: 'signed-out' });
    });
    supabase.auth.getSession().then(({ data }) => {
      clean();
      // Opened the confirmation link on a different device: the email is confirmed, they just log in here.
      if (!data.session) setState({ status: 'signed-out', confirmed: cameFromLink && !linkError ? true : undefined });
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
