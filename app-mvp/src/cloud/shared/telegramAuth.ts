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
