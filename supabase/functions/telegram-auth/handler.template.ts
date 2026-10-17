// ───────── Обробник Edge Function (Deno). Чиста логіка вище підставляється скриптом scripts/build-edge-function.mjs ─────────
// Секрети функції (Supabase → Edge Functions → Secrets): TELEGRAM_BOT_TOKEN. SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY Supabase додає сам.
// ПЕРЕВІРЯЛАСЬ ЛИШЕ ЛОГІКА (автотести) і режим-імітація; з реальним Supabase і Telegram функція ще не запускалась.

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ ok: false, reason: 'error' }, 405);

  let payload: TelegramPayload;
  try {
    payload = await req.json();
  } catch {
    return reply({ ok: false, reason: 'malformed' }, 400);
  }

  // 1. Підпис Telegram і свіжість входу
  const check = await checkTelegramPayload(payload, Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '', Math.floor(Date.now() / 1000));
  if (check !== 'ok') return reply({ ok: false, reason: check }, 400);

  try {
    // deno-lint-ignore no-explicit-any
    const { createClient } = (await import('npm:@supabase/supabase-js@2')) as any;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // 2. Білий список: за Telegram-id, а для першого входу за @username
    const uname = normalizeUsername(payload.username);
    const byIdQ = await admin.from('allowed_users').select('*').eq('telegram_id', payload.id).limit(1);
    const byUnameQ = uname ? await admin.from('allowed_users').select('*').eq('username', uname).limit(1) : { data: [] };
    const decision = decideAccess({ id: payload.id, username: payload.username }, byIdQ.data?.[0] ?? null, byUnameQ.data?.[0] ?? null);
    if (!decision.allow) return reply({ ok: false, reason: decision.reason }, 403);
    const row = decision.row as AllowedRow & { auth_user_id?: string | null; display_name?: string | null };

    // 3. Скидаємо всі старі сеанси цього користувача (один активний сеанс)
    if (row.auth_user_id) await admin.rpc('revoke_user_sessions', { p_user: row.auth_user_id });

    // 4. Одноразове посилання для входу (створює користувача Supabase при першому вході); клієнт обміняє token_hash на сесію
    const email = `tg${payload.id}@telegram.invalid`;
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const hashed = link?.data?.properties?.hashed_token as string | undefined;
    const authId = link?.data?.user?.id as string | undefined;
    if (link?.error || !hashed || !authId) return reply({ ok: false, reason: 'error' }, 500);

    // 5. Новий активний сеанс, привʼязка Telegram-id при першому вході
    const sid = newSid();
    const patch: Record<string, unknown> = { active_sid: sid, last_login_at: new Date().toISOString(), auth_user_id: authId };
    if (decision.bindTelegramId) patch.telegram_id = payload.id;
    if (decision.syncUsername) patch.username = decision.syncUsername;
    if (!row.display_name && payload.first_name) patch.display_name = payload.first_name;
    const upd = await admin.from('allowed_users').update(patch).eq('id', row.id);
    if (upd.error) return reply({ ok: false, reason: 'error' }, 500);

    return reply({ ok: true, token_hash: hashed, sid });
  } catch {
    return reply({ ok: false, reason: 'error' }, 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handle);
