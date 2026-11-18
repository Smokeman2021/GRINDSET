// ТЗ 005 / 007: скидання прогресу з епохою на локальному Postgres (міграції 0001–0009, типові права Supabase).
// R1–R11 (серверна частина), права на reset_progress / restore_progress, зайві права з продакшна закриті.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';

type V2 = { status: string; epoch?: number; rev: number; core: { completed: string[]; xp: number; coins: number; answersTotal: number }; ops: { opId: string; status: string; duplicate: boolean }[] };
type Loaded = { mode: string; epoch: number; exists: boolean; rev: number; core: { completed: string[]; xp: number }; state: Record<string, unknown> | null };
type ResetRes = { run_id: string; repeated?: boolean; accounts: { account: string; epoch_from: number; epoch_to: number; archived_progress: number; archived_ops: number; deleted_progress: number; deleted_ops: number }[] };

let db: Db;
const L = (opId: string, lessonId: string, xp = 10, coins = 20, extra: Record<string, unknown> = {}) => ({ opId, kind: 'lesson', lessonId, xp, coins, ...extra });
const v2 = (u: TestUser, baseRev: number, ops: unknown[], cs: unknown, epoch: number | null, client?: pg.Client) =>
  db.rpc<V2>(u, 'select public.save_progress_v2($1::bigint, $2::jsonb, $3::jsonb, $4::int)', [baseRev, JSON.stringify(ops), cs === null ? null : JSON.stringify(cs), epoch], client);
const load = (u: TestUser) => db.rpc<Loaded>(u, 'select public.load_progress_v2()');
const oldLoad = (u: TestUser) => db.rpc<{ state: Record<string, unknown> } | null>(u, 'select public.load_progress()');
const oldSave = (u: TestUser, state: unknown) => db.rpc<string>(u, 'select public.save_progress($1::jsonb)', [JSON.stringify(state)]);
const reset = async (run: string, ids: string[]) => (await db.admin.query('select public.reset_progress($1, $2::uuid[]) as r', [run, ids])).rows[0].r as ResetRes;
const restore = async (run: string, id: string) => (await db.admin.query('select public.restore_progress($1, $2::uuid) as r', [run, id])).rows[0].r as Record<string, unknown>;
const setMode = (m: 'legacy' | 'v2') => db.admin.query('select public.set_progress_write_mode($1)', [m]);
const count = async (sql: string, p: unknown[] = []) => Number((await db.admin.query(sql, p)).rows[0].n);
const snap = (completed: string[], xp: number, extra: Record<string, unknown> = {}) => ({ completed, xp, coins: xp * 2, totalCoinsEarned: xp * 2, answersTotal: 4, answersCorrect: 3, playerName: 'Тест', character: { base: 'm_avg' }, ...extra });

// учётка з прогресом: два уроки, відповіді, знімок із персонажем
async function withProgress(name: string): Promise<TestUser> {
  const u = await db.newUser(name);
  const r = await v2(u, 0, [L(`${name}-1`, 'BR-TOV-L01'), L(`${name}-2`, 'BR-TOV-L02'), { opId: `${name}-a`, kind: 'answers', total: 4, correct: 3 }], snap(['BR-TOV-L01', 'BR-TOV-L02'], 20), 0);
  assert.equal(r.status, 'ok');
  return u;
}

before(async () => {
  db = await startDb(); // 0001–0009
  await db.applyMigration('0009_progress_epoch_reset.sql'); // повторний запуск файла нічого не ламає
  await setMode('v2');
});
after(async () => {
  await db?.stop();
});

