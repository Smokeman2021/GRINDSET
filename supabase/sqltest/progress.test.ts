// Автотести функцій бази ТЗ-01 v7 на справжньому локальному Postgres (міграції 0001–0007).
// Запуск: cd supabase/sqltest && npm install && npm test
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';
import { coreOf, legacyOps, replay, simLegacySave, simSave, syncQueue } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import type { Op, SaveV2, SimRow, SyncState } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import { chooseProgress } from '../../app-mvp/src/cloud/shared/access.ts';

type OpRes = { opId: string; status: string; duplicate: boolean };
type Core = { completed: string[]; coins: number; xp: number; totalCoinsEarned: number; answersTotal: number; answersCorrect: number; energy: number; hints: number; purchases: number };
type V2 = { status: string; mode: string; rev: number; core: Core; rewarded: string[]; client_state: Record<string, unknown>; client_state_status: string; ops: OpRes[] };
type Loaded = { mode: string; exists: boolean; rev: number; core: Core; rewarded: string[]; state: Record<string, unknown> | null };

let db: Db;
let pre: TestUser; // учётка з прогресом, збереженим ДО міграції 0007

const L = (opId: string, lessonId: string, xp = 10, coins = 20, extra: Record<string, unknown> = {}) => ({ opId, kind: 'lesson', lessonId, xp, coins, ...extra });
const v2 = (u: TestUser, baseRev: number, ops: unknown[], cs: unknown = null) =>
  db.rpc<V2>(u, 'select public.save_progress_v2($1::bigint, $2::jsonb, $3::jsonb)', [baseRev, JSON.stringify(ops), cs === null ? null : JSON.stringify(cs)]);
const legacy = (u: TestUser, state: unknown) => db.rpc<string>(u, 'select public.save_progress($1::jsonb)', [JSON.stringify(state)]);
const load = (u: TestUser) => db.rpc<Loaded>(u, 'select public.load_progress_v2()');
const oldLoad = (u: TestUser) => db.rpc<{ state: Record<string, unknown>; updated_ms: number } | null>(u, 'select public.load_progress()');
const setMode = async (m: 'legacy' | 'v2') => (await db.admin.query('select public.set_progress_write_mode($1) as r', [m])).rows[0].r as { changed: boolean; rows: number };
const row = async (u: TestUser) => (await db.admin.query('select state, rev, core, rewarded, answers_total, answers_correct from public.progress where user_id = $1', [u.id])).rows[0];
const journal = async (u: TestUser) => Number((await db.admin.query('select count(*) n from public.progress_ops where user_id = $1', [u.id])).rows[0].n);
const snap = (completed: string[], xp: number, coins: number, extra: Record<string, unknown> = {}) => ({ completed, xp, coins, totalCoinsEarned: coins, answersTotal: 0, answersCorrect: 0, playerName: 'Тест', ...extra });

before(async () => {
  db = await startDb({ upTo: 6 });
  pre = await db.newUser('pre');
  await legacy(pre, snap(['l1', 'l2'], 20, 40, { answersTotal: 12, answersCorrect: 9 })); // стара функція з 0003
  await db.applyMigration('0007_progress_v2.sql');
  await db.applyMigration('0007_progress_v2.sql'); // повторний запуск файла нічого не ламає
});
after(async () => {
  await db?.stop();
});

test('міграція: наявний рядок отримує rev = 1, ядро зі state, нагороджені = completed; режим legacy', async () => {
  const r = await row(pre);
  assert.equal(Number(r.rev), 1);
  assert.deepEqual(r.core.completed, ['l1', 'l2']);
  assert.equal(r.core.coins, 40);
  assert.deepEqual(r.rewarded, ['l1', 'l2']);
  assert.equal((await load(pre)).mode, 'legacy');
});

test('перемикання режиму доступне лише власнику', async () => {
  const u = await db.newUser();
  await assert.rejects(() => db.rpc(u, "select public.set_progress_write_mode('v2')"), /permission denied|forbidden/);
  assert.equal((await load(u)).mode, 'legacy');
});

