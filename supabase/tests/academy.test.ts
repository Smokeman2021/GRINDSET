import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACADEMY } from '../../app-mvp/src/data/academy/courses.ts';
import { expansionContent } from '../../app-mvp/src/data/academy/expansionContent.ts';
import { branchCrowns, canOpenBranchUnit, finalOpen, gradeFinal, lessonIds, mergeBranchProg, nextUnit } from '../../app-mvp/src/data/branchRules.ts';
import { branchPins } from '../../app-mvp/src/data/branchMap.ts';
import { branchScene } from '../../app-mvp/src/data/branchScenes.ts';
import { getBranch, questionSteps, readyLessonIds, unitById } from '../../app-mvp/src/data/branches/index.ts';
import { resolveDeepLink } from '../../app-mvp/src/data/deepLink.ts';
import { kbGet } from '../../app-mvp/src/data/kb.ts';
import { continueTarget, mergePlace, resumeFor, type LessonPlace } from '../../app-mvp/src/data/place.ts';

test('Academy routes, questions and references exist for every module and added lesson', () => {
  assert.equal(ACADEMY.length, 9);
  const ids = ACADEMY.flatMap((branch) => readyLessonIds(branch));
  assert.equal(new Set(ids).size, 86 + expansionContent.length);
  for (const b of ACADEMY) {
    assert.equal(getBranch(b.code), b);
    assert.deepEqual(readyLessonIds(b), lessonIds(b.code));
    assert.equal(new Set(b.lessons.map(l => l.module?.id)).size, b.code === 'STA-A1' ? 6 : 10);
    assert.equal(b.selfcheck.length, b.code === 'STA-A1' ? 3 : 2);
    assert.ok(kbGet(b.kbCard, 'uk'), b.kbCard);
    for (const lesson of b.lessons) {
      assert.equal(unitById(lesson.id)?.unit, lesson);
      assert.equal(lesson.steps[0].type, 'teach');
      assert.ok(questionSteps(lesson).length >= 1, lesson.id);
      for (const id of lesson.kb) assert.ok(kbGet(id, 'uk'), id);
    }
    for (const step of [...b.selfcheck, ...b.practice.steps, ...b.final?.steps ?? []]) {
      if (step.see) assert.equal(unitById(step.see)?.branch, b, step.see);
    }
  }
  assert.equal(unitById('BR-STA-A1-FINAL'), undefined);
  assert.equal(unitById('BR-TOV-L10'), undefined);
});

test('added lessons stay in their own modules and preserve an already passed Academy final', () => {
  for (const lesson of expansionContent) {
    const [code, module] = lesson.module.split('-');
    const id = `BR-${code}-A1-${lesson.key.split('-').slice(1).join('-')}`;
    const registered = unitById(id);
    assert.equal(registered?.unit.module?.id, lesson.module);
    const order = lessonIds(`${code}-A1`);
    assert.ok(order.indexOf(id) > order.indexOf(`BR-${code}-A1-L${module.slice(1)}`), id);
  }
  const final = 'BR-TOV-A1-FINAL';
  assert.equal(finalOpen('TOV-A1', [final], undefined), true);
  assert.equal(nextUnit('TOV-A1', [final], { sc: 'pass', practice: 'pass' }, lessonIds('TOV-A1'), true), 'BR-TOV-A1-L01');
});

test('legacy completion and diagnostics do not open the new final', () => {
  const code = 'TOV-A1';
  const history = [...lessonIds('TOV'), 'BR-TOV-PR', 'BR-TOV-FINAL'];
  const progress = mergeBranchProg({ TOV: { sc: 'pass', practice: 'pass' } }, { [code]: { started: true } });
  assert.equal(unitById('BR-TOV-FINAL')?.unit.sim, 'leads');
  assert.equal(canOpenBranchUnit(code, 'practice', history, progress[code]), false);
  assert.equal(canOpenBranchUnit(code, 'final', history, progress[code]), false);
  assert.equal(nextUnit(code, history, progress[code], lessonIds(code), true), 'BR-TOV-A1-L01');
  assert.equal(finalOpen(code, [...history, ...lessonIds(code).slice(0, -1)], progress[code]), false);
  assert.equal(finalOpen(code, [...history, ...lessonIds(code)], progress[code]), true);
  assert.equal(finalOpen(code, history, { practice: 'pass' }), false);
  assert.equal(canOpenBranchUnit(code, 'practice', history, { sc: 'pass' }), true);
  assert.equal(finalOpen(code, history, { sc: 'pass', practice: 'pass' }), true);
  assert.equal(branchCrowns([...history, ...lessonIds(code), 'BR-TOV-A1-FINAL'], ['TOV']), 2);
});

test('each independent final requires decision, data and next step', () => {
  const checked = ACADEMY.filter(b => b.final);
  assert.equal(checked.length, 8);
  for (const b of checked) {
    const steps = b.final!.steps;
    assert.deepEqual(steps.filter((s) => s.type !== 'teach').map((s) => s.part), ['decision', 'data', 'next']);
    assert.equal(gradeFinal(steps, () => true, { 1: 0 }).passed, true);
    for (const [index, part] of [[1, 'decision'], [2, 'data'], [3, 'next']] as const) {
      const result = gradeFinal(steps, i => i !== index, { 1: 0 });
      assert.equal(result.passed, false);
      assert.equal(result.gaps[0].part, part);
    }
    if (b.regulated) assert.ok(gradeFinal(steps, () => true, { 1: 1 }).blocked);
  }
});

test('Academy answers do not reveal the key by excess length', () => {
  for (const b of ACADEMY) {
    const steps = [...b.selfcheck, ...b.practice.steps, ...b.lessons.flatMap(l => l.steps), ...b.final?.steps ?? []];
    for (const step of steps) {
      if (step.type !== 'choice') continue;
      assert.equal(new Set(step.options).size, step.options.length, step.q);
      const distractorMax = Math.max(...step.options.filter((_, i) => i !== step.answer).map(text => text.length));
      assert.ok(step.options[step.answer].length <= distractorMax * 1.2, step.q);
    }
  }
});

test('new map, deep link and resume at the first step survive the previous course', () => {
  const code = 'TOV-A1';
  const ids = lessonIds(code);
  const pins = branchPins(code, lessonIds('TOV'), undefined, ids, true);
  assert.deepEqual(pins.map((pin) => pin.id), [...ids, 'BR-TOV-A1-PR', 'BR-TOV-A1-FINAL']);
  assert.equal(pins.at(-1)?.state, 'locked');
  assert.ok(pins.every((pin) => branchScene(code, pin.id)?.locId === pin.locId));
  const link = resolveDeepLink('/lesson/BR-TOV-A1-L10', {
    isAdmin: false, branchExists: key => !!getBranch(key), kbExists: id => !!kbGet(id, 'uk'),
    unit: id => unitById(id)?.unit ?? null,
  });
  assert.deepEqual(link, { kind: 'open', href: '/lesson/BR-TOV-A1-L10' });
  const place: LessonPlace = { kind: 'lesson', id: ids[0], idx: 0, total: 3, results: [], chosen: {}, correct: 0, errors: 0, title: 'Товарка', at: 50 };
  const box = mergePlace({ place, lastBranch: code, at: 50 }, { place: null, lastBranch: 'TOV', at: 40 });
  assert.equal(resumeFor(box, ids[0], 3)?.idx, 0);
  assert.equal(continueTarget(box, {
    completed: [], branchProg: {}, ready: () => ids, hasFinal: () => true,
    title: id => unitById(id)?.unit.title, branchTitle: id => getBranch(id)?.title,
  })?.kind, 'lesson');
});
