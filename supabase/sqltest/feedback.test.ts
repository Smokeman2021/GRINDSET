// Автотести черги відгуків (ТЗ 004, E2) на локальному Postgres: міграції 0001–0008.
// Контекст доходить до запису; тестер читає лише свої відгуки й не бачить поміток власника та зведення; власник керує чергою.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';

let db: Db;
let c: pg.Client;
let owner: TestUser;
let t1: TestUser;
let t2: TestUser;

// вибірка всіх рядків від імені користувача (одна транзакція)
async function rows<T = Record<string, unknown>>(u: TestUser, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.begin(u, c);
  try {
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows as T[];
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}
const send = (u: TestUser, f: Record<string, unknown>) =>
  rows(u, 'insert into public.feedback (kind, body, screen, lesson_id, step_idx, branch, sim_step, build) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id', [
    f.kind, f.body, f.screen ?? null, f.lessonId ?? null, f.stepIdx ?? null, f.branch ?? null, f.simStep ?? null, f.build ?? null,
  ]);

before(async () => {
  db = await startDb();
  await db.applyMigration('0008_feedback_queue.sql'); // повторний запуск файла нічого не ламає
  c = await db.connect();
  owner = await db.newUser('owner');
  await db.admin.query('update public.allowed_users set is_admin = true where id = $1', [owner.id]);
  t1 = await db.newUser('t1');
  t2 = await db.newUser('t2');
});
after(async () => {
  await db?.stop();
});

test('E2: нові види (коментар, пропозиція, баг) і контекст — збірка, екран, гілка, урок, крок, крок тренажера — доходять до запису', async () => {
  await send(t1, { kind: 'comment', body: 'Таблиця зрізу дрібна', screen: 'leads', lessonId: 'BR-TOV-FINAL', stepIdx: 13, branch: 'TOV', simStep: 13, build: 26 });
  await send(t1, { kind: 'proposal', body: 'Додати графік', screen: 'map/TOV', branch: 'TOV', build: 26 });
  await send(t2, { kind: 'bug', body: 'Кнопка не тиснеться', screen: 'lesson', lessonId: 'BR-SRV-L02', stepIdx: 2, branch: 'SRV', build: 26 });
  const all = (await db.admin.query('select username, kind, screen, lesson_id, step_idx, branch, sim_step, build, user_id from public.feedback order by id')).rows;
  assert.equal(all.length, 3);
  assert.deepEqual({ ...all[0], user_id: undefined }, { username: t1.username, kind: 'comment', screen: 'leads', lesson_id: 'BR-TOV-FINAL', step_idx: 13, branch: 'TOV', sim_step: 13, build: 26, user_id: undefined });
  assert.equal(all[0].user_id, t1.id, 'автора підставляє сервер');
  await assert.rejects(send(t1, { kind: 'rant', body: 'x' }), /feedback_kind_check/);
});

test('E2: підробити автора не можна — user_id і нік ставить тригер', async () => {
  await rows(t1, 'insert into public.feedback (kind, body, user_id, username) values ($1, $2, $3, $4)', ['bug', 'чужий автор', t2.id, t2.username]);
  const r = (await db.admin.query("select user_id, username from public.feedback where body = 'чужий автор'")).rows[0];
  assert.equal(r.user_id, t1.id);
  assert.equal(r.username, t1.username);
});

test('E2: тестер читає лише свої відгуки; помітки власника, черга й зведення йому недоступні', async () => {
  const mine = await rows<{ username: string }>(t1, 'select username from public.feedback');
  assert.ok(mine.length >= 2 && mine.every((r) => r.username === t1.username), 'лише свої');
  const other = await rows<{ username: string }>(t2, 'select username from public.feedback');
  assert.ok(other.every((r) => r.username === t2.username));
  await assert.rejects(rows(t1, 'select * from public.feedback_review'), /permission denied/);
  await assert.rejects(rows(t1, 'select * from public.admin_feedback_queue()'), /forbidden/);
  await assert.rejects(rows(t1, 'select * from public.admin_contributors()'), /forbidden/);
  const anyId = (await db.admin.query('select id from public.feedback limit 1')).rows[0].id;
  await assert.rejects(rows(t1, 'select public.admin_feedback_review($1, $2, $3, $4)', [anyId, 'x', 'queued', true]), /forbidden/);
  // у своїх відгуках колонок поміток немає взагалі
  const cols = Object.keys((await rows(t1, 'select * from public.feedback limit 1'))[0] ?? {});
  assert.ok(!cols.includes('note') && !cols.includes('useful') && !cols.includes('status'));
});

test('E2: власник бачить усі відгуки, ставить помітку й статус «в черзі для Claude», позначає корисні; зведення внеску', async () => {
  const q0 = await rows<{ id: string; status: string; username: string }>(owner, 'select * from public.admin_feedback_queue()');
  assert.ok(q0.length >= 4);
  assert.ok(q0.every((r) => r.status === 'new'));
  const bug = q0.find((r) => r.username === t2.username)!;
  await rows(owner, 'select public.admin_feedback_review($1, $2, $3, $4)', [bug.id, 'Відтворив на iOS', 'queued', true]);
  await rows(owner, 'select public.admin_feedback_review($1, $2, $3, $4)', [bug.id, 'Відтворив на iOS, Desktop теж', 'queued', true]); // повторно — оновлення
  const q1 = await rows<{ id: string; status: string; note: string; useful: boolean }>(owner, 'select * from public.admin_feedback_queue()');
  const b1 = q1.find((r) => r.id === bug.id)!;
  assert.deepEqual([b1.status, b1.note, b1.useful], ['queued', 'Відтворив на iOS, Desktop теж', true]);
  await assert.rejects(rows(owner, 'select public.admin_feedback_review($1, $2, $3, $4)', [bug.id, '', 'weird', false]), /bad_status/);
  const sum = await rows<{ username: string; total: string; useful: string }>(owner, 'select * from public.admin_contributors()');
  const s2 = sum.find((r) => r.username === t2.username)!;
  assert.deepEqual([Number(s2.total), Number(s2.useful)], [1, 1]);
  const s1 = sum.find((r) => r.username === t1.username)!;
  assert.deepEqual([Number(s1.total), Number(s1.useful)], [3, 0]);
});

test('E2: видалення відгуку прибирає й помітку; старі види bug/idea лишаються валідними', async () => {
  await send(t1, { kind: 'idea', body: 'стара збірка' });
  const id = (await db.admin.query("select id from public.feedback where body = 'стара збірка'")).rows[0].id;
  await rows(owner, 'select public.admin_feedback_review($1, $2, $3, $4)', [id, 'n', 'skip', false]);
  await db.admin.query('delete from public.feedback where id = $1', [id]);
  assert.equal(Number((await db.admin.query('select count(*) n from public.feedback_review where feedback_id = $1', [id])).rows[0].n), 0);
});