test('T1: до перемикання not_active нічого не пише; після перемикання ті самі операції застосовано один раз', async () => {
  await setMode('legacy');
  const u = await db.newUser();
  const ops = [L('t1-a', 'l1'), { opId: 't1-ans', kind: 'answers', total: 5, correct: 4 }];
  const r1 = await v2(u, 0, ops, { playerName: 'A' });
  assert.equal(r1.status, 'not_active');
  assert.equal(await journal(u), 0);
  assert.equal(await row(u), undefined);
  await setMode('v2');
  const r2 = await v2(u, 0, ops, { playerName: 'A' });
  assert.deepEqual(r2.ops.map((o) => o.status), ['applied', 'applied']);
  const r3 = await v2(u, r2.rev, ops);
  assert.deepEqual(r3.ops.map((o) => [o.status, o.duplicate]), [['applied', true], ['applied', true]]);
  assert.deepEqual(r3.core.completed, ['l1']);
  assert.equal(r3.core.xp, 10);
  assert.equal(r3.core.coins, 20);
  assert.equal(r3.core.answersTotal, 5);
});

test('S5: два запити з однією базовою версією, у кожному свій урок: обидва уроки й обидві нагороди', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const a = await v2(u, 0, [L('s5-a', 'l1')]);
  const b = await v2(u, 0, [L('s5-b', 'l2', 12, 25)]);
  assert.equal(a.ops[0].status, 'applied');
  assert.equal(b.ops[0].status, 'applied');
  assert.deepEqual(b.core.completed, ['l1', 'l2']);
  assert.equal(b.core.xp, 22);
  assert.equal(b.core.coins, 45);
  assert.equal(b.core.totalCoinsEarned, 45);
});

test('S6: той самий opId повторно = duplicate з тим самим підсумком; інша операція того ж уроку = already_rewarded; нагорода одна', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await v2(u, 0, [L('s6-a', 'l1')]);
  const dup = await v2(u, 0, [L('s6-a', 'l1')]);
  assert.deepEqual([dup.ops[0].status, dup.ops[0].duplicate], ['applied', true]);
  const other = await v2(u, 0, [L('s6-b', 'l1', 99, 99)]);
  assert.deepEqual([other.ops[0].status, other.ops[0].duplicate], ['already_rewarded', false]);
  assert.equal(other.core.xp, 10);
  assert.equal(other.core.coins, 20);
  assert.deepEqual(other.core.completed, ['l1']);
});

test('S7: сервер записав, відповідь загубилась, клієнт повторює: нагорода не подвоєна', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await v2(u, 0, [L('s7-a', 'l1'), { opId: 's7-q', kind: 'quest', coins: 30 }]); // відповідь «не дійшла»
  const again = await v2(u, 0, [L('s7-a', 'l1'), { opId: 's7-q', kind: 'quest', coins: 30 }]);
  assert.ok(again.ops.every((o) => o.duplicate && o.status === 'applied'));
  assert.equal(again.core.coins, 50);
  assert.equal(again.core.xp, 10);
  assert.equal(await journal(u), 2);
});

test('S9б: початковий стан створюється один раз; другий пристрій додає свої уроки поверх, нагороди не подвоєні', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const initId = `legacy-init:${u.id}`;
  const d1 = await v2(u, 0, [{ opId: initId, kind: 'init', state: snap(['l1'], 10, 20) }]);
  assert.equal(d1.ops[0].status, 'applied');
  const d2 = await v2(u, 0, [{ opId: initId, kind: 'init', state: snap(['l2'], 500, 900) }]);
  assert.deepEqual([d2.ops[0].status, d2.ops[0].duplicate], ['applied', true]);
  assert.deepEqual(d2.core.completed, ['l1']);
  assert.equal(d2.core.coins, 20);
  const d2b = await v2(u, d2.rev, [L(`legacy:${u.id}:l2`, 'l2', 10, 20), L(`legacy:${u.id}:l1`, 'l1', 10, 20)]);
  assert.deepEqual(d2b.ops.map((o) => o.status), ['applied', 'already_rewarded']);
  const d1b = await v2(u, d2b.rev, [L(`legacy:${u.id}:l2`, 'l2', 10, 20)]); // перший пристрій теж знав l2
  assert.deepEqual([d1b.ops[0].status, d1b.ops[0].duplicate], ['applied', true]);
  assert.deepEqual(d1b.core.completed, ['l1', 'l2']);
  assert.equal(d1b.core.coins, 40);
  assert.equal(d1b.core.xp, 20);
  // init для учётки, у якої вже є стан, відхиляється
  const late = await v2(pre, 1, [{ opId: `legacy-init:${pre.id}`, kind: 'init', state: snap([], 0, 0) }]);
  assert.equal(late.ops[0].status, 'rejected_exists');
  assert.deepEqual(late.core.completed, ['l1', 'l2']);
});

