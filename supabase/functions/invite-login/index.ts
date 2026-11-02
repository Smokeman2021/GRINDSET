// ЗГЕНЕРОВАНО скриптом scripts/build-edge-function.mjs: не редагуй вручну.
// Правки логіки: app-mvp/src/cloud/shared/access.ts; мережева частина: handler.template.ts. Потім запусти скрипт.
// Як розгорнути: Supabase → Edge Functions → Deploy a new function → Via Editor (назва invite-login) → вставити весь вміст цього файлу → Deploy.
// Вимкни «Verify JWT» для цієї функції (її викликають до входу).

// Спільна чиста логіка закритого доступу за персональним кодом: перевірка коду з лімітом спроб, id сеансу, вибір версії прогресу.
// Без імпортів і без залежностей від платформи: цей файл (1) використовує режим-імітація в застосунку, (2) вставляється в Edge Function
// Supabase скриптом scripts/build-edge-function.mjs, (3) перевіряється автотестами (supabase/tests). Правиш лише тут.
//
// Схема: тестер вводить @нік і свій персональний код (12 символів, `XXXX-XXXX-XXXX`), який йому видав автор. Нік публічний і лише
// ідентифікує запис у білому списку; секрет це код. Код зберігається як хеш: sha256(сіль + ':' + код без дефісів, у верхньому регістрі).
// Генерує код SQL-функція issue_invite (supabase/migrations/0002_invite_codes.sql); тут лише перевірка.

const enc = new TextEncoder();

// Алфавіт без схожих символів (немає 0, O, 1, I, L): 31 символ, 12 символів коду це близько 59 біт
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 12;
export const MAX_ATTEMPTS = 5; // хибних кодів поспіль до блокування
export const LOCK_MINUTES = 15;

export const normalizeUsername = (u: string | null | undefined): string => (u ?? '').trim().replace(/^@/, '').toLowerCase();

