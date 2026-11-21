// ТЗ 006, пункт 2: завелика операція (статус, повтор лише після оновлення, реальний максимальний розмір),
// збереження самоперевірки, пряме посилання й перезавантаження.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addDead,
  BATCH_MAX_BYTES,
  newOpId,
  normalizeDead,
  reviveOnUpdate,
  syncQueue,
  utf8Length,
  type Op,
  type SaveV2,
  type SyncState,
} from '../../app-mvp/src/cloud/shared/progressOps.ts';
import { BRANCHES, getBranch, unitById } from '../../app-mvp/src/data/branches/index.ts';
import { continueTarget, lessonPlace, mergePlace, resumeFor, type PlaceBox } from '../../app-mvp/src/data/place.ts';
import { resolveDeepLink, captureInitialLink, takeInitialLink, type LinkCtx } from '../../app-mvp/src/data/deepLink.ts';
import { kbMeta } from '../../app-mvp/src/data/kb.ts';
import { SIM_STEPS } from '../../app-mvp/src/data/simLeads.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER_LIMIT = 1_000_000; // save_progress_v2: pg_column_size(p_ops) + pg_column_size(p_client_state) ≤ 1 000 000

// ───────── 2.1 Завелика операція ─────────
test('006-2.1: відкладена операція має позначку збірки й повторюється лише після оновлення клієнта', () => {
  const big: Op = { opId: 'big-1', kind: 'init', at: 1, state: { completed: [] } };
  let dead = addDead([], [big], 27);
  assert.deepEqual(dead, [{ op: big, build: 27 }]);
  // та сама збірка — не повторюється
  assert.deepEqual(reviveOnUpdate(dead, 27), { revive: [], keep: dead });
  // новіша збірка — один раз повертається в чергу
  const r = reviveOnUpdate(dead, 28);
  assert.deepEqual(r.revive, [big]);
  assert.deepEqual(r.keep, []);
  // знову відхилено новою збіркою — знову позначено нею (без нескінченного повтору в межах збірки)
  dead = addDead(r.keep, r.revive, 28);
  assert.deepEqual(reviveOnUpdate(dead, 28).revive, []);
  // старий формат b26 (голий масив операцій) — збірка 0, повтор один раз
  assert.deepEqual(normalizeDead([big, big, null, 5]), [{ op: big, build: 0 }]);
  assert.deepEqual(normalizeDead('x'), []);
});

test('006-2.1: завелика операція лишається на пристрої, решта черги синхронізується', async () => {
  const ops: Op[] = Array.from({ length: 5 }, (_, i) => ({ opId: `l${i}`, kind: 'lesson', at: i, lessonId: `BR-TOV-L0${i + 1}`, xp: 10, coins: 5 }));
  const tooBig: Op = { opId: 'too-big', kind: 'init', at: 9, state: { blob: 'x' } };
  const st: SyncState = { queue: [ops[0], ops[1], tooBig, ops[2], ops[3], ops[4]], rev: 0, base: null, dead: [] };
  const sent: string[] = [];
  const out = await syncQueue(st, {
    send: async (rev, batch): Promise<SaveV2> => {
      if (batch.some((o) => o.opId === 'too-big')) throw new Error('state_too_large');
      sent.push(...batch.map((o) => o.opId));
      return { status: 'ok', rev: rev + 1, core: { completed: [], coins: 0, xp: 0, totalCoinsEarned: 0, answersTotal: 0, answersCorrect: 0, energy: 50, energyAt: 0, hints: 0, comboShields: 0, doubleCoins: 0, frames: [], streakFreezes: 0, purchases: 0 }, rewarded: [], clientState: null, clientStateStatus: 'none', ops: batch.map((o) => ({ opId: o.opId, status: 'applied', duplicate: false })) } as unknown as SaveV2;
    },
    snapshot: () => null,
  });
  assert.equal(out.quarantined, 1);
  assert.deepEqual(st.dead.map((o) => o.opId), ['too-big']);
  assert.deepEqual(st.queue, []);
  assert.deepEqual(sent.sort(), ['l0', 'l1', 'l2', 'l3', 'l4']);
});

test('006-2.1: статус для учня — «Частину прогресу ще не синхронізовано» з посиланням на відгук і контекстом; на головній і в профілі', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app-mvp/src/components/UnsyncedNote.tsx'), 'utf8');
  assert.ok(src.includes('Частину прогресу ще не синхронізовано'));
  assert.ok(src.includes('<FeedbackSheet') && src.includes('unsyncedScreen('));
  for (const f of ['app-mvp/app/(tabs)/home.tsx', 'app-mvp/app/(tabs)/profile.tsx']) assert.ok(fs.readFileSync(path.join(ROOT, f), 'utf8').includes('<UnsyncedNote />'), f);
  const sync = fs.readFileSync(path.join(ROOT, 'app-mvp/src/cloud/progressSync.ts'), 'utf8');
  assert.ok(sync.includes('reviveOnUpdate(normalizeDead('), 'повтор лише через reviveOnUpdate при старті');
  assert.ok(sync.includes('addDead(deadAll, live.dead, UI_BUILD)'), 'позначка збірки при відхиленні');
});

