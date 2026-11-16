// Автотести етапу A (ТЗ 004): порції відправки, P1, ліміти без зациклення, таблиця «b24 / зараз», режим запису в імітації.
// Цикл відправки тут СПРАВЖНІЙ (shared/progressOps.syncQueue, той самий, що викликає progressSync.flush); сервер імітується simSave.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_MAX_BYTES,
  BATCH_MAX_OPS,
  SNAPSHOT_MAX_BYTES,
  applyOp,
  coreOf,
  legacyOps,
  nextBatch,
  replay,
  simLegacySave,
  simLoad,
  simSave,
  simSwitchToV2,
  syncQueue,
  utf8Length,
} from '../../app-mvp/src/cloud/shared/progressOps.ts';
import type { Core, Op, SaveV2, SimRow, SyncState } from '../../app-mvp/src/cloud/shared/progressOps.ts';

// 620 різних операцій, як після довгого офлайну: уроки, відповіді, енергія, покупки (частина без монет), завдання, симулятор, підказки
function offlineOps(n: number): Op[] {
  const ops: Op[] = [];
  for (let i = 0; i < n; i++) {
    const at = 1000 + i;
    const k = i % 10;
    if (k === 0) ops.push({ opId: `o${i}`, kind: 'lesson', at, lessonId: `l${i}`, xp: 10 + (i % 7), coins: 20 + (i % 5) });
    else if (k === 1) ops.push({ opId: `o${i}`, kind: 'answers', at, total: 6, correct: i % 7 });
    else if (k === 2) ops.push({ opId: `o${i}`, kind: 'energy', at, energy: 50 - (i % 50), energyAt: 1700000000000 + i });
    else if (k === 3) ops.push({ opId: `o${i}`, kind: 'spend', at, cost: 60, item: i % 20 === 3 ? 'hint3' : 'shield3' });
    else if (k === 4) ops.push({ opId: `o${i}`, kind: 'quest', at, coins: 15 });
    else if (k === 5) ops.push({ opId: `o${i}`, kind: 'sim', at, xp: 8, coins: 6 });
    else if (k === 6) ops.push({ opId: `o${i}`, kind: 'use', at, item: i % 20 === 6 ? 'hint' : 'shield' });
    else if (k === 7) ops.push({ opId: `o${i}`, kind: 'lesson', at, lessonId: 'practice', xp: 4, coins: 5, repeatable: true });
    else if (k === 8) ops.push({ opId: `o${i}`, kind: 'lesson', at, lessonId: `l${i - 8}`, xp: 0, coins: 0 }); // повтор пройденого
    else ops.push({ opId: `o${i}`, kind: 'spend', at, cost: 100000, item: 'energyFull' }); // відхилена трата
  }
  return ops;
}

type Call = { baseRev: number; ops: number; snapshot: boolean };
function serverIo(server: { mode: 'legacy' | 'v2'; row: SimRow | null }, opts: { loseCall?: number; snapshot?: () => Record<string, unknown> | null } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    io: {
      send: async (baseRev: number, ops: Op[], clientState: Record<string, unknown> | null): Promise<SaveV2> => {
        calls.push({ baseRev, ops: ops.length, snapshot: !!clientState });
        const out = simSave(server.mode, server.row, baseRev, ops, clientState);
        server.row = out.row;
        if (opts.loseCall === calls.length) throw new Error('Failed to fetch'); // сервер записав, відповідь не дійшла
        return out.res;
      },
      snapshot: opts.snapshot ?? (() => null),
    },
  };
}
const fresh = (queue: Op[]): SyncState => ({ queue, rev: 0, base: null, dead: [] });

test('порції: не більше 200 операцій і 256 КБ; одна велика операція йде окремо', () => {
  const ops = offlineOps(620);
  assert.equal(nextBatch(ops).length, BATCH_MAX_OPS);
  assert.equal(nextBatch(ops.slice(600)).length, 20);
  const fat = (i: number): Op => ({ opId: `f${i}`, kind: 'skip', at: 1, lessons: Array.from({ length: 400 }, (_, j) => `lesson-with-a-long-identifier-${i}-${j}-${'x'.repeat(30)}`) });
  const big = Array.from({ length: 30 }, (_, i) => fat(i));
  const b = nextBatch(big);
  assert.ok(b.length >= 1 && b.length < 30);
  assert.ok(utf8Length(JSON.stringify(b)) <= BATCH_MAX_BYTES);
  assert.equal(nextBatch([{ opId: 'huge', kind: 'init', at: 1, state: { blob: 'я'.repeat(400000) } }, ops[0]]).length, 1);
  assert.equal(utf8Length('aя€😀'), 1 + 2 + 3 + 4);
});

