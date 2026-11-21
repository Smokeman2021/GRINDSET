// ТЗ 006, 4.1: перехід 0007 → 0008 на локальному Postgres. До 0008 нова збірка шле коментар, пропозицію й баг старим форматом
// (так само, як supabaseBackend при помилці колонки: legacyPayload). Після 0008 усі три зберігають зміст і контекст
// (збірка, екран, гілка, урок, крок, крок тренажера), читаються в адмінці (admin_feedback_queue) і потрапляють в експорт (CSV, Markdown).
// RLS: тестер не бачить чужих відгуків, поміток власника й зведення внеску.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';
import { FEEDBACK_CSV_HEADER, contextLine, feedbackContext, feedbackCsvRows, legacyPayload, queueMarkdown, type FbKind, type QueueRow } from '../../app-mvp/src/cloud/shared/feedbackQueue.ts';
import { toCsv } from '../../app-mvp/src/cloud/shared/csv.ts';

let db: Db;
let c: pg.Client;
let owner: TestUser;
let t1: TestUser;
let t2: TestUser;

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

// Відправка так, як її робить клієнт b27 до 0008: базові колонки + старий вид і контекст у тексті
async function sendLegacy(u: TestUser, kind: FbKind, body: string, ctx: { screen: string; lessonId?: string; stepIdx?: number; branch?: string; simStep?: number }) {
  const full = feedbackContext(ctx, 27);
  const old = legacyPayload(kind, body, full);
  await rows(u, 'insert into public.feedback (kind, body, screen, lesson_id, step_idx, build) values ($1, $2, $3, $4, $5, $6)', [old.kind, old.body, full.screen, full.lessonId ?? null, full.stepIdx ?? null, 27]);
}

const toRow = (r: Record<string, unknown>): QueueRow => ({
  id: Number(r.id),
  username: String(r.username ?? ''),
  kind: String(r.kind),
  screen: String(r.screen ?? ''),
  lessonId: String(r.lesson_id ?? ''),
  stepIdx: r.step_idx == null ? null : Number(r.step_idx),
  branch: r.branch == null ? null : String(r.branch),
  simStep: r.sim_step == null ? null : Number(r.sim_step),
  body: String(r.body ?? ''),
  build: r.build == null ? null : Number(r.build),
  createdAt: Number(r.created_ms),
  note: r.note == null ? null : String(r.note),
  status: (r.status ?? 'new') as QueueRow['status'],
  useful: !!r.useful,
});

before(async () => {
  db = await startDb({ upTo: 7 }); // стан після кроку 2 вікна: 0007 є, 0008 ще ні
  c = await db.connect();
  owner = await db.newUser('owner');
  await db.admin.query('update public.allowed_users set is_admin = true where id = $1', [owner.id]);
  t1 = await db.newUser('t1');
  t2 = await db.newUser('t2');
});
after(async () => {
  await db?.stop();
});

test('006-4.1: до 0008 — коментар, пропозиція й баг старим форматом приймаються; нових колонок ще немає', async () => {
  await sendLegacy(t1, 'comment', 'Таблиця зрізу дрібна', { screen: 'leads', lessonId: 'BR-TOV-FINAL', branch: 'TOV', simStep: 13 });
  await sendLegacy(t1, 'proposal', 'Додати графік апруву', { screen: 'map/TOV', branch: 'TOV' });
  await sendLegacy(t2, 'bug', 'Кнопка «Перевірити» не тиснеться', { screen: 'lesson', lessonId: 'BR-SRV-L02', stepIdx: 2 });
  const cols = (await db.admin.query("select column_name from information_schema.columns where table_name = 'feedback'")).rows.map((r) => r.column_name);
  assert.ok(!cols.includes('branch') && !cols.includes('sim_step'));
  assert.equal(Number((await db.admin.query('select count(*) n from public.feedback')).rows[0].n), 3);
});

