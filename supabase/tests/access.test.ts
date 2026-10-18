// Автотести чистої логіки закритого доступу за персональним кодом. Запуск з кореня репозиторію: node --test supabase/tests/*.test.ts
// (Node 22.18+/24+ виконує .ts без налаштувань). Нічого не потребує: ні мережі, ні Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { InviteRow } from '../../app-mvp/src/cloud/shared/access.ts';
import {
  INVITE_ALPHABET,
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  checkInvite,
  chooseProgress,
  formatInviteCode,
  generateInviteCode,
  hashInvite,
  newSid,
  normalizeInviteCode,
  normalizeUsername,
  sessionState,
} from '../../app-mvp/src/cloud/shared/access.ts';

const NOW = 1_800_000_000_000;
const CODE = 'K7M2-9QXP-4TDH';

// Незалежна реалізація (node:crypto) того ж алгоритму, що в SQL issue_invite: sha256(сіль || ':' || код без дефісів)
const referenceHash = (salt: string, code: string) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

async function rowWith(over: Partial<InviteRow> = {}): Promise<InviteRow> {
  const salt = 'a1b2c3d4';
  return {
    id: 'r1',
    username: 'tester_one',
    status: 'invited',
    invite_salt: salt,
    invite_hash: await hashInvite(salt, normalizeInviteCode(CODE)),
    failed_attempts: 0,
    locked_until: null,
    ...over,
  };
}

test('нормалізація: нік і код', () => {
  assert.equal(normalizeUsername('@Tester_One '), 'tester_one');
  assert.equal(normalizeUsername(undefined), '');
  assert.equal(normalizeInviteCode(' k7m2-9qxp 4tdh '), 'K7M29QXP4TDH');
  assert.equal(formatInviteCode('K7M29QXP4TDH'), 'K7M2-9QXP-4TDH');
});

test('хеш збігається з еталонним (як у SQL)', async () => {
  assert.equal(await hashInvite('salt', 'K7M29QXP4TDH'), referenceHash('salt', 'K7M29QXP4TDH'));
});

test('згенерований код: формат, алфавіт, унікальність', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateInviteCode();
    assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    for (const ch of normalizeInviteCode(c)) assert.ok(INVITE_ALPHABET.includes(ch));
    seen.add(c);
  }
  assert.equal(seen.size, 200);
});

test('правильний код (будь-який регістр і дефіси) пускає й скидає лічильник', async () => {
  const row = await rowWith({ failed_attempts: 3 });
  for (const typed of [CODE, CODE.toLowerCase(), 'k7m29qxp4tdh', ' K7M2 9QXP 4TDH ']) {
    const v = await checkInvite(row, typed, NOW);
    assert.ok(v.ok, typed);
    assert.deepEqual(v.ok && v.patch, { failed_attempts: 0, locked_until: null });
  }
});

test('хибний код: лічильник росте, лишаються спроби', async () => {
  const v = await checkInvite(await rowWith({ failed_attempts: 1 }), 'AAAA-BBBB-CCCC', NOW);
  assert.ok(!v.ok && v.reason === 'wrong');
  assert.equal(!v.ok && v.attemptsLeft, MAX_ATTEMPTS - 2);
  assert.deepEqual(!v.ok && v.patch, { failed_attempts: 2, locked_until: null });
});

test(`${MAX_ATTEMPTS}-а хибна спроба блокує на ${LOCK_MINUTES} хв, навіть правильний код тоді не пускає`, async () => {
  const last = await checkInvite(await rowWith({ failed_attempts: MAX_ATTEMPTS - 1 }), 'AAAA-BBBB-CCCC', NOW);
  assert.ok(!last.ok && last.reason === 'locked' && last.lockedSeconds === LOCK_MINUTES * 60);
  const until = !last.ok && last.patch?.locked_until;
  assert.equal(until, new Date(NOW + LOCK_MINUTES * 60000).toISOString());
  const locked = await checkInvite(await rowWith({ locked_until: until as string }), CODE, NOW + 1000);
  assert.ok(!locked.ok && locked.reason === 'locked');
  // після закінчення блокування правильний код знову працює
  const after = await checkInvite(await rowWith({ locked_until: until as string }), CODE, NOW + LOCK_MINUTES * 60000 + 1000);
  assert.ok(after.ok);
});

test('нема такого ніка або запис без коду: однакова відповідь «wrong» без змін у базі', async () => {
  const none = await checkInvite(null, CODE, NOW);
  assert.deepEqual(none, { ok: false, reason: 'wrong' });
  const noInvite = await checkInvite(await rowWith({ invite_hash: null, invite_salt: null }), CODE, NOW);
  assert.deepEqual(noInvite, { ok: false, reason: 'wrong' });
});

test('заблокований: правильний код не пускає, хибний нічого не розкриває', async () => {
  const blockedRow = await rowWith({ status: 'blocked' });
  const good = await checkInvite(blockedRow, CODE, NOW);
  assert.ok(!good.ok && good.reason === 'blocked');
  const bad = await checkInvite(blockedRow, 'AAAA-BBBB-CCCC', NOW);
  assert.ok(!bad.ok && bad.reason === 'wrong');
});

test('код неправильної довжини відхиляється', async () => {
  const v = await checkInvite(await rowWith(), 'K7M2-9QXP', NOW);
  assert.ok(!v.ok && v.reason === 'wrong');
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
  const mod = await import('../functions/invite-login/index.ts');
  assert.equal(typeof mod.checkInvite, 'function');
  assert.equal(await mod.hashInvite('salt', 'K7M29QXP4TDH'), referenceHash('salt', 'K7M29QXP4TDH'));
});
