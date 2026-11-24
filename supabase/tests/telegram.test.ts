// Автотести перевірки підпису Telegram initData. Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyInitData } from '../../app-mvp/src/cloud/shared/telegram.ts';

const TOKEN = '123456:TEST-TOKEN';

// Збираємо initData так, як це робить Telegram (еталонна реалізація на node:crypto)
function sign(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = 1_800_000_000;
const user = JSON.stringify({ id: 777, username: 'tester', first_name: 'Т' });

test('валідний initData проходить, повертає користувача', async () => {
  const v = await verifyInitData(sign({ auth_date: String(now - 60), query_id: 'AA', user }), TOKEN, now);
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.user.id, 777);
});

test('підроблене поле або чужий токен: bad_hash', async () => {
  const good = sign({ auth_date: String(now), user });
  const tampered = good.replace('777', '778');
  assert.deepEqual(await verifyInitData(tampered, TOKEN, now), { ok: false, reason: 'bad_hash' });
  assert.deepEqual(await verifyInitData(good, 'інший:токен', now), { ok: false, reason: 'bad_hash' });
});

test('застарілий auth_date і майбутній: expired', async () => {
  assert.deepEqual(await verifyInitData(sign({ auth_date: String(now - 90000), user }), TOKEN, now), { ok: false, reason: 'expired' });
  assert.deepEqual(await verifyInitData(sign({ auth_date: String(now + 4000), user }), TOKEN, now), { ok: false, reason: 'expired' });
});

test('без користувача, без hash, порожнє: відмова', async () => {
  assert.deepEqual(await verifyInitData(sign({ auth_date: String(now) }), TOKEN, now), { ok: false, reason: 'no_user' });
  assert.deepEqual(await verifyInitData('auth_date=1&user=%7B%7D', TOKEN, now), { ok: false, reason: 'malformed' });
  assert.deepEqual(await verifyInitData('', TOKEN, now), { ok: false, reason: 'malformed' });
  assert.deepEqual(await verifyInitData(sign({ auth_date: String(now), user }), '', now), { ok: false, reason: 'malformed' });
});