test('S10 / T2: стара сигнатура в режимі v2 нічого не пише, подія client_outdated з номером збірки, прогрес не затерто', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await db.rpc(u, "insert into public.events (name, build) values ('session_start', 24)");
  const ok = await v2(u, 0, [L('s10-a', 'l1'), L('s10-b', 'l2')], { playerName: 'Новий' });
  const before = await row(u);
  const ret = await legacy(u, snap([], 0, 0, { playerName: 'Старий' })); // стара збірка з порожнім знімком
  assert.ok(Number(ret) > 0);
  const after_ = await row(u);
  assert.deepEqual(after_, before);
  assert.equal(Number(after_.rev), ok.rev);
  assert.deepEqual(after_.core.completed, ['l1', 'l2']);
  const ev = (await db.admin.query("select name, build, username from public.events where user_id = $1 and name = 'client_outdated'", [u.id])).rows;
  assert.equal(ev.length, 1);
  assert.equal(ev[0].build, 24);
  assert.equal(ev[0].username, u.username);
  await legacy(u, snap([], 0, 0));
  assert.equal((await db.admin.query("select count(*) n from public.events where user_id = $1 and name = 'client_outdated'", [u.id])).rows[0].n, '1'); // не частіше раза на 10 хв
});

test('S11: відхилена трата лишається відхиленою при повторі після поповнення; нова покупка з новим opId проходить', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const r1 = await v2(u, 0, [{ opId: 's11-buy1', kind: 'spend', cost: 50, item: 'hint3' }]); // відповідь «не дійшла»
  assert.equal(r1.ops[0].status, 'rejected_no_coins');
  await v2(u, 0, [L('s11-l', 'l1', 10, 100)]);
  const r2 = await v2(u, 0, [{ opId: 's11-buy1', kind: 'spend', cost: 50, item: 'hint3' }]);
  assert.deepEqual([r2.ops[0].status, r2.ops[0].duplicate], ['rejected_no_coins', true]);
  assert.equal(r2.core.coins, 100);
  assert.equal(r2.core.hints, 0);
  const r3 = await v2(u, 0, [{ opId: 's11-buy2', kind: 'spend', cost: 50, item: 'hint3' }]);
  assert.equal(r3.ops[0].status, 'applied');
  assert.equal(r3.core.coins, 50);
  assert.equal(r3.core.hints, 3);
  assert.equal(r3.core.purchases, 1);
  assert.equal(r3.core.totalCoinsEarned, 100);
});

test('S12 (сервер): запит зі старою версією застосовує операції, але клієнтський знімок не затирає', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const a = await v2(u, 0, [L('s12-1', 'l1')], { playerName: 'Перший', theme: 'night' });
  assert.equal(a.client_state_status, 'saved');
  const b = await v2(u, a.rev, [], { playerName: 'Новіший', theme: 'day' });
  assert.equal(b.client_state_status, 'saved');
  const stale = await v2(u, a.rev, [L('s12-2', 'l2')], { playerName: 'Застарілий', theme: 'night' });
  assert.equal(stale.client_state_status, 'client_state_conflict');
  assert.equal(stale.ops[0].status, 'applied');
  assert.equal(stale.client_state.playerName, 'Новіший');
  assert.equal((await row(u)).state.theme, 'day');
  assert.deepEqual(stale.core.completed, ['l1', 'l2']);
  assert.deepEqual((await row(u)).state.completed, ['l1', 'l2']); // state лишається повним знімком
});

test('перевірки значень: відʼємні, дробові, завеликі й невідомі операції відхиляються і не змінюють ядро', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const r = await v2(u, 0, [
    L('bad-1', 'l1', -5, 10),
    L('bad-2', 'l1', 10, 1.5),
    L('bad-3', 'l1', 999999, 10),
    { opId: 'bad-4', kind: 'answers', total: 3, correct: 5 },
    { opId: 'bad-5', kind: 'spend', cost: 0, item: 'unknown' },
    { opId: 'bad-6', kind: 'whatever' },
    { kind: 'lesson', lessonId: 'l1', xp: 1, coins: 1 },
  ]);
  assert.ok(r.ops.every((o) => o.status === 'rejected_invalid'));
  assert.equal(r.core.xp, 0);
  assert.deepEqual(r.core.completed, []);
  const again = await v2(u, 0, [L('bad-1', 'l1', 10, 10)]); // той самий opId лишається відхиленим
  assert.deepEqual([again.ops[0].status, again.ops[0].duplicate], ['rejected_invalid', true]);
});

