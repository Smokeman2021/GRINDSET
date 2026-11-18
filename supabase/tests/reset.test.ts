// ТЗ 005 / 007: епоха прогресу на клієнті — рішення на старті, відповідь epoch_mismatch, очищення лише своєї учётки,
// перенесення з епохою, імітація сервера (mock) дзеркалить 0009. Серверні R1–R11 — supabase/sqltest/reset.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreOf, epochGate, legacyOps, simLoad, simSave, syncQueue, type Op, type SaveV2, type SyncState } from '../../app-mvp/src/cloud/shared/progressOps.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = (opId: string, lessonId: string): Op => ({ opId, kind: 'lesson', at: 1, lessonId, xp: 10, coins: 20 });

test('005-R1/R2: епоха на старті — та сама → нічого; інша (скидання або відновлення) → очистити локальне й чергу', () => {
  assert.equal(epochGate(0, 0), 'ok');
  assert.equal(epochGate(undefined, 0), 'ok', 'дані без позначки — епоха 0');
  assert.equal(epochGate(undefined, undefined), 'ok', 'до міграції 0009 епохи немає');
  assert.equal(epochGate(0, 1), 'wipe');
  assert.equal(epochGate(1, 2), 'wipe', 'відновлення з архіву теж міняє епоху');
});

test('005-R3: офлайн-черга після виходу в мережу — сервер відповідає epoch_mismatch, syncQueue нічого не вважає прийнятим', async () => {
  const st: SyncState = { queue: [L('q1', 'BR-TOV-L01'), L('q2', 'BR-TOV-L02')], rev: 3, base: null, dead: [] };
  let sentEpoch: number | null = null;
  const out = await syncQueue(st, {
    send: async (): Promise<SaveV2> => ({ status: 'epoch_mismatch', epoch: 1 }),
    snapshot: () => null,
  });
  void sentEpoch;
  assert.deepEqual([out.status, out.epoch, out.portions], ['epoch_mismatch', 1, 0]);
  assert.equal(st.queue.length, 2, 'черга не знімається відповіддю epoch_mismatch — її очищає progressSync');
});

test('005-R8: перенесення несе епоху локальних даних; імітація сервера відхиляє чужу епоху запиту й операцій', () => {
  const ops = legacyOps('u1', 'u1', { completed: ['BR-TOV-L01'], xp: 10, coins: 20, history: [{ id: 'BR-TOV-L01', xp: 10, coins: 20 }] }, { exists: false, core: coreOf({}) }, 5, 0);
  assert.deepEqual(ops.map((o) => [o.opId, o.epoch]), [['legacy-init:u1', 0], ['legacy:u1:BR-TOV-L01', 0]]);
  // запит з минулою епохою
  assert.deepEqual(simSave('v2', null, 0, ops, null, 0, 1).res, { status: 'epoch_mismatch', epoch: 1 });
  // запит з новою епохою, але операції зі старих даних
  const r = simSave('v2', null, 0, ops, null, 1, 1).res as Extract<SaveV2, { status: 'ok' }>;
  assert.deepEqual(r.ops.map((o) => o.status), ['rejected_epoch', 'rejected_epoch']);
  assert.deepEqual(r.core.completed, []);
  // звичайна операція без позначки епохи з правильною епохою запиту — застосовується
  const ok = simSave('v2', null, 0, [L('n1', 'BR-SRV-L01')], null, 1, 1).res as Extract<SaveV2, { status: 'ok' }>;
  assert.deepEqual(ok.core.completed, ['BR-SRV-L01']);
  assert.equal(simLoad('v2', null, 1).epoch, 1);
});

test('005: очищення — лише ключі своєї учётки, до перенесення старих даних; епоха зберігається поруч із чергою', () => {
  const src = read('app-mvp/src/cloud/progressSync.ts');
  const start = src.slice(src.indexOf('export async function startProgressSync'));
  assert.ok(start.indexOf("epochGate(epoch, srv.epoch) === 'wipe'") < start.indexOf('legacyOps(user.id'), 'спершу епоха, потім перенесення');
  const wipe = src.slice(src.indexOf('async function wipeLocal'));
  assert.ok(wipe.includes('persistQueue(uid)') && wipe.includes('deadKey(uid)'), 'чергу й відкладені — лише цієї учётки');
  assert.ok(wipe.includes('useStore.getState().reset()') && wipe.includes('migrated = true'), 'стан з нуля, перенесення не виконується');
  assert.ok(src.includes('epoch?: number }') && src.includes('base: S.base, epoch }'), 'епоха в метаданих синхронізації учётки');
  assert.ok(src.includes("if (out.status === 'epoch_mismatch')") && src.includes('saveProgressV2(baseRev, ops, clientState, epoch)'));
  // стан застосунку після скидання — з нуля, включно з онбордингом і персонажем (R1): reset() повертає FRESH, лишає мову й тему
  assert.ok(read('app-mvp/src/store.ts').includes('reset: () => set((s) => ({ ...FRESH, lang: s.lang, theme: s.theme }))'));
});

test('005: справжній бекенд передає p_epoch і розпізнає epoch_mismatch; імітація має скидання для перевірки в браузері', () => {
  const sb = read('app-mvp/src/cloud/supabaseBackend.ts');
  assert.ok(sb.includes('p_epoch: epoch') && sb.includes("d.status === 'epoch_mismatch'"));
  assert.ok(sb.includes('epoch: Number(d.epoch ?? 0) || 0'), 'до 0009 епоха 0');
  const mock = read('app-mvp/src/cloud/mockBackend.ts');
  assert.ok(mock.includes('async mockReset(') && mock.includes("throw new Error('reset_requires_v2')") && mock.includes("throw new Error('empty_list')"));
  assert.ok(mock.includes('if ((db.epochs?.[row.id] ?? 0) > 0) return { written: false };'), 'стара збірка: скинута учётка не пише');
  assert.ok(read('app-mvp/src/cloud/backend.ts').includes('reset: (run: string, ids: string[]) => mock.mockReset(run, ids)'));
});

test('005: міграція 0009 — лише власник, лише v2, явний список, повтор за ідентифікатором, архів, епоха під блокуванням рядка учётки', () => {
  const sql = read('supabase/migrations/0009_progress_epoch_reset.sql');
  assert.ok(sql.includes("raise exception 'reset_requires_v2'") && sql.includes("raise exception 'empty_list'"));
  assert.ok(/revoke execute on function public\.reset_progress\(text, uuid\[\]\), public\.restore_progress\(text, uuid\)[^;]*from public, anon, authenticated;/.test(sql));
  assert.ok(sql.includes('for share;') && sql.includes('for update;'), 'запис — спільне, скидання — виключне блокування рядка учётки');
  assert.ok(!/reset_progress\([^)]*'all'/.test(sql), 'варіанта «усі» немає');
  // запит кандидатів на скидання — лише читання, у репозиторії
  const q = read('report/007-reset-candidates.sql');
  assert.ok(/^\s*select/im.test(q) && !/\b(insert|update|delete|truncate|drop|alter|reset_progress\()/i.test(q.replace(/--[^\n]*/g, '')));
});