test('006-4.1: після 0008 усі три зберегли зміст і контекст; гілка й крок тренажера перенесені з тексту в колонки', async () => {
  const before0008 = (await db.admin.query('select id, kind, body, screen, lesson_id, step_idx, build, user_id from public.feedback order by id')).rows;
  await db.applyMigration('0008_feedback_queue.sql');
  await db.applyMigration('0008_feedback_queue.sql'); // повторний запуск нічого не змінює
  const after0008 = (await db.admin.query('select id, kind, body, screen, lesson_id, step_idx, build, user_id, branch, sim_step from public.feedback order by id')).rows;
  // старі колонки — без змін
  assert.deepEqual(after0008.map(({ branch: _b, sim_step: _s, ...r }) => r), before0008);
  // крок тренажера в тексті — для людини (з 1), у колонці — індекс (з 0), як у нових записах
  assert.deepEqual(after0008.map((r) => [r.branch, r.sim_step]), [['TOV', 13], ['TOV', null], ['SRV', null]]);
  // вид і текст: коментар/пропозиція — як 'idea' з позначкою в тексті, баг — 'bug'
  assert.deepEqual(after0008.map((r) => r.kind), ['idea', 'idea', 'bug']);
  assert.match(after0008[0].body, /^\[коментар\] Таблиця зрізу дрібна \(гілка TOV, тренажер, крок 14\)$/);
  assert.match(after0008[1].body, /^\[пропозиція\] Додати графік апруву \(гілка TOV\)$/);
  assert.equal(after0008[2].body, 'Кнопка «Перевірити» не тиснеться (гілка SRV)'); // гілку клієнт виводить з ID уроку
});

test('006-4.1: адмінка читає всі три з контекстом; CSV і «Черга для Claude» містять їх', async () => {
  const q = (await rows<Record<string, unknown>>(owner, 'select * from public.admin_feedback_queue()')).map(toRow);
  assert.equal(q.length, 3);
  const byBody = (s: string) => q.find((r) => r.body.includes(s))!;
  assert.equal(contextLine(byBody('Таблиця зрізу')), 'b27 · leads · гілка TOV · урок BR-TOV-FINAL · тренажер, крок 14');
  assert.equal(contextLine(byBody('Додати графік')), 'b27 · map/TOV · гілка TOV');
  assert.equal(contextLine(byBody('Кнопка')), 'b27 · lesson · гілка SRV · урок BR-SRV-L02 · крок 3');
  const csv = toCsv(FEEDBACK_CSV_HEADER, feedbackCsvRows(q));
  for (const s of ['Таблиця зрізу дрібна', 'Додати графік апруву', 'не тиснеться', 'BR-TOV-FINAL', 'BR-SRV-L02', 'map/TOV']) assert.ok(csv.includes(s), `CSV: ${s}`);
  assert.equal(csv.split(/\r?\n/)[0], FEEDBACK_CSV_HEADER.join(','));
  // у Markdown для Claude — лише відгуки «в черзі»
  const bug = byBody('Кнопка');
  await rows(owner, 'select public.admin_feedback_review($1, $2, $3, $4)', [bug.id, 'Відтворив', 'queued', true]);
  const q2 = (await rows<Record<string, unknown>>(owner, 'select * from public.admin_feedback_queue()')).map(toRow);
  const md = queueMarkdown(q2);
  assert.ok(md.includes('не тиснеться') && md.includes('BR-SRV-L02') && md.includes('Відтворив'));
  // після 0008 той самий клієнт пише вже новим форматом — у ту саму чергу
  await rows(t1, 'insert into public.feedback (kind, body, screen, lesson_id, branch, sim_step, build) values ($1, $2, $3, $4, $5, $6, $7)', ['comment', 'Новий формат', 'leads', 'BR-TOV-FINAL', 'TOV', 5, 27]);
  const q3 = (await rows<Record<string, unknown>>(owner, 'select * from public.admin_feedback_queue()')).map(toRow);
  assert.deepEqual([q3.length, q3.find((r) => r.body === 'Новий формат')?.kind], [4, 'comment']);
});

test('006-4.1: RLS — тестер не бачить чужих відгуків, поміток власника й зведення внеску', async () => {
  const mine = await rows<{ username: string; body: string }>(t2, 'select username, body from public.feedback');
  assert.deepEqual(mine.map((r) => r.username), [t2.username]);
  const t1rows = await rows<{ username: string }>(t1, 'select username from public.feedback');
  assert.ok(t1rows.length === 3 && t1rows.every((r) => r.username === t1.username));
  await assert.rejects(rows(t2, 'select * from public.feedback_review'), /permission denied/);
  await assert.rejects(rows(t2, 'select * from public.admin_feedback_queue()'), /forbidden/);
  await assert.rejects(rows(t2, 'select * from public.admin_contributors()'), /forbidden/);
  // власний відгук із поміткою: помітки в рядку тестера немає
  const cols = Object.keys((await rows(t2, 'select * from public.feedback limit 1'))[0] ?? {});
  assert.ok(!cols.includes('note') && !cols.includes('useful') && !cols.includes('status'));
  // власник бачить зведення
  const sum = await rows<{ username: string; total: string; useful: string }>(owner, 'select * from public.admin_contributors()');
  assert.deepEqual(sum.find((r) => r.username === t2.username) && [Number(sum.find((r) => r.username === t2.username)!.total), Number(sum.find((r) => r.username === t2.username)!.useful)], [1, 1]);
});