test('P1: офлайн 620 операцій → мережа → відповідь на другу порцію загублено → повтор: уся черга на сервері, нагороди не подвоєні', async () => {
  // еталон: та сама черга без втрати відповіді
  const refServer = { mode: 'v2' as const, row: null as SimRow | null };
  const refState = fresh(offlineOps(620));
  const ref = serverIo(refServer, { snapshot: () => ({ theme: 'day' }) });
  const refOut = await syncQueue(refState, ref.io);
  assert.equal(refOut.portions, 4);
  assert.deepEqual(ref.calls.map((c) => c.ops), [200, 200, 200, 20]);
  assert.deepEqual(ref.calls.map((c) => c.snapshot), [false, false, false, true]); // клієнтський знімок з останньою порцією
  assert.deepEqual(ref.calls.map((c) => c.baseRev), [0, 1, 2, 3]); // кожна порція з актуальною версією

  const server = { mode: 'v2' as const, row: null as SimRow | null };
  const st = fresh(offlineOps(620));
  const lossy = serverIo(server, { loseCall: 2, snapshot: () => ({ theme: 'day' }) });
  await assert.rejects(() => syncQueue(st, lossy.io), /Failed to fetch/);
  assert.equal(st.queue.length, 420); // друга порція лишилась у черзі: відповіді не було
  assert.equal(st.rev, 1);
  assert.equal(Object.keys(server.row!.journal).length, 400); // але сервер її вже записав
  const out = await syncQueue(st, lossy.io); // повтор (у застосунку: таймер, online, повернення у вкладку)
  assert.equal(out.status, 'done');
  assert.equal(st.queue.length, 0);
  assert.equal(st.dead.length, 0);
  assert.deepEqual(lossy.calls.map((c) => c.ops), [200, 200, 200, 200, 20]);
  assert.equal(Object.keys(server.row!.journal).length, 620);
  assert.deepEqual(server.row!.core, refServer.row!.core); // підсумок дорівнює підсумку без втрати відповіді
  assert.deepEqual(server.row!.rewarded, refServer.row!.rewarded);
  assert.deepEqual(server.row!.core, replay(coreOf({}), [], offlineOps(620), true).core);
  assert.equal(server.row!.state.theme, 'day');
  // учень увесь час бачить повний підсумок: серверне ядро + те, що ще в черзі
  const mid = fresh(offlineOps(620));
  const midServer = { mode: 'v2' as const, row: null as SimRow | null };
  const seen: Core[] = [];
  await syncQueue(mid, { ...serverIo(midServer).io, afterPortion: () => void seen.push(replay(mid.base!.core, mid.base!.rewarded, mid.queue).core) });
  assert.equal(seen.length, 4);
  for (const c of seen) assert.deepEqual(c, refServer.row!.core);
});