test('правила клієнта (applyOp) і SQL-функції дають однакове ядро й однакові підсумки операцій', async () => {
  await setMode('v2');
  const u = await db.newUser();
  const ops: Op[] = [
    { opId: 'p-init', kind: 'init', at: 1, state: { completed: ['l0'], coins: 30, xp: 5, totalCoinsEarned: 40, answersTotal: 4, answersCorrect: 9, energy: 40, energyAt: 1700000000000, frames: ['gold'], hints: 1 } },
    { opId: 'p-1', kind: 'lesson', at: 1, lessonId: 'l1', xp: 10, coins: 20, doubled: true, freezeUsed: true },
    { opId: 'p-2', kind: 'lesson', at: 1, lessonId: 'l0', xp: 10, coins: 20 },
    { opId: 'p-3', kind: 'lesson', at: 1, lessonId: 'practice', xp: 3, coins: 4, repeatable: true },
    { opId: 'p-4', kind: 'answers', at: 1, total: 7, correct: 5 },
    { opId: 'p-5', kind: 'spend', at: 1, cost: 20, item: 'double' },
    { opId: 'p-6', kind: 'spend', at: 1, cost: 10, item: 'freeze' },
    { opId: 'p-6b', kind: 'spend', at: 1, cost: 10, item: 'freeze' },
    { opId: 'p-7', kind: 'spend', at: 1, cost: 5, item: 'frame_neon' },
    { opId: 'p-7a', kind: 'lesson', at: 1, lessonId: 'practice', xp: 2, coins: 6, repeatable: true, doubled: true, freezeUsed: true },
    { opId: 'p-7b', kind: 'lesson', at: 1, lessonId: 'l1', xp: 0, coins: 0, doubled: true, freezeUsed: true },
    { opId: 'p-7c', kind: 'spend', at: 1, cost: 20, item: 'double' },
    { opId: 'p-8', kind: 'spend', at: 1, cost: 5000, item: 'energyFull' },
    { opId: 'p-9', kind: 'spend', at: 1, cost: 5, item: 'energy20' },
    { opId: 'p-10', kind: 'energy', at: 1, energy: 30, energyAt: 1700000001000 },
    { opId: 'p-11', kind: 'quest', at: 1, coins: 15 },
    { opId: 'p-12', kind: 'sim', at: 1, xp: 8, coins: 6 },
    { opId: 'p-13', kind: 'use', at: 1, item: 'hint' },
    { opId: 'p-14', kind: 'use', at: 1, item: 'shield' },
    { opId: 'p-15', kind: 'skip', at: 1, lessons: ['l5', 'l1', 'l6'] },
    { opId: 'p-16', kind: 'init', at: 1, state: { completed: [] } },
    { opId: 'p-17', kind: 'lesson', at: 1, lessonId: 'bad id!', xp: 1, coins: 1 },
    { opId: 'p-18', kind: 'spend', at: 1, cost: 1, item: 'shield3' },
    { opId: 'p-19', kind: 'spend', at: 1, cost: 1, item: 'hint3' },
    { opId: 'p-20', kind: 'spend', at: 1, cost: 1, item: 'energy10' },
  ];
  const sql = await v2(u, 0, ops);
  const sim = simSave('v2', null, 0, ops, null);
  assert.ok(sim.res.status === 'ok');
  assert.deepEqual(sql.ops.map((o) => o.status), sim.res.ops.map((o) => o.status));
  assert.deepEqual(sql.core, sim.res.core);
  assert.deepEqual(sql.rewarded, sim.res.rewarded);
  assert.deepEqual(sql.core, replay(coreOf({}), [], ops, true).core);
});

