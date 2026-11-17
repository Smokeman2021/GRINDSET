// Репетиція вікна викладки (ТЗ 004, ізольована перевірка) на локальній базі з чинною 0007 з гілки.
// Порядок як у плані вікна: стан b24 → резервна копія → 0007 (legacy) → нова збірка копить операції → перемикання v2 →
// 0008 (відгуки) → відкат legacy → повернення v2 (0008 аддитивна, лишається). Після кожного кроку: жоден урок і жодна нагорода не втрачені
// відносно резервної копії, нічого не подвоєно.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';
import { legacyOps, syncQueue } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import type { Op, SaveV2, SyncState } from '../../app-mvp/src/cloud/shared/progressOps.ts';

let db: Db;
const users: TestUser[] = [];
type Snap = Record<string, unknown> & { completed: string[]; xp: number; coins: number; totalCoinsEarned: number };
const snap = (completed: string[], xp: number, coins: number, extra: Record<string, unknown> = {}): Snap => ({ completed, xp, coins, totalCoinsEarned: coins, answersTotal: completed.length * 5, answersCorrect: completed.length * 4, playerName: 'Тест', ...extra });
const legacy = (u: TestUser, s: unknown) => db.rpc<string>(u, 'select public.save_progress($1::jsonb)', [JSON.stringify(s)]);
const v2 = (u: TestUser, rev: number, ops: unknown[], cs: unknown = null) =>
  db.rpc<{ status: string; rev: number; core: never; rewarded: string[]; client_state: Record<string, unknown>; client_state_status: string; ops: never }>(u, 'select public.save_progress_v2($1::bigint, $2::jsonb, $3::jsonb)', [rev, JSON.stringify(ops), cs === null ? null : JSON.stringify(cs)]);
const loadV2 = (u: TestUser) => db.rpc<{ mode: string; exists: boolean; rev: number; core: { completed: string[]; coins: number; xp: number; totalCoinsEarned: number } }>(u, 'select public.load_progress_v2()');
const setMode = (m: string) => db.admin.query('select public.set_progress_write_mode($1)', [m]);
const state = async (u: TestUser) => (await db.admin.query('select state from public.progress where user_id = $1', [u.id])).rows[0]?.state as Snap | undefined;
const io = (u: TestUser) => ({
  send: async (rev: number, ops: Op[], cs: Record<string, unknown> | null): Promise<SaveV2> => {
    const r = await v2(u, rev, ops, cs);
    return r.status === 'ok'
      ? { status: 'ok', rev: Number(r.rev), core: r.core, rewarded: r.rewarded, clientState: r.client_state, clientStateStatus: r.client_state_status as never, ops: r.ops }
      : { status: 'not_active' };
  },
  snapshot: () => null,
});

// Резервна копія: кількість рядків і контрольні суми таблиць, які чіпає вікно
async function backup() {
  const out: Record<string, { rows: number; sha: string }> = {};
  for (const t of ['allowed_users', 'progress', 'events', 'feedback']) {
    const rows = (await db.admin.query(`select to_jsonb(x) j from public.${t} x order by 1`)).rows.map((r) => JSON.stringify(r.j));
    out[t] = { rows: rows.length, sha: crypto.createHash('sha256').update(rows.sort().join('\n')).digest('hex').slice(0, 16) };
  }
  const prog = Object.fromEntries((await db.admin.query('select user_id, state from public.progress')).rows.map((r) => [r.user_id, r.state as Snap]));
  return { out, prog };
}
let copy: Awaited<ReturnType<typeof backup>>;

// Інваріант після кожного кроку: у кожного тестера є всі уроки з копії, XP і зароблені монети не менші
async function noLoss(step: string) {
  for (const u of users) {
    const was = copy.prog[u.id];
    if (!was) continue;
    const now = await state(u);
    assert.ok(now, `${step}: рядок ${u.username} зник`);
    for (const l of was.completed) assert.ok(now!.completed.includes(l), `${step}: ${u.username} втратив урок ${l}`);
    assert.ok(Number(now!.xp) >= Number(was.xp), `${step}: ${u.username} XP зменшився`);
    assert.ok(Number(now!.totalCoinsEarned) >= Number(was.totalCoinsEarned), `${step}: ${u.username} зароблені монети зменшились`);
    assert.equal(new Set(now!.completed).size, now!.completed.length, `${step}: ${u.username} дубль уроку`);
  }
}

before(async () => {
  db = await startDb({ upTo: 6 });
  for (let i = 0; i < 4; i++) users.push(await db.newUser(`r${i}`));
});
after(async () => {
  await db?.stop();
});

