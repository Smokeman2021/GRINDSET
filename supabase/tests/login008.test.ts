// ТЗ 008, п. 1: вхід через Telegram. Запускається СПРАВЖНІЙ обробник Edge Function (supabase/functions/invite-login/index.ts —
// той самий файл, що розгорнуто на продакшні 02.11, звірено за SHA-256 18.11) з підписаними initData і підробленим клієнтом Supabase.
// Плюс те, що бачить людина на екрані входу (loginView) і імітація для веб-превʼю.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashInvite, normalizeInviteCode, sessionState } from '../../app-mvp/src/cloud/shared/access.ts';
import { loginReason, loginView } from '../../app-mvp/src/cloud/loginView.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = '123456:TEST-BOT-TOKEN';
const now = () => Math.floor(Date.now() / 1000);

// initData так, як його підписує Telegram (еталон на node:crypto, незалежний від коду застосунку)
function sign(userId: number, opts: { token?: string; authDate?: number; platform?: string; username?: string } = {}): string {
  const fields: Record<string, string> = {
    auth_date: String(opts.authDate ?? now() - 30),
    query_id: `AA${crypto.randomBytes(4).toString('hex')}`,
    user: JSON.stringify({ id: userId, first_name: 'Т', username: opts.username ?? `u${userId}` }),
  };
  if (opts.platform) fields.signature = opts.platform; // різні пристрої дають різні рядки initData
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(opts.token ?? TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', secret).update(check).digest('hex') }).toString();
}

// ───────── підроблений клієнт Supabase (лише ті виклики, які робить обробник) ─────────
type Row = Record<string, unknown> & { id: string };
let rows: Row[] = [];
let rpcLog: { name: string; args: Record<string, unknown> }[] = [];
let updates: { id: unknown; patch: Record<string, unknown> }[] = [];
const fakeAdmin = {
  from(table: string) {
    assert.equal(table, 'allowed_users');
    return {
      select() {
        const f: [string, unknown][] = [];
        const q = {
          eq(c: string, v: unknown) {
            f.push([c, v]);
            return q;
          },
          limit(n: number) {
            return Promise.resolve({ data: rows.filter((r) => f.every(([c, v]) => r[c] === v)).slice(0, n).map((r) => ({ ...r })), error: null });
          },
        };
        return q;
      },
      update(patch: Record<string, unknown>) {
        return {
          eq(c: string, v: unknown) {
            updates.push({ id: v, patch });
            const r = rows.find((x) => x[c] === v);
            if (r) Object.assign(r, patch);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  },
  rpc(name: string, args: Record<string, unknown>) {
    rpcLog.push({ name, args });
    return Promise.resolve({ data: true, error: null });
  },
  auth: {
    admin: {
      generateLink({ email }: { email: string }) {
        const id = `auth-${email.slice(1, email.indexOf('@'))}`;
        return Promise.resolve({ data: { properties: { hashed_token: `h-${id}` }, user: { id } }, error: null });
      },
    },
  },
};

const env: Record<string, string> = { SUPABASE_URL: 'http://local', SUPABASE_SERVICE_ROLE_KEY: 'test', TELEGRAM_BOT_TOKEN: TOKEN };
let handle: (r: Request) => Promise<Response>;
let tmp = '';

before(async () => {
  const src = fs.readFileSync(path.join(here, '..', 'functions', 'invite-login', 'index.ts'), 'utf8');
  const marker = "(await import('npm:@supabase/supabase-js@2'))";
  const tail = "if (typeof Deno !== 'undefined') Deno.serve(handle);";
  assert.ok(src.includes(marker) && src.includes(tail), 'обробник має очікуваний вигляд');
  (globalThis as Record<string, unknown>).__sbModule = { createClient: () => fakeAdmin };
  (globalThis as Record<string, unknown>).Deno = { env: { get: (k: string) => env[k] } };
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grindset-tg-'));
  const file = path.join(tmp, 'handler.mts');
  fs.writeFileSync(file, src.replace(marker, '((globalThis as any).__sbModule)').replace(tail, 'export { handle };'));
  handle = (await import(pathToFileURL(file).href)).handle;
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function seed() {
  const inv = async (id: string, username: string, code: string, extra: Record<string, unknown> = {}): Promise<Row> => ({
    id,
    username,
    status: 'active',
    is_admin: false,
    invite_salt: `s-${id}`,
    invite_hash: await hashInvite(`s-${id}`, normalizeInviteCode(code)),
    failed_attempts: 0,
    locked_until: null,
    auth_user_id: `auth-${id}`,
    telegram_id: null,
    active_sid: null,
    ...extra,
  });
  rows = [
    await inv('owner', 'owner_nick', 'OWNR-2222-3333', { is_admin: true, telegram_id: 1001 }),
    await inv('linked', 'linked_t', 'LNKD-4444-5555', { telegram_id: 2002 }),
    await inv('oldie', 'oldie', 'OLDI-6666-7777'), // стара учітка без Telegram ID
    await inv('oldie2', 'oldie2', 'OLDT-8888-9999'),
    await inv('blocked', 'blocked_b', 'BLKD-2345-6789', { status: 'blocked', telegram_id: 3003 }),
  ];
  rpcLog = [];
  updates = [];
}

const call = async (body: Record<string, unknown>) => {
  const res = await handle(new Request('http://local/invite-login', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.1' } }));
  return { status: res.status, body: (await res.json()) as { ok: boolean; reason?: string; sid?: string; token_hash?: string } };
};
const row = (id: string) => rows.find((r) => r.id === id)!;

test('перший і повторний вхід через бота: без коду, за Telegram ID; права адміна не змінюються; повторний вхід — новий сеанс', async () => {
  await seed();
  const first = await call({ initData: sign(1001) });
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.token_hash, 'h-auth-owner');
  assert.equal(row('owner').active_sid, first.body.sid);
  assert.equal(row('owner').is_admin, true);
  assert.equal(row('owner').telegram_id, 1001);
  // оновлення входу не чіпає ні прав, ні привʼязки
  for (const u of updates) assert.deepEqual(Object.keys(u.patch).sort(), ['active_sid', 'auth_user_id', 'last_login_at', 'status']);

  const again = await call({ initData: sign(1001) });
  assert.equal(again.body.ok, true);
  assert.notEqual(again.body.sid, first.body.sid);
  assert.deepEqual(rpcLog.filter((r) => r.name === 'revoke_user_sessions').map((r) => r.args.p_user), ['auth-owner', 'auth-owner'], 'старі сеанси скидаються');
});

test('телефон → Telegram Desktop: Desktop входить без коду, телефон отримує «вхід з іншого пристрою» і кнопку «Увійти через Telegram»', async () => {
  await seed();
  const phone = await call({ initData: sign(2002, { platform: 'ios' }) });
  const desktop = await call({ initData: sign(2002, { platform: 'tdesktop' }) });
  assert.equal(phone.body.ok && desktop.body.ok, true);
  assert.equal(sessionState(phone.body.sid, row('linked').active_sid as string), 'replaced');
  assert.equal(sessionState(desktop.body.sid, row('linked').active_sid as string), 'ok');
  // що бачить телефон: кнопка повторного входу без коду (не автоматично: інакше пристрої витісняли б один одного по колу)
  const v = loginView('replaced', null, null, true);
  assert.equal(v.tgButton, true);
  assert.match(v.text, /через Telegram/);
  // натиснув — повернувся на телефон, тепер Desktop «замінений»
  const back = await call({ initData: sign(2002, { platform: 'ios' }) });
  assert.equal(sessionState(desktop.body.sid, row('linked').active_sid as string), 'replaced');
  assert.equal(sessionState(back.body.sid, row('linked').active_sid as string), 'ok');
});

test('недійсні дані Telegram: підробка, чужий бот, застарілі, порожні — відмова, учітки не змінюються; клієнт показує окреме повідомлення', async () => {
  await seed();
  const before = JSON.stringify(rows);
  const good = sign(1001);
  const cases = [
    good.replace('1001', '2002'), // підмінено id у підписаних даних
    sign(1001, { token: '999:OTHER-BOT' }),
    sign(1001, { authDate: now() - 25 * 3600 }), // старші за добу
    sign(1001, { authDate: now() + 3 * 3600 }), // з майбутнього
    'user=%7B%22id%22%3A1001%7D&auth_date=1&hash=abc',
    'зовсім не initData',
  ];
  for (const initData of cases) {
    const r = await call({ initData });
    assert.deepEqual([r.status, r.body], [403, { ok: false, reason: 'wrong' }], initData.slice(0, 40));
  }
  assert.equal(JSON.stringify(rows), before);
  assert.equal(rpcLog.filter((r) => r.name === 'revoke_user_sessions').length, 0);
  // клієнт: 'wrong' на вхід лише через Telegram → tg_invalid; на код-вхід лишається 'wrong'
  assert.equal(loginReason({ initData: 'x' }, 'wrong'), 'tg_invalid');
  assert.equal(loginReason({ username: 'a', code: 'b', initData: 'x' }, 'wrong'), 'wrong');
  assert.equal(loginReason({ initData: 'x' }, 'not_linked'), 'not_linked');
  const v = loginView('signedOut', 'tg_invalid', null, true);
  assert.equal(v.title, 'Не вдалося підтвердити Telegram');
  assert.equal(v.tgButton, true);
  assert.equal(v.form, true);
  assert.equal(v.error, null);
});

test('без доступу: Telegram не привʼязаний → not_linked і зрозуміле пояснення; заблокований → blocked; без токена бота → error', async () => {
  await seed();
  const stranger = await call({ initData: sign(4242, { username: 'stranger' }) });
  assert.deepEqual([stranger.status, stranger.body], [403, { ok: false, reason: 'not_linked' }]);
  const v = loginView('signedOut', 'not_linked', null, true);
  assert.match(v.text, /Якщо запрошення немає, доступ закритий/);
  assert.match(v.text, /один раз введи свій @нік і персональний код/);
  assert.equal(v.form, true);

  const blocked = await call({ initData: sign(3003) });
  assert.deepEqual([blocked.status, blocked.body], [403, { ok: false, reason: 'blocked' }]);
  assert.equal(row('blocked').active_sid, null);

  env.TELEGRAM_BOT_TOKEN = '';
  try {
    const off = await call({ initData: sign(1001) });
    assert.deepEqual([off.status, off.body], [503, { ok: false, reason: 'error' }]);
  } finally {
    env.TELEGRAM_BOT_TOKEN = TOKEN;
  }
});

test('збіг ніка нічого не дає: Telegram-нік = нік учітки без коду → not_linked; з хибним кодом → wrong і без привʼязки', async () => {
  await seed();
  const sameNick = await call({ initData: sign(5005, { username: 'oldie' }) });
  assert.equal(sameNick.body.reason, 'not_linked');
  const nickOnly = await call({ username: 'oldie', initData: sign(5005, { username: 'oldie' }) });
  assert.equal(nickOnly.body.reason, 'not_linked', 'нік без коду = вхід лише через Telegram');
  const wrongCode = await call({ username: 'oldie', code: 'AAAA-BBBB-CCCC', initData: sign(5005, { username: 'oldie' }) });
  assert.equal(wrongCode.body.reason, 'wrong');
  assert.equal(row('oldie').telegram_id, null);
  assert.equal(row('oldie').active_sid, null);
});

test('стара учітка без Telegram ID: одноразова привʼязка лише з правильним кодом і дійсним підписом; далі вхід без коду', async () => {
  await seed();
  // правильний код, але підпис недійсний — вхід є, привʼязки немає
  const badSig = await call({ username: '@Oldie', code: 'oldi-6666-7777', initData: sign(5005, { token: '1:x' }) });
  assert.equal(badSig.body.ok, true);
  assert.equal(row('oldie').telegram_id, null);
  // правильний код + дійсний підпис — привʼязка
  const link = await call({ username: 'oldie', code: 'OLDI-6666-7777', initData: sign(5005) });
  assert.equal(link.body.ok, true);
  assert.equal(row('oldie').telegram_id, 5005);
  assert.equal(row('oldie').is_admin, false);
  // далі — без коду
  const auto = await call({ initData: sign(5005) });
  assert.equal(auto.body.ok, true);
  assert.equal(row('oldie').active_sid, auto.body.sid);
});

test('привʼязка не перезаписується: чужий зайнятий Telegram ID не забирається; привʼязана учітка не перепривʼязується', async () => {
  await seed();
  const taken = await call({ username: 'oldie2', code: 'OLDT-8888-9999', initData: sign(2002) }); // 2002 належить linked_t
  assert.equal(taken.body.ok, true);
  assert.equal(row('oldie2').telegram_id, null);
  assert.equal(row('linked').telegram_id, 2002);
  const relink = await call({ username: 'owner_nick', code: 'OWNR-2222-3333', initData: sign(6006) });
  assert.equal(relink.body.ok, true);
  assert.equal(row('owner').telegram_id, 1001);
  assert.equal(row('owner').is_admin, true);
});

test('імітація (веб-превʼю) поводиться як сервер: недійсний підпис → wrong; службова учітка поза рейтингом', () => {
  const mock = fs.readFileSync(path.join(here, '..', '..', 'app-mvp', 'src', 'cloud', 'mockBackend.ts'), 'utf8');
  assert.match(mock, /if \(!tgId\) return \{ ok: false, reason: 'wrong' \}/);
  assert.match(mock, /db\.allowed\.filter\(\(r\) => !r\.is_service\)/);
  assert.match(mock, /username: 'preview_check'[^\n]*service: true/);
  // екран входу бере тексти лише з loginView (одне джерело для тестів і застосунку)
  const screen = fs.readFileSync(path.join(here, '..', '..', 'app-mvp', 'app', 'login.tsx'), 'utf8');
  assert.match(screen, /loginView\(status, reason, detail, isTelegram\(\)\)/);
  assert.doesNotMatch(screen, /Нік або код не збігаються/);
});

test('перезавантаження всередині Mini App (оновлення збірки) без tgWebAppData в адресі: Telegram-скрипт вантажиться за збереженими параметрами', () => {
  const html = fs.readFileSync(path.join(here, '..', '..', 'app-mvp', 'public', 'index.html'), 'utf8');
  const gate = /<script>([\s\S]*?telegram-web-app\.js[\s\S]*?)<\/script>\s*<style/.exec(html)![1];
  const decide = (hash: string, ua: string, saved: string | null) => {
    let loaded = false;
    const location = { hash, search: '' };
    const navigator = { userAgent: ua };
    const sessionStorage = { getItem: (k: string) => (k === '__telegram__initParams' ? saved : null) };
    const document = { write: (s: string) => (loaded = s.includes('telegram-web-app.js')) };
    new Function('location', 'navigator', 'sessionStorage', 'document', gate)(location, navigator, sessionStorage, document);
    return loaded;
  };
  assert.equal(decide('#tgWebAppData=x', 'Mozilla', null), true, 'перший запуск з бота');
  assert.equal(decide('', 'Mozilla', '{"tgWebAppData":"x"}'), true, 'перезавантаження після переходу між екранами');
  assert.equal(decide('', 'Mozilla', null), false, 'звичайний браузер — без зовнішнього скрипта');
});

test('екран входу: стани без Telegram не показують кнопку Telegram; завантаження у Mini App — «Входимо через Telegram»', () => {
  for (const [s, r] of [['replaced', null], ['signedOut', 'tg_invalid'], ['signedOut', 'error']] as const) assert.equal(loginView(s, r, null, false).tgButton, false, `${s}/${r}`);
  assert.equal(loginView('loading', null, null, true).title, 'Входимо через Telegram');
  assert.equal(loginView('loading', null, null, true).form, false);
  assert.equal(loginView('denied', 'blocked', null, true).form, false);
  assert.equal(loginView('signedOut', 'wrong', { attemptsLeft: 2 }, true).error, 'Нік або код не збігаються. Лишилось спроб: 2.');
  assert.equal(loginView('signedOut', 'wrong', null, true).tgButton, false, 'хибний код — кнопка Telegram не потрібна');
});