test('T3: запис старим способом між кроком 1 і перемиканням присутній у ядрі після перемикання', async () => {
  await setMode('legacy');
  const u = await db.newUser();
  await legacy(u, snap(['l1', 'l2'], 20, 40, { answersTotal: 10, answersCorrect: 7 }));
  await setMode('v2');
  const l = await load(u);
  assert.equal(l.mode, 'v2');
  assert.deepEqual(l.core.completed, ['l1', 'l2']);
  assert.equal(l.core.xp, 20);
  assert.deepEqual(l.rewarded, ['l1', 'l2']);
  const r = await v2(u, l.rev, [L(`legacy:${u.id}:l2`, 'l2')]);
  assert.equal(r.ops[0].status, 'already_rewarded');
  assert.equal(r.core.coins, 40);
  const rr = await row(u);
  assert.equal(rr.answers_total, 10);
});

test('RB1: A у v2 → відкат → B старим способом → знову v2: обидва уроки й нагороди на місці, повтори без дублів', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await v2(u, 0, [L('rb1-A', 'A')], { playerName: 'Гравець' });
  await setMode('legacy');
  const old = await oldLoad(u);
  const s = old!.state as { completed: string[]; xp: number; coins: number; totalCoinsEarned: number };
  assert.deepEqual(s.completed, ['A']);
  await legacy(u, { ...s, completed: [...s.completed, 'B'], xp: s.xp + 10, coins: s.coins + 20, totalCoinsEarned: s.totalCoinsEarned + 20 });
  await setMode('v2');
  const l = await load(u);
  assert.deepEqual(l.core.completed, ['A', 'B']);
  assert.equal(l.core.xp, 20);
  assert.equal(l.core.coins, 40);
  const r = await v2(u, l.rev, [L('rb1-A', 'A'), L(`legacy:${u.id}:B`, 'B')]);
  assert.deepEqual(r.ops.map((o) => [o.status, o.duplicate]), [['applied', true], ['already_rewarded', false]]);
  assert.equal(r.core.xp, 20);
  assert.equal(r.core.coins, 40);
  assert.equal(r.core.totalCoinsEarned, 40);
});

test('RB2: після відкату старий знімок з іншого пристрою (без уроку A) не затирає урок A і його нагороду', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await v2(u, 0, [L('rb2-A', 'A')]);
  await setMode('legacy');
  await legacy(u, snap([], 0, 0)); // порожній застарілий знімок
  let r = await row(u);
  assert.deepEqual(r.state.completed, ['A']);
  assert.equal(r.state.xp, 10);
  assert.equal(r.state.coins, 20);
  // застарілий знімок зі своїм новим уроком C: додається C з нагородою з його історії, A лишається
  const stale = snap(['C'], 12, 25, { history: [{ id: 'C', xp: 12, coins: 25 }] });
  await legacy(u, stale);
  await legacy(u, stale); // повтор нічого не додає
  r = await row(u);
  assert.deepEqual(r.state.completed, ['A', 'C']);
  assert.equal(r.state.xp, 22);
  assert.equal(r.state.coins, 45);
  assert.equal(r.state.totalCoinsEarned, 45);
  // покупка старим способом зберігається: витрачене не повертається
  await legacy(u, { ...r.state, coins: 15, hints: 3, purchases: 1 });
  r = await row(u);
  assert.equal(r.state.coins, 15);
  await legacy(u, snap(['A', 'C'], 22, 45)); // знімок «до покупки» монети не повертає
  assert.equal((await row(u)).state.coins, 15);
  await setMode('v2');
  const l = await load(u);
  assert.deepEqual(l.core.completed, ['A', 'C']);
  assert.equal(l.core.coins, 15);
});

test('RB3: старий load_progress після записів через v2 повертає повний знімок', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await v2(u, 0, [L('rb3-a', 'l1'), { opId: 'rb3-ans', kind: 'answers', total: 4, correct: 3 }], { playerName: 'Повний', theme: 'day', history: [{ id: 'l1', xp: 10, coins: 20 }] });
  const old = await oldLoad(u);
  assert.equal(old!.state.playerName, 'Повний');
  assert.equal(old!.state.theme, 'day');
  assert.deepEqual(old!.state.completed, ['l1']);
  assert.equal(old!.state.xp, 10);
  assert.equal(old!.state.coins, 20);
  assert.equal(old!.state.answersTotal, 4);
  assert.equal(Number(old!.updated_ms), 0); // режим v2: стара збірка не тягне серверний стан поверх локального
  await setMode('legacy');
  assert.ok(Number((await oldLoad(u))!.updated_ms) > 0); // після відкату позначка справжня
  await setMode('v2');
});