test('права: reset_progress / restore_progress — лише власник; тестер не може; revoke_user_sessions і тригерні функції закриті', async () => {
  const u = await db.newUser('perm');
  await assert.rejects(() => db.rpc(u, "select public.reset_progress('x', array[$1]::uuid[])", [u.id]), /permission denied/);
  await assert.rejects(() => db.rpc(u, "select public.restore_progress('x', $1::uuid)", [u.id]), /permission denied/);
  await assert.rejects(() => db.rpc(u, 'select public.revoke_user_sessions($1::uuid)', [u.authId]), /permission denied/);
  for (const fn of ['reset_progress(text, uuid[])', 'restore_progress(text, uuid)', 'revoke_user_sessions(uuid)', 'events_fill()', 'feedback_fill()', 'progress_legacy_blocked(uuid)']) {
    const r = (await db.admin.query(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') a, has_function_privilege('anon', 'public.${fn}', 'execute') b`)).rows[0];
    assert.deepEqual([fn, r.a, r.b], [fn, false, false]);
  }
  // архів і журнал запусків тестеру недоступні; зайві права на таблицях прибрано
  await assert.rejects(() => db.rpc(u, 'select count(*) from public.progress_archive'), /permission denied/);
  await assert.rejects(() => db.rpc(u, 'select count(*) from public.progress_reset_runs'), /permission denied/);
  for (const t of ['allowed_users', 'progress', 'events', 'feedback', 'keepalive']) {
    const r = (await db.admin.query(`select has_table_privilege('authenticated', 'public.${t}', 'truncate') a`)).rows[0];
    assert.equal(r.a, false, `${t}: truncate`);
  }
  // помилки вводу
  await assert.rejects(() => reset('empty-run', []), /empty_list/);
  await assert.rejects(() => reset('bad run id!', [u.id]), /bad_run_id/);
});

test('R1: учётка зі списку — чистий старт (сервер порожній, епоха 1, персонаж і знімок прибрано)', async () => {
  const u = await withProgress('r1');
  const before = await load(u);
  assert.deepEqual([before.exists, before.epoch, before.core.completed.length], [true, 0, 2]);
  const res = await reset('run-r1', [u.id]);
  assert.deepEqual(res.accounts.map((a) => [a.epoch_from, a.epoch_to, a.archived_progress, a.deleted_progress, a.archived_ops, a.deleted_ops]), [[0, 1, 1, 1, 3, 3]]);
  const after1 = await load(u);
  assert.deepEqual([after1.exists, after1.epoch, after1.state], [false, 1, null]);
  // новий старт із новою епохою працює
  const r = await v2(u, 0, [L('r1-new', 'BR-SRV-L01')], { playerName: 'Новий' }, 1);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.core.completed, ['BR-SRV-L01']);
});

test('R2/R3: старий прогрес з другого пристрою (онлайн) і офлайн-черга після виходу в мережу — epoch_mismatch, нічого не записано', async () => {
  const u = await withProgress('r2');
  await reset('run-r2', [u.id]);
  // онлайн: старий знімок і ті самі операції з епохою 0
  const online = await v2(u, 1, [L('r2-old', 'BR-TOV-L03')], snap(['BR-TOV-L01', 'BR-TOV-L02', 'BR-TOV-L03'], 30), 0);
  assert.deepEqual([online.status, online.epoch], ['epoch_mismatch', 1]);
  // офлайн-черга без позначки епохи (стара позначка = 0)
  const offline = await v2(u, 0, [L('r2-q1', 'BR-TOV-L04'), L('r2-q2', 'BR-TOV-L05')], null, null);
  assert.equal(offline.status, 'epoch_mismatch');
  assert.equal(await count('select count(*) n from public.progress where user_id = $1', [u.id]), 0, 'старе на сервер не повернулось');
  assert.equal(await count('select count(*) n from public.progress_ops where user_id = $1', [u.id]), 0);
});

test('R4: стара збірка — save_progress після скидання нічого не пише (і в legacy після відкату); load_progress видаленого не повертає', async () => {
  const u = await withProgress('r4');
  await reset('run-r4', [u.id]);
  assert.equal(await oldLoad(u), null, 'старе завантаження порожнє');
  await oldSave(u, snap(['BR-TOV-L01', 'BR-TOV-L02'], 20));
  assert.equal(await count('select count(*) n from public.progress where user_id = $1', [u.id]), 0);
  assert.ok((await count("select count(*) n from public.events where user_id = $1 and name = 'client_outdated'", [u.id])) >= 1, 'подія client_outdated');
  // навіть після відкату в legacy стара збірка не повертає старий знімок для скинутої учётки
  await setMode('legacy');
  try {
    await oldSave(u, snap(['BR-TOV-L01', 'BR-TOV-L02'], 20));
    assert.equal(await count('select count(*) n from public.progress where user_id = $1', [u.id]), 0);
    // учётка без скидання в legacy пише як раніше
    const other = await db.newUser('r4-other');
    await oldSave(other, snap(['l1'], 10));
    assert.equal(await count('select count(*) n from public.progress where user_id = $1', [other.id]), 1);
  } finally {
    await setMode('v2');
  }
});

test('R5: запис, що почався до скидання, або потрапляє в архів, або відхиляється — рядків старої епохи не лишається', async () => {
  // (а) запис тримає спільне блокування учётки → скидання чекає → запис іде в архів
  const a = await withProgress('r5a');
  const c1 = await db.connect();
  await db.begin(a, c1);
  const pending = await c1.query('select public.save_progress_v2($1::bigint, $2::jsonb, null, $3::int) r', [1, JSON.stringify([L('r5a-late', 'BR-TOV-L03')]), 0]);
  assert.equal(pending.rows[0].r.status, 'ok');
  const resetting = reset('run-r5a', [a.id]); // чекає на блокування рядка учётки
  await new Promise((r) => setTimeout(r, 300));
  await c1.query('commit');
  const res = await resetting;
  assert.equal(res.accounts[0].archived_ops, 4, 'пізня операція — в архіві');
  assert.equal(await count('select count(*) n from public.progress where user_id = $1', [a.id]), 0);
  // (б) скидання тримає виключне блокування → запис чекає → бачить нову епоху → epoch_mismatch
  const b = await withProgress('r5b');
  // скидання — зʼєднанням власника (з'єднання застосунку права не має — це перевірено вище)
  await db.admin.query('begin');
  await db.admin.query('select public.reset_progress($1, $2::uuid[])', ['run-r5b', [b.id]]);
  const writing = v2(b, 1, [L('r5b-late', 'BR-TOV-L03')], null, 0);
  await new Promise((r) => setTimeout(r, 300));
  await db.admin.query('commit');
  const w = await writing;
  assert.equal(w.status, 'epoch_mismatch');
  assert.equal(await count('select count(*) n from public.progress_ops where user_id = $1', [b.id]), 0);
});

test('R6: повторний запуск з тим самим ідентифікатором нічого не змінює й повертає той самий результат', async () => {
  const u = await withProgress('r6');
  const first = await reset('run-r6', [u.id]);
  await v2(u, 0, [L('r6-new', 'BR-INF-L01')], null, 1);
  const archived = await count("select count(*) n from public.progress_archive where run_id = 'run-r6'");
  const second = await reset('run-r6', [u.id]);
  assert.equal(second.repeated, true);
  assert.deepEqual(second.accounts, first.accounts);
  assert.equal(await count("select count(*) n from public.progress_archive where run_id = 'run-r6'"), archived);
  assert.equal((await load(u)).epoch, 1, 'епоха не зросла вдруге');
  assert.deepEqual((await load(u)).core.completed, ['BR-INF-L01'], 'новий прогрес не зачеплено');
});

test('R7: два користувачі — у списку чистий старт, поза списком прогрес і черга на місці й застосовуються', async () => {
  const inList = await withProgress('r7in');
  const outList = await withProgress('r7out');
  await reset('run-r7', [inList.id]);
  assert.equal((await load(inList)).exists, false);
  const kept = await load(outList);
  assert.deepEqual([kept.exists, kept.epoch, kept.core.completed.length], [true, 0, 2]);
  const r = await v2(outList, kept.rev, [L('r7out-3', 'BR-TOV-L03')], null, 0);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.core.completed, ['BR-TOV-L01', 'BR-TOV-L02', 'BR-TOV-L03']);
});