// Прибирає дефіси, пробіли й регістр: «k7m2-9qxp 4tdh» == «K7M29QXP4TDH»
export const normalizeInviteCode = (c: string | null | undefined): string => (c ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const formatInviteCode = (norm: string): string => norm.replace(/(.{4})(?=.)/g, '$1-');

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashInvite(salt: string, normalizedCode: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${normalizedCode}`)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Той самий алгоритм, що й у SQL (issue_invite): рівномірний вибір символів відхиленням зсуву. Для імітації й тестів; справжні коди видає SQL.
export function generateInviteCode(): string {
  const limit = 256 - (256 % INVITE_ALPHABET.length);
  let out = '';
  while (out.length < INVITE_LENGTH) {
    const b = new Uint8Array(1);
    crypto.getRandomValues(b);
    if (b[0] < limit) out += INVITE_ALPHABET[b[0] % INVITE_ALPHABET.length];
  }
  return formatInviteCode(out);
}

// ───────── Перевірка коду ─────────

export type InviteRow = {
  id: string;
  username: string; // нижній регістр, без @
  status: 'invited' | 'active' | 'blocked';
  invite_salt: string | null;
  invite_hash: string | null;
  failed_attempts: number;
  locked_until: string | null; // ISO-час
};

export type InvitePatch = { failed_attempts: number; locked_until: string | null };

export type InviteVerdict =
  | { ok: true; patch: InvitePatch }
  | { ok: false; reason: 'wrong' | 'locked' | 'blocked'; patch?: InvitePatch; attemptsLeft?: number; lockedSeconds?: number };

// row = null (такого ніка нема) або запис без коду → однакова відповідь «wrong», щоб за відповіддю не можна було відрізнити
// відсутній нік від хибного коду; хеш рахуємо в усіх гілках, щоб не видавати різницею в часі.
export async function checkInvite(row: InviteRow | null, code: string, nowMs: number): Promise<InviteVerdict> {
  const norm = normalizeInviteCode(code);
  if (!row || !row.invite_hash || !row.invite_salt) {
    await hashInvite('no-such-user', norm);
    return { ok: false, reason: 'wrong' };
  }
  if (row.locked_until && Date.parse(row.locked_until) > nowMs) {
    return { ok: false, reason: 'locked', lockedSeconds: Math.ceil((Date.parse(row.locked_until) - nowMs) / 1000) };
  }
  const hash = await hashInvite(row.invite_salt, norm);
  const good = norm.length === INVITE_LENGTH && safeEqual(hash, row.invite_hash);
  if (!good) {
    const attempts = (row.failed_attempts ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      return {
        ok: false,
        reason: 'locked',
        lockedSeconds: LOCK_MINUTES * 60,
        patch: { failed_attempts: 0, locked_until: new Date(nowMs + LOCK_MINUTES * 60000).toISOString() },
      };
    }
    return { ok: false, reason: 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts, patch: { failed_attempts: attempts, locked_until: null } };
  }
  if (row.status === 'blocked') return { ok: false, reason: 'blocked' };
  return { ok: true, patch: { failed_attempts: 0, locked_until: null } };
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

// ───────── Рейтинг точності ─────────
// Правила дзеркалять SQL-функцію leaderboard_accuracy (supabase/migrations/0003_accuracy_leaderboard.sql):
// лише status = active, без адмінів, мінімум MIN_RATED_ANSWERS відповідей; вище точність, при рівності вище більше відповідей.
export const MIN_RATED_ANSWERS = 10; // рішення автора 2026-11: поріг 10 відповідей (було 30)

export type BoardInput = { name: string; status: string; isAdmin: boolean; correct: number; total: number; isMe?: boolean };
export type BoardRow = { name: string; accuracy: number; answers: number; isMe: boolean };

export function accuracyBoard(entries: BoardInput[]): BoardRow[] {
  return entries
    .filter((e) => e.status === 'active' && !e.isAdmin && e.total >= MIN_RATED_ANSWERS)
    .map((e) => {
      const correct = Math.max(0, Math.min(e.correct, e.total));
      return { name: e.name, accuracy: Math.round((correct / e.total) * 1000) / 10, answers: e.total, isMe: !!e.isMe };
    })
    .sort((a, b) => b.accuracy - a.accuracy || b.answers - a.answers || a.name.localeCompare(b.name))
    .slice(0, 100);
}

// Перевірка підпису initData Telegram Mini App (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
// Без імпортів: використовується в Edge Function (її збирає scripts/build-edge-function.mjs разом з access.ts) і в автотестах.
// Алгоритм: secret = HMAC_SHA256(ключ "WebAppData", токен бота); hash = HMAC_SHA256(ключ secret, data_check_string),
// де data_check_string це всі поля initData крім hash у форматі key=value, відсортовані за ключем, через \n.

const tgEnc = new TextEncoder();

export type TgUser = { id: number; username?: string; first_name?: string };
export type TgVerdict = { ok: true; user: TgUser; authDate: number } | { ok: false; reason: 'malformed' | 'bad_hash' | 'expired' | 'no_user' };

async function hmac(key: ArrayBuffer | ArrayBufferView<ArrayBuffer>, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, tgEnc.encode(msg));
}

const tgHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function tgSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// maxAgeSec: наскільки свіжим має бути auth_date (за замовчуванням доба: сесію в Mini App відкривають щоразу заново)
export async function verifyInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): Promise<TgVerdict> {
  if (!initData || !botToken || initData.length > 4096) return { ok: false, reason: 'malformed' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'malformed' };
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await hmac(tgEnc.encode('WebAppData'), botToken);
  const calc = tgHex(await hmac(secret, check));
  if (!tgSafeEqual(calc, hash.toLowerCase())) return { ok: false, reason: 'bad_hash' };
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec || authDate - nowSec > 300) return { ok: false, reason: 'expired' };
  let user: TgUser | null = null;
  try {
    user = JSON.parse(params.get('user') ?? 'null') as TgUser | null;
  } catch {
    user = null;
  }
  if (!user || typeof user.id !== 'number' || !Number.isFinite(user.id)) return { ok: false, reason: 'no_user' };
  return { ok: true, user, authDate };
}

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
