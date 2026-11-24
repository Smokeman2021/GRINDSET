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
