// Автотести чистої логіки закритого доступу. Запуск з кореня репозиторію: node --test supabase/tests/*.test.ts
// (Node 22.18+/24+ виконує .ts без налаштувань). Нічого не потребує: ні мережі, ні Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AllowedRow } from '../../app-mvp/src/cloud/shared/telegramAuth.ts';
import {
  checkTelegramPayload,
  chooseProgress,
  dataCheckString,
  decideAccess,
  newSid,
  normalizeUsername,
  sessionState,
  telegramHash,
} from '../../app-mvp/src/cloud/shared/telegramAuth.ts';

const BOT = '123456:TEST-TOKEN';
const now = 1_800_000_000;

// Незалежна реалізація з документації Telegram (node:crypto), щоб звірити з WebCrypto-версією
function referenceHash(fields: Record<string, string | number>, token: string): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(token).digest();
  return crypto.createHmac('sha256', secret).update(dcs).digest('hex');
}

const fields = { id: 777, first_name: 'Іван', username: 'tester_one', auth_date: now - 10 };

test('хеш збігається з еталонним алгоритмом Telegram', async () => {
  assert.equal(await telegramHash(fields, BOT), referenceHash(fields, BOT));
});

test('dataCheckString: поля відсортовані, hash не входить', () => {
  assert.equal(dataCheckString({ username: 'a', id: 1, hash: 'x', auth_date: 2 }), 'auth_date=2\nid=1\nusername=a');
});

test('справжній підпис проходить', async () => {
  const hash = referenceHash(fields, BOT);
  assert.equal(await checkTelegramPayload({ ...fields, hash }, BOT, now), 'ok');
});

test('змінене поле, чужий токен і порожній токен відхиляються', async () => {
  const hash = referenceHash(fields, BOT);
  assert.equal(await checkTelegramPayload({ ...fields, id: 778, hash }, BOT, now), 'bad_hash');
  assert.equal(await checkTelegramPayload({ ...fields, hash }, 'other:token', now), 'bad_hash');
  assert.equal(await checkTelegramPayload({ ...fields, hash }, '', now), 'malformed');
});

test('застарілий і «з майбутнього» вхід відхиляються', async () => {
  const old = { ...fields, auth_date: now - 301 };
  assert.equal(await checkTelegramPayload({ ...old, hash: referenceHash(old, BOT) }, BOT, now), 'expired');
  const future = { ...fields, auth_date: now + 120 };
  assert.equal(await checkTelegramPayload({ ...future, hash: referenceHash(future, BOT) }, BOT, now), 'expired');
});

test('некоректні дані відхиляються', async () => {
  assert.equal(await checkTelegramPayload(null, BOT, now), 'malformed');
  assert.equal(await checkTelegramPayload({ id: 1 } as never, BOT, now), 'malformed');
});

const row = (over: Partial<AllowedRow> = {}): AllowedRow => ({ id: 'r1', username: 'tester_one', telegram_id: null, status: 'invited', is_admin: false, ...over });

test('normalizeUsername', () => {
  assert.equal(normalizeUsername('@Tester_One '), 'tester_one');
  assert.equal(normalizeUsername(undefined), '');
});

test('перший вхід за @username привʼязує Telegram-id', () => {
  const d = decideAccess({ id: 777, username: 'Tester_One' }, null, row());
  assert.ok(d.allow && d.bindTelegramId);
});

test('наступні входи зіставляються за id, навіть якщо @username змінився', () => {
  const d = decideAccess({ id: 777, username: 'new_name' }, row({ telegram_id: 777 }), null);
  assert.ok(d.allow && !d.bindTelegramId);
  assert.ok(d.allow && d.syncUsername === 'new_name');
});

test('@username віддали іншій людині: інший id не пускається', () => {
  const d = decideAccess({ id: 999, username: 'tester_one' }, null, row({ telegram_id: 777 }));
  assert.deepEqual(d, { allow: false, reason: 'id_mismatch' });
});

test('нема у списку, нема @username, заблокований', () => {
  assert.deepEqual(decideAccess({ id: 5, username: 'stranger' }, null, null), { allow: false, reason: 'invite_only' });
  assert.deepEqual(decideAccess({ id: 5 }, null, null), { allow: false, reason: 'no_username' });
  assert.deepEqual(decideAccess({ id: 777, username: 'tester_one' }, row({ telegram_id: 777, status: 'blocked' }), null), { allow: false, reason: 'blocked' });
  assert.deepEqual(decideAccess({ id: 5, username: 'blocked_guy' }, null, row({ username: 'blocked_guy', status: 'blocked' })), { allow: false, reason: 'blocked' });
});

test('один активний сеанс: збіг sid ok, інакше replaced', () => {
  const a = newSid();
  const b = newSid();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
  assert.equal(sessionState(a, a), 'ok');
  assert.equal(sessionState(a, b), 'replaced');
  assert.equal(sessionState(null, b), 'replaced');
  assert.equal(sessionState(a, null), 'replaced');
});

test('вибір версії прогресу при вході', () => {
  const base = { localUserId: 'u1', localUpdatedAt: 100, userId: 'u1', serverUpdatedAt: 200, localCompleted: 3, serverCompleted: 5 };
  assert.equal(chooseProgress(base), 'pull'); // сервер новіший
  assert.equal(chooseProgress({ ...base, serverUpdatedAt: 50 }), 'push'); // локальне новіше
  assert.equal(chooseProgress({ ...base, localUserId: 'other' }), 'pull_reset'); // зайшов інший гравець
  assert.equal(chooseProgress({ ...base, serverUpdatedAt: null, localCompleted: 0 }), 'none');
  assert.equal(chooseProgress({ ...base, serverUpdatedAt: null }), 'push');
  assert.equal(chooseProgress({ ...base, localUserId: null, localUpdatedAt: null, localCompleted: 2, serverCompleted: 5 }), 'pull'); // пристрій новий: більший прогрес перемагає
  assert.equal(chooseProgress({ ...base, localUserId: null, localUpdatedAt: null, localCompleted: 9, serverCompleted: 5 }), 'push');
});

test('згенерований index.ts функції входу містить ту саму логіку й завантажується без Deno', async () => {
  const mod = await import('../functions/telegram-auth/index.ts');
  assert.equal(typeof mod.decideAccess, 'function');
  assert.equal(await mod.telegramHash(fields, BOT), referenceHash(fields, BOT));
});
