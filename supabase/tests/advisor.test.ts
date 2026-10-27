// Автотести «Порадника». Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { advise, daysAgo, DEFAULT_PARAMS } from '../../app-mvp/src/data/advisor.ts';
import type { AdvisorInput } from '../../app-mvp/src/data/advisor.ts';

const base: AdvisorInput = {
  level: 'adset', budget: 20, spend: 40, days: 2, cpl: 2.5, leadsPerDay: 8, bid: 2, bidHistory: 'none',
  mode: 'ABO', structure: '1-1-1', daysSinceLaunch: 5, daysSinceChange: 3, swings: false, badSetup: false,
};
const a = (o: Partial<AdvisorInput>) => advise({ ...base, ...o });

test('усе в нормі → тримай', () => assert.equal(a({}).code, 'hold'));

test('«просить» (+7–20%) при CPL у нормі → +20% бюджету', () => {
  const r = a({ spend: 44 }); // 44 / (20*2) = +10%
  assert.equal(r.code, 'raise_budget');
  assert.equal(r.value, 24);
});

test('перевитрата при дорогому ліді бюджет не піднімає', () => {
  const r = a({ spend: 44, cpl: 3.6 });
  assert.equal(r.code, 'hold');
});

test('CPL росте в межах бюджету → ставка плюс 0.10 або 0.25 за розривом', () => {
  const small = a({ cpl: 3.3 }); // розрив 10%
  assert.equal(small.code, 'raise_bid');
  assert.equal(small.value, 2.1);
  const big = a({ cpl: 4.5 }); // розрив 50%
  assert.equal(big.value, 2.25);
});

test('ставку піднімали 3+ рази → перезапуск', () => assert.equal(a({ cpl: 3.5, bidHistory: 'many' }).code, 'restart'));

test('перша зміна менш ніж 2 дні тому → чекай', () => assert.equal(a({ daysSinceChange: 1, cpl: 3.5 }).code, 'wait'));

test('качелі: CBO → розділити, ABO → перезапуск', () => {
  assert.equal(a({ swings: true, mode: 'CBO' }).code, 'split');
  assert.equal(a({ swings: true, mode: 'ABO' }).code, 'restart');
});

test('поганий сет-ап → новий запуск, навіть якщо є що «вбивати»', () => assert.equal(a({ badSetup: true, cpl: null, leadsPerDay: 0, spend: 99 }).code, 'new_launch'));

test('поріг «вбивати»: без лідів витрати ≥ 3 × поріг; або CPL ≥ 1.5 × поріг після 4 днів і правок', () => {
  assert.equal(a({ cpl: null, leadsPerDay: 0, spend: 9 }).code, 'kill');
  assert.equal(a({ cpl: null, leadsPerDay: 0, spend: 8 }).code, 'hold');
  assert.equal(a({ cpl: 4.6, bidHistory: 'few', daysSinceLaunch: 5 }).code, 'kill');
  assert.equal(a({ cpl: 4.6, bidHistory: 'none', daysSinceLaunch: 5 }).code, 'raise_bid'); // ще не пробували ставку
});

test('поріг CPL редагується', () => {
  assert.equal(advise({ ...base, cpl: 3.5 }, { ...DEFAULT_PARAMS, cplThreshold: 4 }).code, 'hold');
});

test('некоректний ввід не видає поради', () => assert.equal(a({ budget: 0 }).code, 'invalid'));

test('daysAgo: число днів і дата', () => {
  const today = new Date(2026, 9, 27);
  assert.equal(daysAgo('3', today), 3);
  assert.equal(daysAgo('2026-10-24', today), 3);
  assert.equal(daysAgo('2026-11-01', today), null);
  assert.equal(daysAgo('вчора', today), null);
});
