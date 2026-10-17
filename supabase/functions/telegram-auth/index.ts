// ЗГЕНЕРОВАНО скриптом scripts/build-edge-function.mjs: не редагуй вручну.
// Правки логіки: app-mvp/src/cloud/shared/telegramAuth.ts; мережева частина: handler.template.ts. Потім запусти скрипт.
// Як розгорнути: Supabase → Edge Functions → Create function (назва telegram-auth) → вставити весь вміст цього файлу → Deploy.
// Вимкни «Verify JWT» для цієї функції (її викликають до входу).

// Спільна чиста логіка закритого доступу: перевірка підпису Telegram, рішення «пускати / ні», id сеансу, вибір версії прогресу.
// Без імпортів і без залежностей від платформи: цей файл (1) використовує режим-імітація в застосунку, (2) вставляється в Edge Function
// Supabase скриптом scripts/build-edge-function.mjs, (3) перевіряється автотестами (supabase/tests). Правиш лише тут.

// ───────── Telegram Login Widget: перевірка підпису ─────────

export type TelegramPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Рядок для підпису за документацією Telegram: усі поля, крім hash, у алфавітному порядку, «ключ=значення» через \n
export function dataCheckString(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter((k) => k !== 'hash' && payload[k] !== undefined && payload[k] !== null)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n');
}

// HMAC-SHA256(data_check_string), ключ = SHA256(токен бота)
export async function telegramHash(payload: Record<string, unknown>, botToken: string): Promise<string> {
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataCheckString(payload)));
  return toHex(sig);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type PayloadCheck = 'ok' | 'malformed' | 'bad_hash' | 'expired';

// Перевіряє підпис і свіжість входу (за замовчуванням до 5 хвилин)
export async function checkTelegramPayload(payload: Partial<TelegramPayload> | null | undefined, botToken: string, nowSec: number, maxAgeSec = 300): Promise<PayloadCheck> {
  if (!payload || typeof payload.id !== 'number' || !Number.isFinite(payload.id) || typeof payload.hash !== 'string' || typeof payload.auth_date !== 'number') return 'malformed';
  if (!botToken) return 'malformed';
  const expected = await telegramHash(payload as Record<string, unknown>, botToken);
  if (!safeEqual(expected, payload.hash.toLowerCase())) return 'bad_hash';
  if (nowSec - payload.auth_date > maxAgeSec || payload.auth_date - nowSec > 60) return 'expired';
  return 'ok';
}

// ───────── Білий список ─────────

export type AllowedRow = {
  id: string;
  username: string; // нижній регістр, без @
  display_name?: string | null;
  telegram_id: number | null;
  status: 'invited' | 'active' | 'blocked';
  is_admin: boolean;
};

export const normalizeUsername = (u: string | null | undefined): string => (u ?? '').trim().replace(/^@/, '').toLowerCase();

export type AccessDecision =
  | { allow: true; row: AllowedRow; bindTelegramId: boolean; syncUsername: string | null }
  | { allow: false; reason: 'invite_only' | 'blocked' | 'id_mismatch' | 'no_username' };

// Зіставляємо за числовим Telegram-id. @username лише для першого входу (привʼязка id) і для показу.
//  byId       — запис, у якого telegram_id збігається;
//  byUsername — запис за @username (нормалізованим).
export function decideAccess(tg: { id: number; username?: string | null }, byId: AllowedRow | null, byUsername: AllowedRow | null): AccessDecision {
  let row: AllowedRow | null = null;
  let bind = false;
  if (byId) {
    row = byId;
  } else if (!normalizeUsername(tg.username)) {
    return { allow: false, reason: 'no_username' };
  } else if (byUsername) {
    if (byUsername.telegram_id == null) {
      row = byUsername;
      bind = true;
    } else {
      // у списку цей @username привʼязаний до іншого Telegram-id: @username могли віддати іншій людині
      return { allow: false, reason: 'id_mismatch' };
    }
  } else {
    return { allow: false, reason: 'invite_only' };
  }
  if (row.status === 'blocked') return { allow: false, reason: 'blocked' };
  const now = normalizeUsername(tg.username);
  return { allow: true, row, bindTelegramId: bind, syncUsername: now && now !== row.username ? now : null };
}

// ───────── Один активний сеанс ─────────

export function newSid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Клієнт надсилає свій sid; сервер порівнює з активним
export function sessionState(clientSid: string | null | undefined, activeSid: string | null | undefined): 'ok' | 'replaced' {
  return clientSid && activeSid && clientSid === activeSid ? 'ok' : 'replaced';
}

// ───────── Прогрес: що робити при вході ─────────

// 'pull' — взяти серверну версію; 'push' — відправити локальну; 'pull_reset' — зайшов інший гравець: спершу очистити локальний стан
// (і взяти серверний, якщо він є); 'none' — нічого робити.
export function chooseProgress(opts: {
  localUserId: string | null; // чий прогрес лежить на цьому пристрої (мітка з останньої синхронізації)
  localUpdatedAt: number | null; // коли локальний стан востаннє збігався із сервером
  userId: string;
  serverUpdatedAt: number | null; // null = на сервері ще нічого нема
  localCompleted: number; // скільки уроків пройдено локально
  serverCompleted: number;
}): 'pull' | 'push' | 'pull_reset' | 'none' {
  const { localUserId, localUpdatedAt, userId, serverUpdatedAt, localCompleted, serverCompleted } = opts;
  if (localUserId && localUserId !== userId) return 'pull_reset';
  if (serverUpdatedAt == null) return localCompleted > 0 ? 'push' : 'none';
  if (localUpdatedAt == null) return localCompleted > serverCompleted ? 'push' : 'pull'; // пристрій ще не синхронізувався: перемагає більший прогрес
  return serverUpdatedAt > localUpdatedAt ? 'pull' : 'push';
}

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