test('ліміт сервера не зациклює порцію: порція зменшується, непрохідна операція відкладається, решта черги доходить', async () => {
  // (а) сервер приймає не більше 60 операцій за виклик
  const server = { mode: 'v2' as const, row: null as SimRow | null };
  let calls = 0;
  const st = fresh(offlineOps(300));
  const out = await syncQueue(st, {
    send: async (baseRev, ops, cs) => {
      calls += 1;
      if (ops.length > 60) throw new Error('too_many_ops');
      const r = simSave(server.mode, server.row, baseRev, ops, cs);
      server.row = r.row;
      return r.res;
    },
    snapshot: () => null,
  });
  assert.equal(out.status, 'done');
  assert.equal(st.queue.length, 0);
  assert.equal(Object.keys(server.row!.journal).length, 300);
  assert.ok(calls < 20, `викликів: ${calls}`);

  // (б) одна операція сама не проходить ліміт розміру: відкладена, інші доставлені, цикл завершився
  const server2 = { mode: 'v2' as const, row: null as SimRow | null };
  const q = offlineOps(30);
  q.splice(10, 0, { opId: 'too-big', kind: 'skip', at: 1, lessons: ['x'] });
  const st2 = fresh(q);
  let calls2 = 0;
  const out2 = await syncQueue(st2, {
    send: async (baseRev, ops, cs) => {
      calls2 += 1;
      if (ops.some((o) => o.opId === 'too-big')) throw new Error('state_too_large');
      const r = simSave(server2.mode, server2.row, baseRev, ops, cs);
      server2.row = r.row;
      return r.res;
    },
    snapshot: () => null,
  });
  assert.equal(out2.quarantined, 1);
  assert.deepEqual(st2.dead.map((o) => o.opId), ['too-big']);
  assert.equal(st2.queue.length, 0);
  assert.equal(Object.keys(server2.row!.journal).length, 30);
  assert.ok(calls2 < 20, `викликів: ${calls2}`);

  // (в) завеликий клієнтський знімок не відправляється й не блокує операції
  const server3 = { mode: 'v2' as const, row: null as SimRow | null };
  const st3 = fresh(offlineOps(5));
  const io3 = serverIo(server3, { snapshot: () => ({ playerPhoto: 'x'.repeat(SNAPSHOT_MAX_BYTES + 10) }) });
  const out3 = await syncQueue(st3, io3.io);
  assert.equal(out3.snapshot, 'too_large');
  assert.deepEqual(io3.calls.map((c) => [c.ops, c.snapshot]), [[5, false]]);
  assert.equal(st3.queue.length, 0);

  // (г) сервер відхилив запит зі знімком за розміром: той самий запит повторюється один раз, уже без знімка
  const server4 = { mode: 'v2' as const, row: null as SimRow | null };
  const st4 = fresh(offlineOps(5));
  const seen: boolean[] = [];
  const out4 = await syncQueue(st4, {
    send: async (baseRev, ops, cs) => {
      seen.push(!!cs);
      if (cs) throw new Error('state_too_large');
      const r = simSave(server4.mode, server4.row, baseRev, ops, cs);
      server4.row = r.row;
      return r.res;
    },
    snapshot: () => ({ theme: 'day' }),
  });
  assert.deepEqual(seen, [true, false]);
  assert.equal(out4.snapshot, 'too_large');
  assert.equal(st4.queue.length, 0);

  // (д) операція, на яку сервер не дав підсумку, не висить у черзі вічно
  const st5 = fresh([{ opId: 'x'.repeat(200), kind: 'quest', at: 1, coins: 1 }, ...offlineOps(3)]);
  const server5 = { mode: 'v2' as const, row: null as SimRow | null };
  const out5 = await syncQueue(st5, serverIo(server5).io);
  assert.equal(out5.quarantined, 1);
  assert.equal(st5.queue.length, 0);
  assert.equal(Object.keys(server5.row!.journal).length, 3);
});

test('режим legacy: not_active нічого не знімає з черги й не шле порції далі', async () => {
  const server = { mode: 'legacy' as 'legacy' | 'v2', row: null as SimRow | null };
  const st = fresh(offlineOps(450));
  const io = serverIo(server);
  const out = await syncQueue(st, io.io);
  assert.equal(out.status, 'not_active');
  assert.equal(st.queue.length, 450);
  assert.equal(io.calls.length, 1);
  server.mode = 'v2';
  await syncQueue(st, io.io);
  assert.equal(st.queue.length, 0);
  assert.equal(Object.keys(server.row!.journal).length, 450);
});