test('RB4: запит, початий до перемикання, завершується до нього; запит після перемикання бачить новий режим', async () => {
  await setMode('legacy');
  const u = await db.newUser();
  const w = await db.connect();
  const pending = (p: Promise<unknown>) => Promise.race([p.then(() => 'done'), new Promise((r) => setTimeout(() => r('waiting'), 500))]);

  // (а) старий спосіб уже пише (транзакція відкрита) → перемикання чекає; після завершення запису він є в ядрі
  await db.begin(u, w);
  await w.query('select public.save_progress($1::jsonb)', [JSON.stringify(snap(['l1'], 10, 20))]);
  const sw = db.admin.query("select public.set_progress_write_mode('v2') as r");
  assert.equal(await pending(sw), 'waiting');
  await w.query('commit');
  assert.equal((await sw).rows[0].r.changed, true);
  assert.deepEqual((await load(u)).core.completed, ['l1']);

  // (б) перемикання ще не завершене (транзакція відкрита) → новий спосіб чекає й бачить уже режим legacy: нічого не пише
  await db.admin.query('begin');
  await db.admin.query("select public.set_progress_write_mode('legacy')");
  const sv = v2(u, 0, [L('rb4-x', 'l2')], null);
  assert.equal(await pending(sv), 'waiting');
  await db.admin.query('commit');
  assert.equal((await sv).status, 'not_active');
  assert.equal(await journal(u), 0);
  assert.deepEqual((await row(u)).state.completed, ['l1']);

  // (в) дзеркально: перемикання в v2 відкрите → старий спосіб чекає, після нього вже нічого не пише
  await db.admin.query('begin');
  await db.admin.query("select public.set_progress_write_mode('v2')");
  await db.begin(u, w);
  const lg = w.query('select public.save_progress($1::jsonb)', [JSON.stringify(snap([], 0, 0))]);
  assert.equal(await pending(lg), 'waiting');
  await db.admin.query('commit');
  await lg;
  await w.query('commit');
  assert.deepEqual((await load(u)).core.completed, ['l1']);
  await w.end();
});

// ───────── Етап A (ТЗ 004) ─────────
// Справжній цикл відправки клієнта (syncQueue) поверх справжньої функції бази
const sqlIo = (u: TestUser, opts: { loseCall?: number; snapshot?: () => Record<string, unknown> | null } = {}) => {
  const calls: { baseRev: number; ops: number; snapshot: boolean }[] = [];
  return {
    calls,
    io: {
      send: async (baseRev: number, ops: Op[], cs: Record<string, unknown> | null): Promise<SaveV2> => {
        calls.push({ baseRev, ops: ops.length, snapshot: !!cs });
        const r = await v2(u, baseRev, ops, cs);
        if (opts.loseCall === calls.length) throw new Error('Failed to fetch'); // база записала, відповідь не дійшла
        if (r.status !== 'ok') return { status: 'not_active' };
        return { status: 'ok', rev: Number(r.rev), core: r.core as never, rewarded: r.rewarded, clientState: r.client_state, clientStateStatus: r.client_state_status as never, ops: r.ops as never };
      },
      snapshot: opts.snapshot ?? (() => null),
    },
  };
};
const mixedOps = (n: number): Op[] =>
  Array.from({ length: n }, (_, i): Op => {
    const at = 1000 + i;
    const k = i % 8;
    if (k === 0) return { opId: `m${i}`, kind: 'lesson', at, lessonId: `l${i}`, xp: 10 + (i % 7), coins: 20 + (i % 5) };
    if (k === 1) return { opId: `m${i}`, kind: 'answers', at, total: 6, correct: i % 7 };
    if (k === 2) return { opId: `m${i}`, kind: 'energy', at, energy: 50 - (i % 50), energyAt: 1700000000000 + i };
    if (k === 3) return { opId: `m${i}`, kind: 'spend', at, cost: 60, item: 'shield3' };
    if (k === 4) return { opId: `m${i}`, kind: 'quest', at, coins: 15 };
    if (k === 5) return { opId: `m${i}`, kind: 'lesson', at, lessonId: 'practice', xp: 4, coins: 5, repeatable: true };
    if (k === 6) return { opId: `m${i}`, kind: 'lesson', at, lessonId: `l${i - 6}`, xp: 0, coins: 0 };
    return { opId: `m${i}`, kind: 'spend', at, cost: 100000, item: 'energyFull' };
  });