// Найбільша операція звичайного проходження. Операції уроку / гілки / фіналу / «Лідів» — це kind lesson + answers (лише лічильники);
// найбільші за побудовою — init (ядро з усіма пройденими ID) і skip (список уроків діагностики). Оцінюємо їх на всіх ID застосунку.
test('006-2.1: максимальний реальний розмір операції значно менший за ліміт порції й сервера', () => {
  const branchIds = BRANCHES.flatMap((b) => [`BR-${b.code}-SC`, b.practice.id, ...b.lessons.map((l) => l.id), `BR-${b.code}-FINAL`]);
  // уроки старого курсу: m01–m10 по ≤ 16 уроків (ID «m10-l16» тощо), з запасом
  const courseIds = Array.from({ length: 10 * 16 }, (_, i) => `m${String(Math.floor(i / 16) + 1).padStart(2, '0')}-l${(i % 16) + 1}`);
  const all = [...branchIds, ...courseIds];
  const frames = Array.from({ length: 40 }, (_, i) => `frame_custom_${i}`);
  const now = Date.now();
  const candidates: Op[] = [
    { opId: `legacy:${'u'.repeat(36)}:${'BR-TOV-FINAL'}`, kind: 'lesson', at: now, lessonId: 'BR-TOV-FINAL', xp: 10000, coins: 100000 },
    { opId: newOpId('answers'), kind: 'answers', at: now, total: SIM_STEPS.length, correct: SIM_STEPS.length },
    { opId: newOpId('skip'), kind: 'skip', at: now, lessons: all },
    { opId: `legacy-init:${'u'.repeat(36)}`, kind: 'init', at: now, state: { completed: all, coins: 1e9, xp: 1e9, totalCoinsEarned: 1e9, answersTotal: 99999999, answersCorrect: 99999999, energy: 50, energyAt: now, hints: 100000, comboShields: 100000, doubleCoins: 1, frames, streakFreezes: 2, purchases: 1e8 } },
  ];
  const sizes = candidates.map((o) => ({ kind: o.kind, bytes: utf8Length(JSON.stringify(o)) }));
  const max = Math.max(...sizes.map((s) => s.bytes));
  console.log(`[006-2.1] найбільші операції, байт: ${sizes.map((s) => `${s.kind} ${s.bytes}`).join(', ')}; ліміт порції ${BATCH_MAX_BYTES}, сервера ${SERVER_LIMIT}`);
  assert.ok(max * 20 < BATCH_MAX_BYTES, `запас ×20 до ліміту порції: ${max}`);
  assert.ok(max * 100 < SERVER_LIMIT, `запас ×100 до ліміту сервера: ${max}`);
});

// ───────── 2.2 Самоперевірка ─────────
test('006-2.2: самоперевірка зберігає гілку, питання й відповіді; повертає «Продовжити» або «Почати заново»; нагород не дає', () => {
  const sc = BRANCHES[0].selfcheck;
  const pl = lessonPlace({ id: 'BR-TOV-SC', idx: 1, total: sc.length, results: [{ lessonId: 'BR-TOV-SC', idx: 0, ok: true }], chosen: {}, correct: 1, errors: 0, title: 'Товарка · Самоперевірка' }, 50)!;
  assert.equal(pl.kind, 'lesson');
  const box: PlaceBox = { place: pl, lastBranch: 'TOV', at: 50 };
  // у клієнтському знімку (злиття між пристроями) — те саме місце
  assert.deepEqual(mergePlace(box, { place: null, lastBranch: null, at: 10 }), box);
  const r = resumeFor(box, 'BR-TOV-SC', sc.length)!;
  assert.equal(r.idx, 1);
  assert.deepEqual(r.results, [{ lessonId: 'BR-TOV-SC', idx: 0, ok: true }]);
  const ctx = { completed: [], branchProg: {}, ready: () => [], hasFinal: () => true, title: () => undefined, branchTitle: () => 'Товарка' };
  assert.deepEqual(continueTarget(box, ctx), { kind: 'lesson', id: 'BR-TOV-SC', label: 'Товарка · Самоперевірка', step: `крок 2 з ${sc.length}` });
  const lesson = fs.readFileSync(path.join(ROOT, 'app-mvp/app/lesson/[id].tsx'), 'utf8');
  assert.ok(lesson.includes('Почати заново') && lesson.includes('function restart()'));
  // нагорода й зарахування — лише на завершенні; для самоперевірки там немає ні нагороди, ні позначки уроку
  const finishSc = lesson.slice(lesson.indexOf("if (kind === 'selfcheck') {"), lesson.indexOf("if (kind === 'practice') {"));
  assert.ok(finishSc.includes('router.dismissTo(hub)') && !finishSc.includes('/results') && !finishSc.includes('branchReward'));
});

