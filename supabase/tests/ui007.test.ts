// ТЗ 007, пункти 3–4: екран «пари» (послідовність, «Далі» недоступна до перевірки, пояснення згорнуте) і поточна карта
// на всіх восьми гілках (точки ведуть до правильних завдань, позначки, сцени й повторний перегляд).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasOwnCheck, mainButton } from '../../app-mvp/src/data/lessonFlow.ts';
import { BRANCHES, readyLessonIds, unitById } from '../../app-mvp/src/data/branches/index.ts';
import { BRANCH_ROUTE, branchPins } from '../../app-mvp/src/data/branchMap.ts';
import { branchScene } from '../../app-mvp/src/data/branchScenes.ts';
import { lessonIds } from '../../app-mvp/src/data/branchRules.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('007-3: пари — до перевірки «Далі» немає (обійти не можна); після перевірки — «Далі» / «Завершити»', () => {
  assert.deepEqual(mainButton({ type: 'match', answered: false, selected: false, last: false }), { kind: 'hidden' });
  assert.deepEqual(mainButton({ type: 'match', answered: true, selected: false, last: false }), { kind: 'next', enabled: true });
  assert.deepEqual(mainButton({ type: 'match', answered: true, selected: false, last: true }), { kind: 'finish', enabled: true });
  // те саме для інших завдань із власною «Перевірити»
  for (const t of ['multi', 'order', 'bundle', 'story', 'numeric']) {
    assert.equal(hasOwnCheck(t), true, t);
    assert.deepEqual(mainButton({ type: t, answered: false, selected: false, last: false }), { kind: 'hidden' }, t);
  }
  // один варіант: головна кнопка — «Перевірити» (активна після вибору), далі «Далі»
  assert.deepEqual(mainButton({ type: 'choice', answered: false, selected: false, last: false }), { kind: 'check', enabled: false });
  assert.deepEqual(mainButton({ type: 'choice', answered: false, selected: true, last: false }), { kind: 'check', enabled: true });
  assert.deepEqual(mainButton({ type: 'choice', answered: true, selected: true, last: false }), { kind: 'next', enabled: true });
  assert.deepEqual(mainButton({ type: 'teach', answered: false, selected: false, last: false }), { kind: 'got', enabled: true });
});

test('007-3: екран уроку — головна кнопка за lessonFlow, у Telegram MainButton прихована до перевірки; пояснення згорнуте', () => {
  const src = read('app-mvp/app/lesson/[id].tsx');
  assert.ok(src.includes("{main.kind !== 'hidden' && ("), 'власна кнопка лише коли не hidden');
  assert.ok(src.includes("visible: main.kind !== 'hidden'"), 'MainButton Telegram теж прихована');
  assert.ok(src.includes('✍️ Додати своє пояснення (необовʼязково)') && src.includes('noteOpen && ('), 'пояснення розкривається за дотиком');
  // у пар усередині завдання — «Перевірити», активна лише коли всі пари складено
  const steps = read('app-mvp/src/components/steps.tsx');
  const match = steps.slice(steps.indexOf('export function MatchStep'), steps.indexOf('// ─── Вписати число'));
  assert.ok(match.includes('{!done && <Button title="Перевірити" disabled={!allPaired(assign, step.pairs.length)} onPress={check} />}'));
});

test('007-4: карта на всіх 8 гілках — 7 точок ведуть до своїх завдань (уроки 1–5, практика, фінал) і до сцени того самого закладу', () => {
  for (const b of BRANCHES) {
    const pins = branchPins(b.code, [], undefined, readyLessonIds(b), !!b.final?.ready);
    assert.deepEqual(pins.map((p) => p.id), [...lessonIds(b.code), b.practice.id, `BR-${b.code}-FINAL`], b.code);
    pins.forEach((p, i) => {
      const u = unitById(p.id);
      assert.ok(u, `${p.id}: одиниця існує`);
      assert.equal(u!.branch.code, b.code, `${p.id}: та сама гілка`);
      assert.equal(p.locId, BRANCH_ROUTE[b.code][i], `${p.id}: заклад точки`);
      assert.equal(branchScene(b.code, p.id)!.locId, p.locId, `${p.id}: сцена в тому самому закладі, що й точка`);
      if (p.kind === 'lesson') assert.equal(u!.unit.title, b.lessons[i].title);
    });
    // фінал товарки — тренажер «Ліди»
    if (b.final?.sim === 'leads') assert.equal(unitById(`BR-${b.code}-FINAL`)!.unit.sim, 'leads');
  }
});

test('007-4: позначки — пройдене «done», одна «next», закрите з причиною; прогрес гілки до фіналу на кожній гілці', () => {
  for (const b of BRANCHES) {
    const ready = readyLessonIds(b);
    const L = lessonIds(b.code);
    const done: string[] = [];
    for (let i = 0; i < 5; i++) {
      const pins = branchPins(b.code, done, undefined, ready, !!b.final?.ready);
      const next = pins.filter((p) => p.state === 'next');
      assert.equal(next.length, 1, `${b.code}: одна наступна після ${i} уроків`);
      assert.equal(next[0].id, L[i], `${b.code}: наступний — урок ${i + 1}`);
      assert.ok(pins.filter((p) => done.includes(p.id)).every((p) => p.state === 'done'));
      assert.ok(pins.filter((p) => p.state === 'locked').every((p) => !!p.why), 'у закритої точки є пояснення');
      done.push(L[i]);
    }
    // після 5 уроків відкривається фінал
    const after = branchPins(b.code, done, undefined, ready, !!b.final?.ready);
    assert.equal(after.find((p) => p.kind === 'final')!.state, 'next', `${b.code}: фінал після 5 уроків`);
  }
});

test('007-4: сцени — вхід з точки через сцену (перший раз), «Карта» зі сцени повертає на карту гілки, повторний перегляд із картки точки', () => {
  const map = read('app-mvp/app/map/[code].tsx');
  assert.ok(map.includes("shouldShow(useStore.getState().seenScenes, sceneKey(id))"), 'перший вхід — сцена');
  assert.ok(map.includes('🎬 Переглянути сцену закладу') && map.includes("router.push({ pathname: '/scene/[id]', params: { id: selPin.id } })"), 'повторний перегляд');
  const scene = read('app-mvp/app/scene/[id].tsx');
  assert.ok(scene.includes("onMap={() => router.replace({ pathname: '/map/[code]', params: { code } })}"), 'зі сцени — на карту своєї гілки');
  assert.ok(scene.includes("if (ref.unit.sim === 'leads') router.replace('/leads');"), 'фінал товарки зі сцени — у тренажер');
});