const freshState = (queue: Op[]): SyncState => ({ queue, rev: 0, base: null, dead: [] });

test('ліміт пакета: понад 500 операцій або понад 1 000 000 байт відхиляється цілком, нічого не записано', async () => {
  await setMode('v2');
  const u = await db.newUser();
  await assert.rejects(() => v2(u, 0, mixedOps(501)), /too_many_ops/);
  assert.equal(await journal(u), 0);
  await assert.rejects(() => v2(u, 0, [L('big-1', 'l1')], { blob: Array.from({ length: 60000 }, (_, i) => `рядок-${i}-${Math.random()}`) }), /state_too_large/);
  assert.equal(await journal(u), 0);
  assert.equal(await row(u), undefined);
  const ok = await v2(u, 0, mixedOps(500));
  assert.equal(ok.ops.length, 500);
});

test('P1: 620 операцій порціями, відповідь на другу порцію загублено, повтор: уся черга в базі, нагороди не подвоєні, підсумок як без втрати', async () => {
  await setMode('v2');
  const ref = await db.newUser();
  const lossy = await db.newUser();
  const a = sqlIo(ref, { snapshot: () => ({ theme: 'day' }) });
  const stA = freshState(mixedOps(620));
  const outA = await syncQueue(stA, a.io);
  assert.equal(outA.portions, 4);
  assert.deepEqual(a.calls.map((c) => [c.ops, c.snapshot]), [[200, false], [200, false], [200, false], [20, true]]);

  const b = sqlIo(lossy, { loseCall: 2, snapshot: () => ({ theme: 'day' }) });
  const stB = freshState(mixedOps(620));
  await assert.rejects(() => syncQueue(stB, b.io), /Failed to fetch/);
  assert.equal(stB.queue.length, 420);
  assert.equal(await journal(lossy), 400);
  const outB = await syncQueue(stB, b.io);
  assert.equal(outB.status, 'done');
  assert.equal(outB.snapshot, 'saved');
  assert.equal(stB.queue.length, 0);
  assert.equal(stB.dead.length, 0);
  assert.equal(await journal(lossy), 620);
  const ra = await row(ref);
  const rb = await row(lossy);
  assert.deepEqual(rb.core, ra.core);
  assert.deepEqual(rb.rewarded, ra.rewarded);
  assert.deepEqual(rb.core, replay(coreOf({}), [], mixedOps(620), true).core);
  assert.equal(rb.state.theme, 'day');
  assert.equal(rb.answers_total, ra.answers_total);
});

test('старий спосіб: правила імітації (simLegacySave) і функції бази дають однаковий стан', async () => {
  await setMode('legacy');
  const u = await db.newUser();
  let sim: SimRow | null = null;
  const steps: Record<string, unknown>[] = [
    snap(['l1', 'l2'], 20, 40, { answersTotal: 10, answersCorrect: 7, hints: 3, frames: ['gold'] }),
    snap(['l1', 'l2', 'l3'], 35, 30, { totalCoinsEarned: 60, answersTotal: 16, answersCorrect: 11, purchases: 1 }), // урок і покупка
    snap(['l1'], 10, 20), // застарілий знімок
    snap(['l1', 'l9'], 17, 29, { history: [{ id: 'l9', xp: 3, coins: 4 }, { id: 'l9', xp: 7, coins: 9 }, { id: 'l1', xp: 10, coins: 20 }], frames: ['neon'] }), // відсталий пристрій зі своїм уроком
    snap(['l1', 'l9'], 17, 29, { history: [{ id: 'l9', xp: 7, coins: 9 }] }), // той самий знімок повторно
    snap(['l1', 'l2', 'l3', 'l9', 'l4'], 500, 5, { totalCoinsEarned: 900, answersTotal: 3, answersCorrect: 3 }),
  ];
  for (const [i, st] of steps.entries()) {
    await legacy(u, st);
    sim = simLegacySave('legacy', sim, st).row;
    const r = await row(u);
    assert.deepEqual(coreOf(r.state), sim!.core, `крок ${i + 1}`);
    assert.equal(Number(r.rev), sim!.rev, `rev, крок ${i + 1}`);
  }
});

