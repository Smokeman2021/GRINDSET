// ───────── Обробник Edge Function (Deno). Чиста логіка вище підставляється скриптом scripts/build-edge-function.mjs ─────────
// Два способи входу в одній функції (код-вхід лишається як був):
//  1) @нік + персональний код: { username, code } (+ необов'язково initData: тоді Telegram-акаунт привʼязується до тестера);
//  2) Telegram Mini App: { initData }: підпис перевіряється токеном бота; вхід без коду лише для вже привʼязаного telegram_id.
//     Привʼязка робиться ОДИН раз і лише разом з правильним кодом, тому чужий збіг ніка нічого не дає.
// Секрети: SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY Supabase додає сам. Для входу через Telegram додай секрет TELEGRAM_BOT_TOKEN
// (Edge Functions → Secrets). Без нього Telegram-вхід вимкнений, код-вхід працює як раніше.
// Verify JWT для функції ВИМКНЕНО (її викликають до входу): захист це код / підпис Telegram, ліміт спроб на нік (5 → блок на 15 хв)
// і ліміт спроб з однієї адреси (30 за 10 хв).

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Спільне закінчення обох способів входу: один активний сеанс + одноразове посилання для обміну на сесію Supabase
// deno-lint-ignore no-explicit-any
async function startSession(admin: any, r: { id: string; auth_user_id?: string | null }, extra: Record<string, unknown> = {}): Promise<Response> {
  // 1. Скидаємо всі старі сеанси цього користувача (один активний сеанс)
  if (r.auth_user_id) await admin.rpc('revoke_user_sessions', { p_user: r.auth_user_id });

  // 2. Одноразове посилання для входу (створює користувача Supabase при першому вході); клієнт обміняє token_hash на сесію
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: `u${r.id}@invite.invalid` });
  const hashed = link?.data?.properties?.hashed_token as string | undefined;
  const authId = link?.data?.user?.id as string | undefined;
  if (link?.error || !hashed || !authId) return reply({ ok: false, reason: 'error' }, 500);

  // 3. Новий активний сеанс; перший вхід: invited → active (blocked сюди не доходить)
  const sid = newSid();
  const upd = await admin
    .from('allowed_users')
    .update({ active_sid: sid, last_login_at: new Date().toISOString(), auth_user_id: authId, status: 'active', ...extra })
    .eq('id', r.id);
  if (upd.error) return reply({ ok: false, reason: 'error' }, 500);

  return reply({ ok: true, token_hash: hashed, sid });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ ok: false, reason: 'error' }, 405);

  let body: { username?: unknown; code?: unknown; initData?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, reason: 'error' }, 400);
  }
  const username = normalizeUsername(typeof body.username === 'string' ? body.username : '');
  const code = typeof body.code === 'string' ? body.code : '';
  const initData = typeof body.initData === 'string' ? body.initData : '';
  const codeLogin = !!(username && code);
  if (!codeLogin && !initData) return reply({ ok: false, reason: 'wrong' }, 400);
  if (username.length > 64 || code.length > 40) return reply({ ok: false, reason: 'wrong' }, 400);

  try {
    // deno-lint-ignore no-explicit-any
    const { createClient } = (await import('npm:@supabase/supabase-js@2')) as any;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // 1. Ліміт спроб з однієї адреси
    const ip = req.headers.get('cf-connecting-ip') ?? (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ?? '';
    const hit = await admin.rpc('throttle_hit', { p_key: `ip:${ip || 'unknown'}`, p_limit: 30, p_window_seconds: 600 });
    if (hit.data === false) return reply({ ok: false, reason: 'too_many' }, 429);

    // 2. Telegram: перевіряємо підпис initData (якщо токен бота налаштовано)
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const tg = initData && botToken ? await verifyInitData(initData, botToken, Math.floor(Date.now() / 1000)) : null;

    if (!codeLogin) {
      // Вхід лише через Telegram
      if (!botToken) return reply({ ok: false, reason: 'error' }, 503);
      if (!tg || !tg.ok) return reply({ ok: false, reason: 'wrong' }, 403);
      const q = await admin.from('allowed_users').select('*').eq('telegram_id', tg.user.id).limit(1);
      const row = (q.data?.[0] ?? null) as { id: string; status: string; auth_user_id?: string | null } | null;
      if (!row) return reply({ ok: false, reason: 'not_linked' }, 403); // Telegram ще не привʼязано: клієнт покаже форму коду
      if (row.status === 'blocked') return reply({ ok: false, reason: 'blocked' }, 403);
      return await startSession(admin, row);
    }

    // 3. Код-вхід (ліміт спроб на нік усередині checkInvite)
    const q = await admin.from('allowed_users').select('*').eq('username', username).limit(1);
    const row = (q.data?.[0] ?? null) as (InviteRow & { auth_user_id?: string | null; telegram_id?: number | null }) | null;
    const verdict = await checkInvite(row, code, Date.now());
    if (row && verdict.patch) await admin.from('allowed_users').update(verdict.patch).eq('id', row.id);
    if (!verdict.ok) {
      return reply({ ok: false, reason: verdict.reason, attemptsLeft: verdict.attemptsLeft, lockedSeconds: verdict.lockedSeconds }, verdict.reason === 'locked' ? 429 : 403);
    }
    const r = row!;

    // 4. Правильний код + дійсний підпис Telegram: привʼязуємо telegram_id (раз; зайнятий чужим id не перезаписуємо)
    let extra: Record<string, unknown> = {};
    if (tg && tg.ok && !r.telegram_id) {
      const taken = await admin.from('allowed_users').select('id').eq('telegram_id', tg.user.id).limit(1);
      if (!taken.data?.length) extra = { telegram_id: tg.user.id };
    }
    return await startSession(admin, r, extra);
  } catch {
    return reply({ ok: false, reason: 'error' }, 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handle);
