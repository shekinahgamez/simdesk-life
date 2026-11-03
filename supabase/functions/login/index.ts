// Log in with a username OR an email, plus password.
// For a username, the email is looked up here on the server, so it is never sent to anyone's browser.
// Returns the same session Supabase gives for a normal email log-in, or a plain error code.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let login = '', password = '';
  try {
    const b = await req.json();
    login = String(b.login ?? '').trim();
    password = String(b.password ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!login || !password) return json({ error: 'bad_request' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });

  let email = login;
  if (!login.includes('@')) {
    // Username: find the account's email.
    const { data: prof } = await admin.from('profiles').select('user_id').ilike('username', login.replace(/[%_\\]/g, '\\$&')).maybeSingle();
    if (!prof) return json({ error: 'invalid_credentials' }, 400); // same answer as a wrong password
    const { data: u, error } = await admin.auth.admin.getUserById(prof.user_id);
    if (error || !u.user?.email) return json({ error: 'invalid_credentials' }, 400);
    email = u.user.email;
  }

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'email_not_confirmed') return json({ error: 'email_not_confirmed' }, 400);
    if (code === 'over_request_rate_limit' || error.status === 429) return json({ error: 'rate_limited' }, 429);
    return json({ error: 'invalid_credentials' }, 400);
  }
  return json({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token });
});