test('репетиція вікна: копія → 0007 → нова збірка → v2 → відкат → повернення, без втрат і подвоєнь', async () => {
  const [a, b, c, d] = users;
  // 0. Стан b24 на продакшні: прогрес збережено старою функцією, є події
  await legacy(a, snap(['l1', 'l2'], 20, 40));
  await legacy(b, snap(['l1'], 10, 20, { hints: 3 }));
  await legacy(c, snap(['l1', 'l2', 'l3'], 30, 60));
  await db.rpc(a, "insert into public.events (name, build) values ('session_start', 24)");

  // 1. Резервна копія
  copy = await backup();
  assert.equal(copy.out.progress.rows, 3);

  // 2. 0007: режим legacy, старі збірки зберігають із захистом
  await db.applyMigration('0007_progress_v2.sql');
  assert.equal((await loadV2(a)).mode, 'legacy');
  await legacy(b, snap([], 0, 0)); // стара збірка з порожнім знімком: захист не дає затерти
  await legacy(c, snap(['l1', 'l2', 'l3', 'l4'], 40, 80)); // стара збірка проходить урок у legacy
  await noLoss('після 0007');
  const after0007 = await backup();
  assert.equal(after0007.out.events.rows, copy.out.events.rows);
  assert.equal(after0007.out.allowed_users.sha, copy.out.allowed_users.sha); // учётки не змінено

  // 3. Деплой нової збірки: вона копить операції, сервер відповідає not_active
  const qa: SyncState = { queue: [{ opId: 'a-l3', kind: 'lesson', at: 1, lessonId: 'l3', xp: 10, coins: 20 }], rev: 0, base: null, dead: [] };
  const outA = await syncQueue(qa, io(a));
  assert.equal(outA.status, 'not_active');
  assert.equal(qa.queue.length, 1);
  // d — новий тестер, якого не було на сервері; його пристрій переносить локальний стан
  const dLoad = await loadV2(d);
  const qd: SyncState = { queue: legacyOps(d.id, d.id, snap(['l1'], 10, 20, { history: [{ id: 'l1', xp: 10, coins: 20 }] }), dLoad, 1), rev: 0, base: null, dead: [] };
  assert.equal((await syncQueue(qd, io(d))).status, 'not_active');
  await noLoss('нова збірка до перемикання');

  // 4. Перемикання v2: черги доходять, ядро зібрано зі state (урок c/l4 зі старого способу на місці)
  await setMode('v2');
  assert.equal((await syncQueue(qa, io(a))).status, 'done');
  assert.equal((await syncQueue(qd, io(d))).status, 'done');
  assert.equal(qa.queue.length + qd.queue.length, 0);
  assert.deepEqual((await loadV2(c)).core.completed, ['l1', 'l2', 'l3', 'l4']);
  assert.deepEqual((await loadV2(a)).core.completed, ['l1', 'l2', 'l3']);
  assert.equal((await loadV2(d)).core.coins, 20);
  // стара збірка після перемикання нічого не пише
  await legacy(b, snap([], 0, 0));
  assert.deepEqual((await state(b))!.completed, ['l1']);
  await noLoss('після перемикання');

  // 5. 0008 (відгуки). До неї нова збірка пише відгук старим форматом (вид і контекст у тексті) — запис приймається
  await db.rpc(a, "insert into public.feedback (kind, body, screen, build) values ('idea', '[коментар] до 0008 (гілка TOV)', 'map/TOV', 26)");
  await db.rpc(b, "insert into public.feedback (kind, body, screen, build) values ('bug', 'стара збірка', 'lesson', 24)");
  // наявні відгуки порівнюємо за колонками до 0008 (нові branch / sim_step додаються порожніми)
  const oldFb = async () => JSON.stringify((await db.admin.query('select id, user_id, username, kind, screen, lesson_id, step_idx, body, build, created_at from public.feedback order by id')).rows);
  const fbBefore = await oldFb();
  const before0008 = await backup();
  await db.applyMigration('0008_feedback_queue.sql');
  const after0008 = await backup();
  assert.equal(await oldFb(), fbBefore, '0008 не змінює наявних відгуків');
  assert.equal(after0008.out.progress.sha, before0008.out.progress.sha, '0008 не чіпає прогрес');
  await db.rpc(a, "insert into public.feedback (kind, body, screen, branch, sim_step, build) values ('comment', 'після 0008', 'leads', 'TOV', 3, 26)");
  assert.equal(Number(await db.rpc(b, 'select count(*) from public.feedback')), 1, 'тестер бачить лише свій відгук');
  await noLoss('після 0008');

  // 6. Відкат: legacy; стара збірка з застарілим знімком не затирає те, що записано через v2
  await setMode('legacy');
  await legacy(a, snap(['l1'], 10, 20));
  assert.deepEqual((await state(a))!.completed, ['l1', 'l2', 'l3']);
  await legacy(b, snap(['l1', 'l5'], 22, 45, { history: [{ id: 'l5', xp: 12, coins: 25 }] })); // новий урок у відкаті
  await noLoss('після відкату');

  // 7. Повернення вперед: v2; урок зі старого способу в ядрі, повтори без дублів
  await setMode('v2');
  const lb = await loadV2(b);
  assert.deepEqual(lb.core.completed, ['l1', 'l5']);
  const again = await v2(a, 0, [{ opId: 'a-l3', kind: 'lesson', lessonId: 'l3', xp: 10, coins: 20 }]);
  assert.equal((again.ops as unknown as { status: string; duplicate: boolean }[])[0].duplicate, true);
  assert.equal((await loadV2(a)).core.coins, 60);
  await noLoss('після повернення');

  // 8. Перевірка даних після повернення відносно копії: учётки ті самі, подій не поменшало, рядків прогресу +1 (новий тестер d)
  const fin = await backup();
  assert.equal(fin.out.allowed_users.sha, copy.out.allowed_users.sha);
  assert.ok(fin.out.events.rows >= copy.out.events.rows);
  assert.equal(fin.out.feedback.rows, 3, 'відгуки до й після 0008 пережили відкат і повернення');
  assert.equal(fin.out.progress.rows, copy.out.progress.rows + 1);
});
