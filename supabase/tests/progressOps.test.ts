// Автотести клієнтської логіки ТЗ-01 (черга операцій, перенесення, конфлікт знімка). Без мережі й бази:
// сервер імітується тими самими правилами (simSave), а їх збіг зі справжньою SQL-функцією перевіряє supabase/sqltest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOp, coreOf, legacyOps, mergeClientState, replay, settle, simLoad, simSave, staleInfo, STALE_MS } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import type { Core, Op, SaveV2, SimRow } from '../../app-mvp/src/cloud/shared/progressOps.ts';

const L = (opId: string, lessonId: string, xp = 10, coins = 20): Op => ({ opId, kind: 'lesson', at: 1000, lessonId, xp, coins });

// Мінімальна модель пристрою: черга + останнє серверне ядро. Повторює кроки progressSync.flush.
class Device {
  queue: Op[] = [];
  base: { core: Core; rewarded: string[]; pristine: boolean } = { core: coreOf({}), rewarded: [], pristine: true };
  rev = 0;
  server: { mode: 'legacy' | 'v2'; row: SimRow | null };
  constructor(server: { mode: 'legacy' | 'v2'; row: SimRow | null }) {
    this.server = server;
  }
  load() {
    const l = simLoad(this.server.mode, this.server.row);
    this.base = { core: l.core, rewarded: l.rewarded, pristine: !l.exists };
    this.rev = l.rev;
    return l;
  }
  visible() {
    return replay(this.base.core, this.base.rewarded, this.queue, this.base.pristine).core;
  }
  // deliver = false: сервер записав, але відповідь не дійшла
  send(deliver = true, clientState: Record<string, unknown> | null = null): SaveV2 | null {
    const out = simSave(this.server.mode, this.server.row, this.rev, this.queue.slice(), clientState);
    this.server.row = out.row;
    if (!deliver) return null;
    this.receive(out.res);
    return out.res;
  }
  receive(res: SaveV2) {
    if (res.status !== 'ok') return;
    this.queue = settle(this.queue, res.ops);
    this.base = { core: res.core, rewarded: res.rewarded, pristine: false };
    this.rev = res.rev;
  }
}

test('операції: повтор уроку = already_rewarded, трата без монет = rejected_no_coins, тренування нараховується щоразу', () => {
  let s = applyOp(coreOf({}), [], L('a', 'l1'));
  assert.equal(s.status, 'applied');
  s = applyOp(s.core, s.rewarded, L('b', 'l1', 99, 99));
  assert.equal(s.status, 'already_rewarded');
  assert.equal(s.core.coins, 20);
  const poor = applyOp(s.core, s.rewarded, { opId: 'c', kind: 'spend', at: 1, cost: 50, item: 'hint3' });
  assert.equal(poor.status, 'rejected_no_coins');
  assert.equal(poor.core.coins, 20);
  let p = applyOp(s.core, s.rewarded, { ...L('d', 'practice', 5, 4), repeatable: true });
  p = applyOp(p.core, p.rewarded, { ...L('e', 'practice', 5, 4), repeatable: true });
  assert.equal(p.core.xp, 20);
  assert.deepEqual(p.core.completed, ['l1']);
  assert.equal(applyOp(s.core, s.rewarded, L('f', 'l2', -1, 5)).status, 'rejected_invalid');
});

test('S7: сервер записав, відповідь загубилась → клієнт повторює → нагорода не подвоєна, черга закрита', () => {
  const server = { mode: 'v2' as const, row: null as SimRow | null };
  const d = new Device(server);
  d.load();
  d.queue.push(L('s7', 'l1'));
  d.send(false); // відповідь не дійшла: операція лишається в черзі
  assert.equal(d.queue.length, 1);
  assert.equal(d.visible().coins, 20);
  const res = d.send();
  assert.ok(res && res.status === 'ok' && res.ops[0].duplicate && res.ops[0].status === 'applied');
  assert.equal(d.queue.length, 0);
  assert.equal(d.visible().coins, 20);
  assert.equal(server.row!.core.xp, 10);
});

