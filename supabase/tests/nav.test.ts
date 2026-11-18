// Автотести наскрізної навігації (ТЗ 004, етап E): точки гілки на карті Києва, що відкрилось після одиниці,
// «Продовжити» (урок і крок, тренажер, стаття з поверненням, наступна одиниця), злиття місця між пристроями.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCHES, readyLessonIds } from '../../app-mvp/src/data/branches/index.ts';
import { BRANCH_ROUTE, branchPins, newlyOpened } from '../../app-mvp/src/data/branchMap.ts';
import { continueTarget, lessonPlace, mergePlace, resumeFor, PLACE_FRESH, type PlaceBox } from '../../app-mvp/src/data/place.ts';
import { mergeClientState } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import { lessonIds } from '../../app-mvp/src/data/branchRules.ts';

const fs = await import('node:fs');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEVELS = fs.readFileSync(path.join(ROOT, 'app-mvp/src/art/levels.ts'), 'utf8');

const pinsOf = (code: string, completed: string[], prog?: Parameters<typeof branchPins>[2]) => {
  const b = BRANCHES.find((x) => x.code === code)!;
  return branchPins(code, completed, prog, readyLessonIds(b), !!b.final?.ready);
};

test('E1: у кожної з 8 гілок 7 точок на карті (уроки 1–5, практика, фінал) у закладах Києва з подорожі', () => {
  for (const b of BRANCHES) {
    const route = BRANCH_ROUTE[b.code];
    assert.equal(route.length, 7, b.code);
    for (const loc of route) assert.ok(new RegExp(`\\n  ${loc}: \\{`).test(LEVELS), `${b.code}: ${loc} є в LOCS`);
    const pins = pinsOf(b.code, []);
    assert.deepEqual(pins.map((p) => p.kind), ['lesson', 'lesson', 'lesson', 'lesson', 'lesson', 'practice', 'final']);
    assert.equal(pins[0].state, 'next', `${b.code}: новачок стоїть на уроці 1`);
    assert.equal(pins[5].state, 'locked', 'практика — після самоперевірки');
    assert.equal(pins[6].state, 'locked', 'фінал — після 5 уроків або практики');
  }
});

test('E1: без тупиків — завжди є наступна точка, поки гілку не пройдено; після уроку видно, що відкрилось', () => {
  const L = lessonIds('SRV');
  let completed: string[] = [];
  for (let i = 0; i < 5; i++) {
    const pins = pinsOf('SRV', completed);
    const next = pins.find((p) => p.state === 'next');
    assert.equal(next?.id, L[i], `після ${i} уроків наступний — урок ${i + 1}`);
    completed = [...completed, L[i]];
  }
  // п'ятий урок відкриває фінал
  const before = pinsOf('SRV', L.slice(0, 4));
  const after = pinsOf('SRV', L);
  assert.deepEqual(newlyOpened(before, after).map((p) => p.id), ['BR-SRV-FINAL']);
  assert.equal(after.find((p) => p.state === 'next')?.id, 'BR-SRV-FINAL');
  // самоперевірка відкриває практику; практика — фінал
  const sc = pinsOf('SRV', [], { sc: 'pass' });
  assert.equal(sc[5].state, 'open');
  const pr = pinsOf('SRV', ['BR-SRV-PR'], { sc: 'pass', practice: 'pass' });
  assert.equal(pr[6].state, 'next');
  // гілку пройдено: наступної точки немає, але жодна не закрита
  const all = pinsOf('SRV', [...L, 'BR-SRV-PR', 'BR-SRV-FINAL'], { sc: 'pass', practice: 'pass' });
  assert.ok(all.every((p) => p.state === 'done'));
});

test('E2: урок зберігає крок і відповіді; відкривається з того самого кроку (самоперевірку теж — ТЗ 006, 2.2)', () => {
  const pl = lessonPlace({ id: 'BR-GAM-FINAL', idx: 2, total: 5, results: [{ lessonId: 'BR-GAM-FINAL', idx: 1, ok: false }], chosen: { 1: 2 }, correct: 0, errors: 1, title: 'Гемблінг · Самостійна практика' }, 100)!;
  assert.equal(pl.kind, 'lesson');
  const box: PlaceBox = { place: pl, lastBranch: 'GAM', at: 100 };
  const r = resumeFor(box, 'BR-GAM-FINAL', 5)!;
  assert.equal(r.idx, 2);
  assert.deepEqual(r.chosen, { 1: 2 }, 'обраний варіант фіналу (блок «запускати») не губиться');
  assert.equal(r.results.length, 1, 'відповіді до кроку зберігаються: фінал не можна пройти, пропустивши кроки');
  assert.equal(resumeFor(box, 'BR-GAM-L01', 5), null, 'інший урок — з початку');
  assert.equal(resumeFor(box, 'BR-GAM-FINAL', 2), null, 'крок поза уроком — з початку');
  assert.equal(lessonPlace({ ...pl, id: 'BR-GAM-SC' }, 1)?.id, 'BR-GAM-SC');
  assert.equal(lessonPlace({ ...pl, idx: 0 }, 1), null);
});