test('R8: перенесення після скидання (legacy-init, legacy:<учётка>:<урок>) не повертає старе; епоха збереглась', async () => {
  const u = await withProgress('r8');
  await reset('run-r8', [u.id]);
  // перенесення зі старими даними (епоха 0) у запиті з новою епохою: кожна операція відхилена
  const r = await v2(u, 0, [
    { opId: `legacy-init:${u.id}`, kind: 'init', at: 1, epoch: 0, state: { completed: ['BR-TOV-L01', 'BR-TOV-L02'], xp: 20, coins: 40 } },
    { ...L(`legacy:${u.id}:BR-TOV-L01`, 'BR-TOV-L01'), epoch: 0 },
  ], null, 1);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.ops.map((o) => o.status), ['rejected_epoch', 'rejected_epoch']);
  assert.deepEqual(r.core.completed, []);
  // те саме з епохою запиту 0 — епоха запиту не та
  assert.equal((await v2(u, 0, [{ opId: `legacy-init:${u.id}`, kind: 'init', at: 1, state: { completed: ['BR-TOV-L01'], xp: 10, coins: 0 } }], null, 0)).status, 'epoch_mismatch');
  assert.equal((await load(u)).epoch, 1);
});

test('R9: вхід без повторного запрошення; відгуки, помітки власника, події на місці; рядків в архіві = видаленим', async () => {
  const u = await withProgress('r9');
  await db.admin.query("update public.allowed_users set telegram_id = 777009 where id = $1", [u.id]);
  await db.rpc(u, "insert into public.feedback (kind, body, screen) values ('comment', 'до скидання', 'home')");
  const fid = (await db.admin.query("select id from public.feedback where body = 'до скидання'")).rows[0].id;
  await db.admin.query("insert into public.feedback_review (feedback_id, note, status, useful) values ($1, 'помітка', 'queued', true)", [fid]);
  await db.rpc(u, "insert into public.events (name, props) values ('session_start', '{}')");
  const ev = await count('select count(*) n from public.events where user_id = $1', [u.id]);
  const res = await reset('run-r9', [u.id]);
  const acc = (await db.admin.query('select status, telegram_id, auth_user_id, active_sid from public.allowed_users where id = $1', [u.id])).rows[0];
  assert.deepEqual([acc.status, Number(acc.telegram_id), acc.auth_user_id, acc.active_sid], ['active', 777009, u.authId, u.sid], 'учётка, привʼязка й сеанс на місці');
  assert.equal((await load(u)).exists, false, 'вхід і завантаження працюють без нового коду');
  assert.equal(await count("select count(*) n from public.feedback where body = 'до скидання'"), 1);
  assert.equal(await count("select count(*) n from public.feedback_review where note = 'помітка'"), 1);
  assert.equal(await count('select count(*) n from public.events where user_id = $1', [u.id]), ev);
  const a = res.accounts[0];
  assert.equal(a.archived_progress, a.deleted_progress);
  assert.equal(a.archived_ops, a.deleted_ops);
  assert.equal(await count("select count(*) n from public.progress_archive where run_id = 'run-r9'"), a.archived_progress + a.archived_ops);
});

