// ТЗ 008, п. 4: службова учітка (preview_check) не бере участі в рейтингу. Міграція 0010 у порядку вікна:
// 0001–0007 (крок 2) → 0010 → 0008 → 0009 → скидання. Типові права Supabase емулює harness.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';

let db: Db;
let owner: TestUser;
let t1: TestUser;
let svc: TestUser;

type Row = { name: string; accuracy: string; answers: number; is_me: boolean };
const board = async (u: TestUser) => {
  const c = await db.connect();
  await db.begin(u, c);
  const r = await c.query('select * from public.leaderboard_accuracy()');
  await c.query('commit');
  return r.rows as Row[];
};
const play = (u: TestUser, total: number, correct: number) =>
  db.rpc(u, 'select public.save_progress($1::jsonb)', [JSON.stringify({ completed: ['l1'], xp: 10, coins: 20, totalCoinsEarned: 20, answersTotal: total, answersCorrect: correct, playerName: u.username })]);

before(async () => {
  db = await startDb({ upTo: 7 }); // стан після кроку 2 вікна
  owner = await db.newUser('owner');
  t1 = await db.newUser('t1');
  svc = await db.newUser('preview_check');
  await db.admin.query('update public.allowed_users set is_admin = true where id = $1', [owner.id]);
  for (const u of [owner, t1, svc]) await play(u, 20, 15);
});
after(async () => {
  await db?.stop();
});

test('до 0010 службова учітка в рейтингу є (так на продакшні зараз); після 0010 — ні; повторний запуск 0010 нічого не ламає', async () => {
  assert.equal((await board(t1)).length, 2, 'тестер і майбутня службова, адмін — ні');
  await db.applyMigration('0010_service_accounts.sql');
  await db.applyMigration('0010_service_accounts.sql');
  assert.equal((await board(t1)).length, 2, 'поле додано, але учітку ще не позначено');
  await db.admin.query('update public.allowed_users set is_service = true where id = $1', [svc.id]);
  const rows = await board(t1);
  assert.deepEqual(rows.map((r) => r.name), [t1.username]);
  // сама службова учітка рейтинг бачить (вхід, вкладка працюють), але себе в ньому — ні
  const own = await board(svc);
  assert.equal(own.some((r) => r.is_me), false);
  assert.equal(own.length, 1);
});

test('тестер не може позначити себе службовою чи адміном (RLS: змінювати allowed_users може лише адмін)', async () => {
  const c = await db.connect();
  await db.begin(t1, c);
  const r = await c.query('update public.allowed_users set is_service = true, is_admin = true where id = $1', [t1.id]);
  await c.query('commit');
  assert.equal(r.rowCount, 0);
  const st = (await db.admin.query('select is_service, is_admin from public.allowed_users where id = $1', [t1.id])).rows[0];
  assert.deepEqual(st, { is_service: false, is_admin: false });
  // права на функцію рейтингу: anon — ні
  const p = (await db.admin.query("select has_function_privilege('anon', 'public.leaderboard_accuracy()', 'execute') a, has_function_privilege('authenticated', 'public.leaderboard_accuracy()', 'execute') b")).rows[0];
  assert.deepEqual(p, { a: false, b: true });
});

test('далі за вікном: 0008 і 0009 після 0010 застосовуються; скидання службової учітки — окремим рядком, поле is_service лишається', async () => {
  await db.admin.query("select public.set_progress_write_mode('v2')");
  await db.applyMigration('0008_feedback_queue.sql');
  await db.applyMigration('0009_progress_epoch_reset.sql');
  const res = (await db.admin.query('select public.reset_progress($1, $2::uuid[]) as r', ['window-test', [t1.id, svc.id]])).rows[0].r as { users: { user_id: string }[] } & Record<string, unknown>;
  assert.ok(res, 'результат скидання є');
  const left = (await db.admin.query('select user_id from public.progress where user_id = any($1::uuid[])', [[t1.id, svc.id]])).rows;
  assert.deepEqual(left, [], 'прогрес обох скинуто');
  const st = async (u: TestUser) => (await db.admin.query('select is_service, is_admin, status from public.allowed_users where id = $1', [u.id])).rows[0];
  assert.deepEqual(await st(svc), { is_service: true, is_admin: false, status: 'active' });
  assert.deepEqual(await st(t1), { is_service: false, is_admin: false, status: 'active' });
  assert.deepEqual(await st(owner), { is_service: false, is_admin: true, status: 'active' });
  // адмін поза списком — прогрес на місці
  assert.equal(Number((await db.admin.query('select count(*) n from public.progress where user_id = $1', [owner.id])).rows[0].n), 1);
});