test('E2: «Продовжити» — урок і крок, тренажер, стаття з поверненням, наступна одиниця останньої гілки', () => {
  const b = (c: string) => BRANCHES.find((x) => x.code === c);
  const ctx = {
    completed: ['BR-TOV-L01'],
    branchProg: {},
    ready: (c: string) => readyLessonIds(b(c)!),
    hasFinal: (c: string) => !!b(c)?.final?.ready,
    title: (id: string) => id,
    branchTitle: (c: string) => b(c)?.title,
  };
  const lesson = lessonPlace({ id: 'BR-TOV-L02', idx: 3, total: 4, results: [], chosen: {}, correct: 2, errors: 0, title: 'Товарка · Порахуй межу' }, 5)!;
  assert.deepEqual(continueTarget({ place: lesson, lastBranch: 'TOV', at: 5 }, ctx), { kind: 'lesson', id: 'BR-TOV-L02', label: 'Товарка · Порахуй межу', step: 'крок 4 з 4' });
  const sim = { kind: 'sim' as const, id: 'BR-TOV-FINAL', step: 6, total: 22, title: 'Товарка · Тренажер «Ліди»', at: 6 };
  assert.equal(continueTarget({ place: sim, lastBranch: 'TOV', at: 6 }, ctx)?.kind, 'sim');
  const kb = continueTarget({ place: { kind: 'kb', id: 'ECO-02', title: '«База» · Граничний CPL', back: lesson, at: 7 }, lastBranch: 'TOV', at: 7 }, ctx);
  assert.deepEqual(kb, { kind: 'kb', id: 'ECO-02', label: '«База» · Граничний CPL', back: 'Товарка · Порахуй межу' });
  // місця немає → наступна одиниця останньої гілки
  assert.deepEqual(continueTarget({ place: null, lastBranch: 'TOV', at: 8 }, ctx), { kind: 'lesson', id: 'BR-TOV-L02', label: 'BR-TOV-L02' });
  assert.equal(continueTarget(PLACE_FRESH, ctx), null, 'новачок: кнопки немає');
  // знайдено в браузері: практика й фінал пройдені, уроки 2–5 ні — не «гілку пройдено», а наступний урок
  const ctx2 = { ...ctx, completed: ['BR-TOV-L01', 'BR-TOV-PR', 'BR-TOV-FINAL'], branchProg: { TOV: { sc: 'pass' as const, practice: 'pass' as const } } };
  assert.equal(continueTarget({ place: null, lastBranch: 'TOV', at: 9 }, ctx2)?.kind, 'lesson');
  assert.equal((continueTarget({ place: null, lastBranch: 'TOV', at: 9 }, ctx2) as { id: string }).id, 'BR-TOV-L02');
  const allDone = { ...ctx2, completed: [...lessonIds('TOV'), 'BR-TOV-PR', 'BR-TOV-FINAL'] };
  assert.equal(continueTarget({ place: null, lastBranch: 'TOV', at: 9 }, allDone)?.kind, 'branch');
});

test('E3: місце в клієнтському знімку; на другому пристрої перемагає новіше', () => {
  const phone: PlaceBox = { place: { kind: 'sim', id: 'BR-TOV-FINAL', step: 9, total: 22, title: 't', at: 200 }, lastBranch: 'TOV', at: 200 };
  const desktop: PlaceBox = { place: null, lastBranch: 'SRV', at: 100 };
  assert.equal(mergePlace(desktop, phone).lastBranch, 'TOV');
  assert.equal(mergePlace(phone, desktop).lastBranch, 'TOV');
  const out = mergeClientState({ placeBox: desktop }, { placeBox: phone }) as { placeBox: PlaceBox };
  assert.equal(out.placeBox.at, 200);
  assert.equal(mergePlace(undefined, undefined).place, null);
});