// ───────── Таблиця «b24 / зараз» ─────────
// Еталонна модель b24: формули серверного ядра, переписані з app-mvp/src/store.ts на коміті aa3c423 (збірка 24).
// «Зараз»: операція, яку створює стор після тієї самої дії, застосована правилами сервера (applyOp).
type B24 = Core;
const b24 = {
  lesson(s: B24, id: string, coins: number, xp: number, o: { practiceOnly?: boolean; doubled?: boolean; freezeUsed?: boolean } = {}): B24 {
    return {
      ...s,
      completed: o.practiceOnly || s.completed.includes(id) ? s.completed : [...s.completed, id],
      xp: s.xp + xp,
      coins: s.coins + coins,
      totalCoinsEarned: s.totalCoinsEarned + coins,
      doubleCoins: o.doubled ? Math.max(0, s.doubleCoins - 1) : s.doubleCoins,
      streakFreezes: o.freezeUsed ? s.streakFreezes - 1 : s.streakFreezes,
    };
  },
  answers: (s: B24, total: number, correct: number): B24 => ({ ...s, answersTotal: s.answersTotal + total, answersCorrect: s.answersCorrect + correct }),
  spendEnergy: (s: B24, n: number, now: number): B24 => ({ ...s, energy: Math.max(0, s.energy - n), energyAt: s.energy >= 50 ? now : s.energyAt }),
  buy(s: B24, id: string, cost: number): B24 {
    if (s.coins < cost) return s;
    let p: Partial<B24> | null = null;
    if (id === 'energy10' || id === 'energy20' || id === 'energyFull') {
      if (s.energy >= 50) return s;
      p = { energy: Math.min(50, s.energy + (id === 'energy10' ? 10 : id === 'energy20' ? 20 : 50)) };
    } else if (id === 'freeze') {
      if (s.streakFreezes >= 2) return s;
      p = { streakFreezes: s.streakFreezes + 1 };
    } else if (id === 'shield3') p = { comboShields: s.comboShields + 3 };
    else if (id === 'hint3') p = { hints: s.hints + 3 };
    else if (id === 'double') {
      if (s.doubleCoins >= 1) return s;
      p = { doubleCoins: 1 };
    } else if (id.startsWith('frame_')) {
      if (s.frames.includes(id.slice(6))) return s;
      p = { frames: [...s.frames, id.slice(6)] };
    }
    return p ? { ...s, ...p, coins: s.coins - cost, purchases: s.purchases + 1 } : s;
  },
  useHint: (s: B24): B24 => (s.hints > 0 ? { ...s, hints: s.hints - 1 } : s),
  useShield: (s: B24): B24 => (s.comboShields > 0 ? { ...s, comboShields: s.comboShields - 1 } : s),
  quest: (s: B24, reward: number): B24 => ({ ...s, coins: s.coins + reward, totalCoinsEarned: s.totalCoinsEarned + reward }),
  sim: (s: B24, xp: number, coins: number): B24 => ({ ...s, xp: s.xp + xp, coins: s.coins + coins, totalCoinsEarned: s.totalCoinsEarned + coins }),
  skip: (s: B24, ids: string[]): B24 => ({ ...s, completed: [...s.completed, ...ids.filter((id) => !s.completed.includes(id))] }),
};

type Row = { name: string; old: (s: B24) => B24; ops: (s: Core) => Op[]; expectDiff?: (keyof Core)[] };
const NOW = 1700000000000;
const START: Core = { ...coreOf({}), completed: ['l1'], coins: 500, xp: 100, totalCoinsEarned: 700, answersTotal: 20, answersCorrect: 15, energy: 50, energyAt: 5, hints: 2, comboShields: 1, doubleCoins: 1, streakFreezes: 1, frames: ['gold'], purchases: 4 };
const op = (o: Omit<Op, 'opId' | 'at'>): Op => ({ opId: `t-${Math.random().toString(36).slice(2)}`, at: NOW, ...o });
const energyAfter = (s: Core, n: number) => ({ energy: Math.max(0, s.energy - n), energyAt: s.energy >= 50 ? NOW : s.energyAt });

