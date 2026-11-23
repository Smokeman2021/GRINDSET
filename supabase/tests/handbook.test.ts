import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handbookRouteId } from '../../app-mvp/src/data/academyIds.ts';
import { ACADEMY_HOME, HANDBOOK, HANDBOOK_SPECIALIZATIONS } from '../../app-mvp/src/data/academy/handbookCourses.ts';
import { handbookLessons, handbookReferences, handbookSandboxCases } from '../../app-mvp/src/data/academy/handbookData.ts';
import { sandboxRun } from '../../app-mvp/src/data/academy/handbookSandbox.ts';
import { canOpenBranchUnit, finalOpen, gradeFinal, unitKind } from '../../app-mvp/src/data/branchRules.ts';
import { unitById } from '../../app-mvp/src/data/branches/index.ts';
import { kbGet, kbList } from '../../app-mvp/src/data/kb.ts';

test('the complete handbook has playable units and a canonical, answer-free reading view', () => {
  assert.equal(handbookLessons.length, 122);
  assert.equal(handbookLessons.reduce((sum, entry) => sum + entry.exerciseIds.length, 0), 137);
  assert.equal(new Set(handbookLessons.map(handbookRouteId)).size, handbookLessons.length);
  for (const entry of handbookLessons) {
    const id = handbookRouteId(entry);
    assert.ok(id.length <= 64 && /^[A-Za-z0-9_:.-]+$/.test(id), id);
    const ref = unitById(id);
    assert.ok(ref?.unit.ready, id);
    assert.equal(ref.unit.steps[0].type, 'teach');
    if (ref.unit.steps[0].type === 'teach') assert.equal(ref.unit.steps[0].body, entry.reading);
    assert.deepEqual(new Set(ref.unit.steps.map((step) => step.part).filter(Boolean)), new Set(['decision', 'data', 'next']));
    assert.ok(ref.unit.steps.length > 3, id);
    const article = kbGet(entry.id, 'uk');
    assert.equal(article?.body, entry.reading);
    assert.equal(article?.solution, undefined);
    if (entry.isFinal) {
      assert.equal(gradeFinal(ref.unit.steps, () => false, {}).passed, false, id);
      assert.equal(gradeFinal(ref.unit.steps, () => true, {}).passed, true, id);
    }
  }
  assert.equal(handbookReferences.length, 72);
  assert.ok(kbList('uk', { query: 'Лід' }).length > 0);
});

test('the new path preserves the old path and recognizes chapter-specific boss unlocks', () => {
  assert.equal(ACADEMY_HOME.length, 8);
  assert.equal(HANDBOOK_SPECIALIZATIONS.length, 3);
  assert.ok(ACADEMY_HOME.every(({ code }) => code.endsWith('-A2')));
  assert.ok(kbList('uk', { handbookOnly: true }).every(({ id }) => id.startsWith('HB-')));
  assert.equal(kbList('uk', { handbookOnly: true }).length, 194);
  assert.ok(unitById('BR-STA-A1-L01'));
  for (const branch of HANDBOOK) {
    assert.ok(branch.final?.id && !finalOpen(branch.code, ['BR-STA-A1-L01'], undefined), branch.code);
    assert.ok(finalOpen(branch.code, branch.lessons.map(({ id }) => id), undefined), branch.code);
    assert.equal(unitKind(branch.final?.id ?? ''), 'final');
  }
  const start = HANDBOOK.find((branch) => branch.code === 'STA-A2');
  const bossIndex = start?.lessons.findIndex((unit) => unit.boss) ?? -1;
  assert.ok(start && bossIndex > 0);
  const boss = start.lessons[bossIndex];
  assert.equal(canOpenBranchUnit(start.code, 'lesson', [], undefined, boss.id), false);
  assert.equal(canOpenBranchUnit(start.code, 'lesson', start.lessons.slice(0, bossIndex).map(({ id }) => id), undefined, boss.id), true);
});

test('the eleven sandbox scenarios separate accrual, contribution and cash', () => {
  assert.equal(handbookSandboxCases.length, 11);
  for (const source of handbookSandboxCases) {
    const base = sandboxRun(source, 1, 0);
    assert.equal(base.mature.payable, source.matureAccepted);
    assert.equal(base.mature.accrual, source.matureAccepted * source.payout);
    assert.equal(base.mature.cash, source.matureCash);
    const scaled = sandboxRun(source, 1, 0, 'scale');
    assert.ok(scaled.totalCash < base.totalCash);
    assert.equal(scaled.mature.contribution, base.mature.contribution);
  }
});