// P2. Модель старої збірки: вона зберігала ВЕСЬ стан старою функцією і при запуску вирішувала, чий стан брати, функцією chooseProgress
// (справжній код старої збірки, досі лежить у shared/access.ts).
async function p2Setup() {
  await setMode('legacy');
  const u = await db.newUser();
  const hist1 = [{ id: 'l1', xp: 10, coins: 20 }];
  const t0 = Number(await legacy(u, snap(['l1'], 10, 20, { history: hist1 })));
  await setMode('v2');
  // стара збірка завершує урок l2 ПІСЛЯ перемикання: сервер нічого не приймає
  const local = snap(['l1', 'l2'], 22, 45, { history: [{ id: 'l2', xp: 12, coins: 25 }, ...hist1] });
  const ret = Number(await legacy(u, local));
  assert.deepEqual((await row(u)).core.completed, ['l1']);
  return { u, local, meta: { userId: u.id, updatedAt: ret }, t0 };
}
async function newBuildMigrates(u: TestUser, local: Record<string, unknown>) {
  const srv = await load(u);
  const ops = legacyOps(u.id, u.id, local, srv, 5);
  const st: SyncState = { queue: ops, rev: srv.rev, base: null, dead: [] };
  await syncQueue(st, sqlIo(u).io);
  return { ops, st };
}

test('P2 (повернення в застосунок): урок старої збірки після перемикання перенесено legacy:<учётка>:<урок>, на другому пристрої один раз', async () => {
  const { u, local } = await p2Setup();
  // застосунок повернувся з фону: перевірка версії перезавантажує на нову збірку, локальні дані з міткою цієї учётки лишаються
  const first = await newBuildMigrates(u, local);
  assert.deepEqual(first.ops.map((o) => o.opId), [`legacy:${u.id}:l2`]);
  assert.equal(first.st.queue.length, 0);
  let r = await row(u);
  assert.deepEqual(r.core.completed, ['l1', 'l2']);
  assert.equal(r.core.coins, 45);
  assert.equal(r.core.xp, 22);
  // другий пристрій: бачить урок один раз; якщо в нього лежить та сама стара копія, повторне перенесення нічого не додає
  const second = await load(u);
  assert.equal(second.core.completed.filter((x) => x === 'l2').length, 1);
  const dup = await v2(u, second.rev, [L(`legacy:${u.id}:l2`, 'l2', 12, 25)]);
  assert.deepEqual([dup.ops[0].status, dup.ops[0].duplicate], ['applied', true]);
  r = await row(u);
  assert.equal(r.core.coins, 45);
  assert.equal(r.core.xp, 22);
  assert.equal(legacyOps(u.id, u.id, local, await load(u), 6).length, 0); // повторний запуск нової збірки нічого не переносить
});

test('P2 (холодний старт старої збірки): серверний знімок не лягає поверх локального, урок доживає до нової збірки', async () => {
  const { u, local, meta } = await p2Setup();
  // тим часом інший пристрій з новою збіркою записав свій урок: серверний стан став новішим
  const other = await load(u);
  await v2(u, other.rev, [L('other-l3', 'l3')], { playerName: 'Інший пристрій' });
  const realUpdated = Number((await db.admin.query('select (extract(epoch from updated_at) * 1000)::bigint ms from public.progress where user_id = $1', [u.id])).rows[0].ms);
  // холодний старт старої збірки з кешу
  const old = await oldLoad(u);
  const base = { localUserId: meta.userId, localUpdatedAt: meta.updatedAt, userId: u.id, localCompleted: 2, serverCompleted: (old!.state.completed as string[]).length };
  assert.equal(chooseProgress({ ...base, serverUpdatedAt: Number(old!.updated_ms) }), 'push'); // локальний стан лишається
  assert.equal(chooseProgress({ ...base, serverUpdatedAt: realUpdated + 1000 }), 'pull'); // без заходу (позначка 0) стара збірка взяла б серверний стан і загубила l2
  await legacy(u, local); // її «push» у режимі v2 нічого не пише
  assert.deepEqual((await row(u)).core.completed, ['l1', 'l3']);
  // далі перевірка версії перезавантажує на нову збірку, і вона переносить урок
  await newBuildMigrates(u, local);
  const r = await row(u);
  assert.deepEqual(r.core.completed, ['l1', 'l3', 'l2']);
  assert.equal(r.core.coins, 20 + 20 + 25);
  assert.equal(r.core.xp, 10 + 10 + 12);
  assert.equal((await load(u)).core.completed.filter((x) => x === 'l2').length, 1);
});
