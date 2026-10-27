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
export const MIN_RATED_ANSWERS = 30;

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