test('S12: урок 2 пройдено, поки запит з уроком 1 у дорозі → урок 2 лишається видимим і потім зберігається; старий запит нічого не затирає', () => {
  const server = { mode: 'v2' as const, row: null as SimRow | null };
  const d = new Device(server);
  d.load();
  d.queue.push(L('s12-1', 'l1'));
  const inFlight = simSave(server.mode, server.row, d.rev, d.queue.slice(), { theme: 'night' }); // запит пішов
  server.row = inFlight.row;
  d.queue.push(L('s12-2', 'l2', 12, 25)); // учень завершує урок 2
  d.receive(inFlight.res); // приходить відповідь на перший запит
  assert.deepEqual(d.queue.map((o) => o.opId), ['s12-2']);
  assert.deepEqual(d.visible().completed, ['l1', 'l2']); // урок 2 видно, хоч сервер про нього ще не знає
  assert.equal(d.visible().coins, 45);
  assert.deepEqual(server.row!.core.completed, ['l1']);
  d.send(true, { theme: 'day' });
  assert.deepEqual(server.row!.core.completed, ['l1', 'l2']);
  assert.equal(d.queue.length, 0);
  // повтор першого запиту зі старою версією: операція = duplicate, знімок не пишеться
  const stale = simSave(server.mode, server.row, 0, [L('s12-1', 'l1')], { theme: 'night' });
  assert.ok(stale.res.status === 'ok' && stale.res.clientStateStatus === 'client_state_conflict' && stale.res.ops[0].duplicate);
  assert.equal(stale.row!.state.theme, 'day');
  assert.deepEqual(stale.row!.core.completed, ['l1', 'l2']);
});

test('T1: клієнт відкрито до перемикання → not_active не губить операції → після перемикання урок і нагорода один раз', () => {
  const server = { mode: 'legacy' as 'legacy' | 'v2', row: null as SimRow | null };
  const d = new Device(server);
  d.load();
  d.queue.push(L('t1', 'l1'));
  const r1 = d.send();
  assert.equal(r1!.status, 'not_active');
  assert.equal(d.queue.length, 1);
  assert.equal(server.row, null); // новим способом нічого не записано
  assert.deepEqual(d.visible().completed, ['l1']); // учень бачить свій урок
  server.mode = 'v2';
  d.send();
  d.queue.push(L('t1', 'l1')); // випадковий повтор тієї самої операції
  d.send();
  assert.equal(d.queue.length, 0);
  assert.deepEqual(server.row!.core.completed, ['l1']);
  assert.equal(server.row!.core.coins, 20);
});

test('S9а: локально пройдено A, на сервері B → обидва пройдені; баланси = серверні + нагорода за A з історії; повторний запуск нічого не додає', () => {
  const uid = 'u1';
  const first = simSave('v2', null, 0, [L('srv-b', 'B', 30, 50)], { playerName: 'X' });
  const server = { mode: 'v2' as const, row: first.row };
  const local = { completed: ['A'], coins: 999, xp: 999, totalCoinsEarned: 999, history: [{ id: 'A', xp: 5, coins: 10 }, { id: 'A', xp: 10, coins: 20 }] };
  const d = new Device(server);
  const l = d.load();
  const ops = legacyOps(uid, uid, local, l, 1);
  assert.deepEqual(ops.map((o) => o.opId), [`legacy:${uid}:A`]);
  assert.deepEqual([ops[0].xp, ops[0].coins], [10, 20]); // перше проходження = найстаріший запис історії
  d.queue.push(...ops);
  d.send();
  assert.deepEqual(server.row!.core.completed, ['B', 'A']);
  assert.equal(server.row!.core.coins, 70); // локальні 999 не переносяться
  assert.equal(server.row!.core.xp, 40);
  const d2 = new Device(server); // повторний запуск / другий пристрій з тими самими даними
  d2.queue.push(...legacyOps(uid, uid, local, simLoad('v2', null), 1).filter((o) => o.kind === 'lesson'));
  d2.load();
  d2.send();
  assert.equal(server.row!.core.coins, 70);
  assert.equal(legacyOps(uid, uid, local, d2.load(), 1).length, 0);
});