export const B24_ROWS: Row[] = [
  { name: 'урок уперше (20 монет, 13 XP)', old: (s) => b24.lesson(s, 'l2', 20, 13), ops: () => [op({ kind: 'lesson', lessonId: 'l2', coins: 20, xp: 13 })] },
  { name: 'урок уперше з бустером X2 і заморозкою стріку', old: (s) => b24.lesson(s, 'l2', 40, 13, { doubled: true, freezeUsed: true }), ops: () => [op({ kind: 'lesson', lessonId: 'l2', coins: 40, xp: 13, doubled: true, freezeUsed: true })] },
  // b24: екран уроку давав половину (10 монет, 7 XP); зараз екран уроку дає 0 і сервер відповідає already_rewarded
  { name: 'повтор пройденого уроку курсу', old: (s) => b24.lesson(s, 'l1', 10, 7), ops: () => [op({ kind: 'lesson', lessonId: 'l1', coins: 0, xp: 0 })], expectDiff: ['coins', 'xp', 'totalCoinsEarned'] },
  { name: 'повтор пройденого уроку, стрік врятувала заморозка', old: (s) => b24.lesson(s, 'l1', 0, 0, { freezeUsed: true }), ops: () => [op({ kind: 'lesson', lessonId: 'l1', coins: 0, xp: 0, freezeUsed: true })] },
  { name: 'тренування / надолуження помилок (lesson + repeatable)', old: (s) => b24.lesson(s, 'practice', 9, 6, { practiceOnly: true }), ops: () => [op({ kind: 'lesson', lessonId: 'practice', coins: 9, xp: 6, repeatable: true })] },
  { name: 'тренування двічі поспіль', old: (s) => b24.lesson(b24.lesson(s, 'mistakes', 9, 6, { practiceOnly: true }), 'mistakes', 8, 5, { practiceOnly: true }), ops: () => [op({ kind: 'lesson', lessonId: 'mistakes', coins: 9, xp: 6, repeatable: true }), op({ kind: 'lesson', lessonId: 'mistakes', coins: 8, xp: 5, repeatable: true })] },
  { name: 'тренування з бустером X2 і заморозкою', old: (s) => b24.lesson(s, 'practice', 18, 6, { practiceOnly: true, doubled: true, freezeUsed: true }), ops: () => [op({ kind: 'lesson', lessonId: 'practice', coins: 18, xp: 6, repeatable: true, doubled: true, freezeUsed: true })] },
  { name: 'відповіді уроку (7, з них 5 правильних)', old: (s) => b24.answers(s, 7, 5), ops: () => [op({ kind: 'answers', total: 7, correct: 5 })] },
  { name: 'енергія: витрата 10 з повної', old: (s) => b24.spendEnergy(s, 10, NOW), ops: (s) => [op({ kind: 'energy', ...energyAfter(s, 10) })] },
  { name: 'енергія: дві витрати поспіль', old: (s) => b24.spendEnergy(b24.spendEnergy(s, 10, NOW), 10, NOW + 5), ops: (s) => { const a = energyAfter(s, 10); return [op({ kind: 'energy', ...a }), op({ kind: 'energy', energy: a.energy - 10, energyAt: a.energyAt })]; } },
  { name: 'енергія: відновлення / добовий бонус (+10 після витрати 20)', old: (s) => ({ ...s, energy: 40, energyAt: NOW + 9 }), ops: () => [op({ kind: 'energy', energy: 30, energyAt: NOW }), op({ kind: 'energy', energy: 40, energyAt: NOW + 9 })] },
  { name: 'покупка енергії +20 (після витрати 30)', old: (s) => b24.buy(b24.spendEnergy(s, 30, NOW), 'energy20', 80), ops: (s) => [op({ kind: 'energy', ...energyAfter(s, 30) }), op({ kind: 'spend', cost: 80, item: 'energy20' })] },
  { name: 'покупка: підказки ×3', old: (s) => b24.buy(s, 'hint3', 90), ops: () => [op({ kind: 'spend', cost: 90, item: 'hint3' })] },
  { name: 'покупка: щити ×3', old: (s) => b24.buy(s, 'shield3', 120), ops: () => [op({ kind: 'spend', cost: 120, item: 'shield3' })] },
  { name: 'покупка: заморозка стріку', old: (s) => b24.buy(s, 'freeze', 150), ops: () => [op({ kind: 'spend', cost: 150, item: 'freeze' })] },
  { name: 'покупка: рамка', old: (s) => b24.buy(s, 'frame_neon', 200), ops: () => [op({ kind: 'spend', cost: 200, item: 'frame_neon' })] },
  { name: 'use: підказка', old: (s) => b24.useHint(s), ops: () => [op({ kind: 'use', item: 'hint' })] },
  { name: 'use: щит комбо', old: (s) => b24.useShield(s), ops: () => [op({ kind: 'use', item: 'shield' })] },
  { name: 'завдання дня (нагорода 25)', old: (s) => b24.quest(s, 25), ops: () => [op({ kind: 'quest', coins: 25 })] },
  { name: 'симулятор (8 XP, 15 монет)', old: (s) => b24.sim(s, 8, 15), ops: () => [op({ kind: 'sim', xp: 8, coins: 15 })] },
  { name: 'skip: діагностика зарахувала 3 уроки без нагороди', old: (s) => b24.skip(s, ['l1', 'l2', 'l3']), ops: () => [op({ kind: 'skip', lessons: ['l1', 'l2', 'l3'] })] },
  { name: 'урок, зарахований діагностикою, пройдено вперше по-справжньому', old: (s) => b24.lesson(b24.skip(s, ['l2']), 'l2', 10, 7), ops: () => [op({ kind: 'skip', lessons: ['l2'] }), op({ kind: 'lesson', lessonId: 'l2', coins: 0, xp: 0 })], expectDiff: ['coins', 'xp', 'totalCoinsEarned'] },
];

