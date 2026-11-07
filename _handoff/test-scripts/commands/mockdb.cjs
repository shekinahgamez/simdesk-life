// A stand-in Supabase that remembers saves, records and drafts (for Playwright tests).
const SB = 'https://pyszlcaaotkituvvpvvw.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', email: 'nia@example.com' })}.sig`;
const USER = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'nia@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
function newState() { return { saves: {}, records: {}, drafts: {}, profile: { user_id: 'u1', username: 'NiaPlays', plan: 'free' }, account: null, photos: {}, files: {}, photoLimit: 100, calls: [], offline: false }; }
async function mock(page, st) {
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    const body = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return {}; } })() : {};
    const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
    const reply = (status, json, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...H, ...extra }, body: JSON.stringify(json) });
    if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: H });
    if (st.offline) return route.abort('internetdisconnected');
    st.calls.push(`${m} ${url.replace(SB, '')}`);
    if (url.includes('/functions/v1/login')) return body.password === 'correct-horse-1' ? reply(200, { access_token: jwt('u1'), refresh_token: 'r1' }) : reply(400, { error: 'invalid_credentials' });
    if (url.includes('/auth/v1/user')) return reply(200, USER);
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, headers: H });
    if (url.includes('/rest/v1/profiles')) return reply(200, st.profile);
    if (url.includes('/rest/v1/rpc/push_save')) {
      const cur = st.saves[body.p_id];
      const row = { id: body.p_id, data: body.p_data, edited_at: body.p_edited_at, deleted_at: body.p_deleted_at, created_at: cur?.created_at ?? new Date().toISOString() };
      if (!cur || Date.parse(cur.edited_at) <= Date.parse(row.edited_at)) st.saves[body.p_id] = row;
      return reply(200, st.saves[body.p_id]);
    }
    if (url.includes('/rest/v1/rpc/push_records')) {
      const map = (st.records[body.p_save] ??= {});
      for (const it of body.p_items) { const c = map[it.id]; if (!c || Date.parse(c.edited_at) <= Date.parse(it.edited_at)) map[it.id] = it; }
      return reply(200, body.p_items.map((i) => map[i.id]));
    }
    if (url.includes('/rest/v1/saves')) {
      if (m === 'GET') return reply(200, Object.values(st.saves));
      if (m === 'DELETE') { const id = new URL(url).searchParams.get('id')?.replace('eq.', ''); delete st.saves[id]; return reply(200, []); }
    }
    if (url.includes('/rest/v1/records')) {
      const sid = new URL(url).searchParams.get('save_id')?.replace('eq.', '');
      if (m === 'GET') return reply(200, Object.values(st.records[sid] ?? {}));
      return reply(200, []);
    }
    if (url.includes('/rest/v1/account_docs')) return reply(200, st.account);
    if (url.includes('/rest/v1/rpc/push_account')) {
      const row = { data: body.p_data, edited_at: body.p_edited_at };
      if (!st.account || Date.parse(st.account.edited_at) <= Date.parse(row.edited_at)) st.account = row;
      return reply(200, st.account);
    }
    if (url.includes('/rest/v1/rpc/photo_usage')) return reply(200, { used: Object.keys(st.photos).length, limit: st.photoLimit });
    if (url.includes('/rest/v1/photos')) {
      if (m === 'POST') {
        if (Object.keys(st.photos).length >= st.photoLimit) return reply(400, { code: 'P0001', message: 'photo_limit' });
        const rows = Array.isArray(body) ? body : [body]; for (const r of rows) st.photos[r.id] = r; return reply(201, []);
      }
      if (m === 'DELETE') { const q = new URL(url).searchParams.get('id') ?? ''; const ids = q.replace(/^in\.\(|\)$/g, '').replace(/^eq\./, '').split(',').map((x) => x.replace(/"/g, '')); for (const id of ids) delete st.photos[id]; return reply(200, []); }
      if (m === 'GET') return reply(200, Object.values(st.photos));
    }
    if (url.includes('/storage/v1/object/list/photos')) {
      const search = body.search ?? ''; const prefix = body.prefix ?? '';
      return reply(200, Object.keys(st.files).filter((k) => k.startsWith(prefix + '/') && k.includes(search)).map((k) => ({ name: k.slice(prefix.length + 1) })));
    }
    if (url.includes('/storage/v1/object/sign/photos/')) {
      const path = decodeURIComponent(url.split('/storage/v1/object/sign/photos/')[1].split('?')[0]);
      if (m === 'POST') return st.files[path] ? reply(200, { signedURL: `/object/sign/photos/${path}?token=t` }) : reply(400, { message: 'Object not found' });
      const f = st.files[path];
      return f ? route.fulfill({ status: 200, headers: { ...H, 'content-type': f.type }, body: f.data }) : reply(404, { message: 'not found' });
    }
    if (url.includes('/storage/v1/object/photos')) {
      if (m === 'DELETE') { for (const k of body.prefixes ?? []) delete st.files[k]; return reply(200, []); }
      const path = decodeURIComponent(url.split('/storage/v1/object/photos/')[1].split('?')[0]);
      let data = req.postDataBuffer(); let type = req.headers()['content-type'] || 'image/webp';
      const mb = /multipart\/form-data; boundary=(.+)$/.exec(type);
      if (mb) {
        // Pull the file out of the form upload.
        const parts = data.toString('latin1').split('--' + mb[1]);
        const file = parts.find((x) => /content-type: image\//i.test(x));
        const head = file.slice(0, file.indexOf('\r\n\r\n'));
        type = /content-type: ([^\r\n]+)/i.exec(head)[1];
        data = Buffer.from(file.slice(file.indexOf('\r\n\r\n') + 4, file.lastIndexOf('\r\n')), 'latin1');
      }
      st.files[path] = { data, type };
      return reply(200, { Key: `photos/${path}` });
    }
    if (url.includes('/rest/v1/drafts')) {
      if (m === 'GET') return reply(200, Object.values(st.drafts));
      if (m === 'POST') { const rows = Array.isArray(body) ? body : [body]; for (const r of rows) st.drafts[r.key] = r; return reply(201, []); }
      return reply(200, []);
    }
    return reply(404, { message: 'not mocked ' + url });
  });
}
async function logIn(page) {
  await page.goto('http://localhost:'+(process.env.PORT||4173)+'/');
  await page.getByRole('button', { name: 'Log in', exact: true }).first().click();
  await page.getByLabel('Username or email').fill('NiaPlays');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-1');
  await page.getByRole('button', { name: 'Log in', exact: true }).last().click();
}
module.exports = { mock, newState, logIn };