// ───────── 2.3 Пряме посилання ─────────
const ctx: LinkCtx = {
  kbExists: (id) => !!kbMeta(id),
  unit: (id) => {
    const r = unitById(id);
    return r ? { ready: !!r.unit.ready && (r.unit.steps.length > 0 || !!r.unit.sim), sim: r.unit.sim === 'leads' } : null;
  },
  branchExists: (code) => !!getBranch(code),
  isAdmin: false,
};

test('006-2.3: дійсне посилання (стаття, урок, тренажер, гілка, карта, вкладка) відкриває цей екран', () => {
  assert.deepEqual(resolveDeepLink('/kb/ECO-01', ctx), { kind: 'open', href: '/kb/ECO-01' });
  assert.deepEqual(resolveDeepLink('/kb/MET-06?ret=1', ctx), { kind: 'open', href: '/kb/MET-06' });
  assert.deepEqual(resolveDeepLink('/lesson/BR-TOV-L02', ctx), { kind: 'open', href: '/lesson/BR-TOV-L02' });
  assert.deepEqual(resolveDeepLink('/lesson/BR-GAM-SC', ctx), { kind: 'open', href: '/lesson/BR-GAM-SC' });
  assert.deepEqual(resolveDeepLink('/lesson/BR-TOV-FINAL', ctx), { kind: 'open', href: '/leads' });
  assert.deepEqual(resolveDeepLink('/leads', ctx), { kind: 'open', href: '/leads' });
  assert.deepEqual(resolveDeepLink('/branch/SRV', ctx), { kind: 'open', href: '/branch/SRV' });
  assert.deepEqual(resolveDeepLink('/map/GAM/', ctx), { kind: 'open', href: '/map/GAM' });
  assert.deepEqual(resolveDeepLink('/profile', ctx), { kind: 'open', href: '/profile' });
});

test('006-2.3: звичайний запуск (корінь, вхід, результат) → головна; недійсне → екран «недоступно»', () => {
  for (const p of ['/', '', '/login', '/results?id=BR-TOV-L01&coins=99', '/onboarding', '/index']) assert.deepEqual(resolveDeepLink(p, ctx), { kind: 'none' }, p);
  assert.deepEqual(resolveDeepLink('/kb/NOPE-99', ctx), { kind: 'invalid', why: 'kb' });
  assert.deepEqual(resolveDeepLink('/lesson/BR-TOV-L99', ctx), { kind: 'invalid', why: 'lesson' });
  assert.deepEqual(resolveDeepLink('/lesson/<script>', ctx), { kind: 'invalid', why: 'lesson' });
  assert.deepEqual(resolveDeepLink('/branch/XXX', ctx), { kind: 'invalid', why: 'branch' });
  assert.deepEqual(resolveDeepLink('/what/ever/else', ctx), { kind: 'invalid', why: 'route' });
  assert.deepEqual(resolveDeepLink('/admin', ctx), { kind: 'invalid', why: 'route' }, 'адмінка за посиланням — лише адміну');
  assert.deepEqual(resolveDeepLink('/admin', { ...ctx, isAdmin: true }), { kind: 'open', href: '/admin' });
  assert.deepEqual(resolveDeepLink('/kb/%E0%A4%A', ctx), { kind: 'invalid', why: 'route' });
});

test('006-2.3: адреса старту запамʼятовується один раз до входу й віддається один раз; стартовий екран чекає вхід і прогрес', () => {
  captureInitialLink({ pathname: '/kb/ECO-01', search: '?ret=1' });
  captureInitialLink({ pathname: '/login' }); // перенаправлення на вхід не перезаписує
  assert.equal(takeInitialLink(), '/kb/ECO-01?ret=1');
  assert.equal(takeInitialLink(), null);
  const idx = fs.readFileSync(path.join(ROOT, 'app-mvp/app/index.tsx'), 'utf8');
  assert.ok(idx.indexOf('if (waiting)') < idx.indexOf('takeInitialLink()'), 'посилання — після входу й завантаження прогресу');
  const lay = fs.readFileSync(path.join(ROOT, 'app-mvp/app/_layout.tsx'), 'utf8');
  assert.ok(lay.includes('captureInitialLink(window.location)'));
  assert.ok(lay.includes("'unavailable',"), 'екран «недоступно» закритий входом');
});