export function b24Table() {
  return B24_ROWS.map((r) => {
    const before = r.old(START);
    const now = replay(START, [...START.completed], r.ops(START)).core;
    const diff = (Object.keys(before) as (keyof Core)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k]));
    return { name: r.name, before, now, diff, expectDiff: r.expectDiff ?? [] };
  });
}

test('додані операції: ядро збігається з b24 на однакових вхідних даних; єдина розбіжність: повтор уроку = 0', () => {
  const table = b24Table();
  for (const row of table) assert.deepEqual(row.diff, row.expectDiff, row.name);
  assert.equal(table.filter((r) => r.diff.length).length, 2);
  if (process.env.PRINT_B24_TABLE) {
    for (const r of table) console.log(`| ${r.name} | ${r.before.coins} / ${r.before.xp} | ${r.now.coins} / ${r.now.xp} | ${r.diff.length ? r.diff.join(', ') : 'немає'} |`);
  }
});

test('init: початковий стан з пристрою дорівнює тому, що зберігала b24', () => {
  const local = { completed: ['l1', 'l2'], coins: 45, xp: 22, totalCoinsEarned: 60, answersTotal: 9, answersCorrect: 7, energy: 30, energyAt: 7, hints: 2, comboShields: 1, doubleCoins: 1, frames: ['gold'], streakFreezes: 1, purchases: 3 };
  const ops = legacyOps('u', 'u', local, simLoad('v2', null), 1);
  const out = replay(coreOf({}), [], ops, true);
  assert.deepEqual(out.core, coreOf(local)); // b24 зберігала знімок як є
  assert.deepEqual(out.rewarded, ['l1', 'l2']);
  assert.equal(applyOp(coreOf(local), ['l1'], ops[0], false).status, 'rejected_exists');
});

test('імітація: перемикач режиму й «стара збірка» (T1, T2 у режимі mock)', () => {
  const state = { completed: ['l1'], xp: 10, coins: 20, totalCoinsEarned: 20, playerName: 'Тест' };
  const a = simLegacySave('legacy', null, state);
  assert.ok(a.written && a.row);
  assert.equal(simSave('legacy', a.row, 1, [{ opId: 'x', kind: 'lesson', at: 1, lessonId: 'l2', xp: 5, coins: 5 }], null).res.status, 'not_active'); // T1
  const v2row = simSwitchToV2(a.row!);
  assert.equal(v2row.rev, a.row!.rev + 1);
  assert.deepEqual(v2row.rewarded, ['l1']);
  const b = simLegacySave('v2', v2row, { ...state, completed: [] }); // T2: стара збірка після перемикання
  assert.equal(b.written, false);
  assert.equal(b.row, v2row);
  // застарілий знімок у режимі legacy не забирає урок і нагороду, свій новий урок додає з нагородою з історії
  const c = simLegacySave('legacy', a.row, { completed: ['l9'], xp: 7, coins: 9, totalCoinsEarned: 9, history: [{ id: 'l9', xp: 7, coins: 9 }] });
  assert.deepEqual(c.row!.core.completed, ['l1', 'l9']);
  assert.equal(c.row!.core.xp, 17);
  assert.equal(c.row!.core.coins, 29);
});