test('R10: скидання в режимі legacy відхилено', async () => {
  const u = await withProgress('r10');
  await setMode('legacy');
  try {
    await assert.rejects(() => reset('run-r10', [u.id]), /reset_requires_v2/);
    assert.equal(await count('select count(*) n from public.progress where user_id = $1', [u.id]), 1);
  } finally {
    await setMode('v2');
  }
});

test('R11: restore_progress повертає учётку з архіву з новою епохою; повторна відправка старих операцій дубля не дає', async () => {
  const u = await withProgress('r11');
  await reset('run-r11', [u.id]);
  await v2(u, 0, [L('r11-after', 'BR-NUT-L01')], null, 1); // встиг пройти щось після скидання
  const r = await restore('run-r11', u.id);
  assert.deepEqual([r.epoch_to, r.restored_progress, r.restored_ops, r.moved_current_progress], [2, true, 3, 1]);
  const l = await load(u);
  assert.deepEqual([l.epoch, l.core.completed], [2, ['BR-TOV-L01', 'BR-TOV-L02']]);
  // старі операції повторно (з новою епохою, як після очищення пристрою) — дублікати, без нарахування
  const re = await v2(u, l.rev, [L('r11-1', 'BR-TOV-L01'), L('r11-2', 'BR-TOV-L02')], null, 2);
  assert.deepEqual(re.ops.map((o) => [o.status, o.duplicate]), [['applied', true], ['applied', true]]);
  assert.equal(re.core.xp, l.core.xp);
  // повтор відновлення — той самий результат; прогрес після скидання — в архіві «:before-restore»
  assert.equal((await restore('run-r11', u.id)).repeated, true);
  assert.equal(await count("select count(*) n from public.progress_archive where run_id = 'run-r11:before-restore' and kind = 'progress'"), 1);
  // старий пристрій з епохою 1 — відхилено
  assert.equal((await v2(u, l.rev, [L('r11-x', 'BR-TOV-L03')], null, 1)).status, 'epoch_mismatch');
});