test('S9б: сервер порожній, на двох пристроях різні уроки → початковий стан один раз, другий пристрій додає свої уроки; нагороди не подвоєні', () => {
  const uid = 'u2';
  const server = { mode: 'v2' as const, row: null as SimRow | null };
  const localA = { completed: ['A'], coins: 20, xp: 10, totalCoinsEarned: 20, history: [{ id: 'A', xp: 10, coins: 20 }] };
  const localB = { completed: ['B'], coins: 25, xp: 12, totalCoinsEarned: 25, history: [{ id: 'B', xp: 12, coins: 25 }] };
  const dA = new Device(server);
  const dB = new Device(server);
  dA.queue.push(...legacyOps(uid, uid, localA, dA.load(), 1)); // обидва пристрої бачать порожній сервер
  dB.queue.push(...legacyOps(uid, uid, localB, dB.load(), 1));
  assert.equal(dA.queue[0].opId, `legacy-init:${uid}`);
  assert.equal(dB.queue[0].opId, `legacy-init:${uid}`);
  assert.equal(dA.visible().coins, 20); // до відповіді сервера учень бачить свій баланс
  const rA = dA.send();
  const rB = dB.send();
  assert.ok(rA && rA.status === 'ok' && rB && rB.status === 'ok');
  assert.deepEqual(rA.ops.map((o) => o.status), ['applied', 'already_rewarded']);
  assert.deepEqual(rB.ops.map((o) => [o.status, o.duplicate]), [['applied', true], ['applied', false]]);
  assert.deepEqual(server.row!.core.completed, ['A', 'B']);
  assert.equal(server.row!.core.coins, 45);
  assert.equal(server.row!.core.xp, 22);
  dA.queue.push(...legacyOps(uid, uid, localA, dA.load(), 1));
  dA.send();
  assert.equal(server.row!.core.coins, 45);
});

test('S9в: локальні дані з чужою міткою власника або без мітки не переносяться', () => {
  const local = { completed: ['A', 'B'], coins: 100, xp: 50 };
  const empty = simLoad('v2', null);
  assert.equal(legacyOps('me', 'other', local, empty, 1).length, 0);
  assert.equal(legacyOps('me', null, local, empty, 1).length, 0);
  assert.equal(legacyOps('me', 'me', local, empty, 1).length, 3);
  // урок без запису в історії переноситься як пройдений без нагороди
  const ops = legacyOps('me', 'me', local, empty, 1);
  assert.deepEqual([ops[1].xp, ops[1].coins], [0, 0]);
  assert.equal(legacyOps('me', 'me', {}, empty, 1).length, 0); // порожній стан: переносити нічого
});

test('черга: знімаються лише операції з відповіддю сервера; застарілість після 10 хвилин', () => {
  const q = [L('a', 'l1'), L('b', 'l2'), L('c', 'l3')];
  assert.deepEqual(settle(q, [{ opId: 'a', status: 'applied', duplicate: false }, { opId: 'c', status: 'rejected_invalid', duplicate: false }]).map((o) => o.opId), ['b']);
  assert.equal(staleInfo([], 5000).stale, false);
  assert.equal(staleInfo(q, 1000 + STALE_MS - 1).stale, false);
  const st = staleInfo(q, 1000 + STALE_MS + 60000);
  assert.deepEqual([st.stale, st.ops, st.oldestMin], [true, 3, 11]);
});

test('конфлікт клієнтського знімка: налаштування з пристрою, списки обʼєднуються', () => {
  const local = { theme: 'day', playerName: 'Я', unlocked: ['a1'], history: [{ id: 'l2', date: '2026-11-16T10:00:00Z' }], mistakes: [{ lessonId: 'l1', idx: 2 }], srs: { k1: 1 }, questsDate: 'd', questsClaimed: ['q1'] };
  const server = { theme: 'night', sceneMode: 'off', unlocked: ['a2', 'a1'], history: [{ id: 'l1', date: '2026-11-15T10:00:00Z' }, { id: 'l2', date: '2026-11-16T10:00:00Z' }], mistakes: [{ lessonId: 'l1', idx: 2 }, { lessonId: 'l3', idx: 0 }], srs: { k2: 2 }, questsDate: 'd', questsClaimed: ['q2'] };
  const m = mergeClientState(local, server);
  assert.equal(m.theme, 'day');
  assert.equal(m.sceneMode, 'off');
  assert.deepEqual(m.unlocked, ['a1', 'a2']);
  assert.deepEqual((m.history as { id: string }[]).map((h) => h.id), ['l2', 'l1']);
  assert.equal((m.mistakes as unknown[]).length, 2);
  assert.deepEqual(m.srs, { k2: 2, k1: 1 });
  assert.deepEqual(m.questsClaimed, ['q1', 'q2']);
});
