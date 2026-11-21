// ТЗ 006, пункти 3–4: сцени подорожі в гілках, пари у дві колонки, кнопка відгуку в межах колонки з контрастом ≥ 3:1,
// вкладки адмінки без перенесення підписів.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANCHES } from '../../app-mvp/src/data/branches/index.ts';
import { branchScene, branchScenes, INTRO_LOC, sceneKey, shouldShow, travelCaption, travelKey } from '../../app-mvp/src/data/branchScenes.ts';
import { allPaired, assignPair, matchOk, pairNoOfRight, unpairRight } from '../../app-mvp/src/data/matchRules.ts';
import { fabPlace } from '../../app-mvp/src/data/fabPlace.ts';
import { mergeClientState } from '../../app-mvp/src/cloud/shared/progressOps.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const LEVELS = read('app-mvp/src/art/levels.ts');

test('006-3.1: кожна з 8 гілок — 8 сцен (вступ, 5 уроків, практика, фінал) у наявних закладах Києва; акт росте до фіналу', () => {
  for (const b of BRANCHES) {
    const sc = branchScenes(b.code);
    assert.deepEqual(sc.map((s) => s.stage), ['intro', 'lesson', 'lesson', 'lesson', 'lesson', 'lesson', 'practice', 'final'], b.code);
    for (const s of sc) assert.ok(new RegExp(`\\n  ${s.locId}: \\{`).test(LEVELS), `${b.code}: ${s.locId} є в LOCS`);
    assert.equal(sc[0].locId, INTRO_LOC);
    // «модуль» подорожі не спадає: околиця → перші гроші → свій рух
    for (let i = 1; i < sc.length; i++) assert.ok(sc[i].moduleNo >= sc[i - 1].moduleNo);
    assert.equal(sc[7].moduleNo, 8, 'фінал — «Свій рух» (Печерськ — після рішення щодо карти)');
  }
  assert.equal(branchScene('TOV', 'BR-SRV-L01'), null, 'чужа одиниця — немає сцени');
});

test('006-3.1: перший перегляд — сцена й переїзд; повторно — одразу завдання; переглянуте зберігається в знімку', () => {
  assert.equal(shouldShow([], sceneKey('BR-TOV-L01')), true);
  assert.equal(shouldShow(['scene:BR-TOV-L01'], sceneKey('BR-TOV-L01')), false);
  assert.equal(shouldShow(['scene:BR-TOV-L01'], travelKey('BR-TOV-L01')), true);
  const m = mergeClientState({ seenScenes: ['scene:BR-TOV-L01'] }, { seenScenes: ['travel:BR-TOV-L01'] }) as { seenScenes: string[] };
  assert.deepEqual(m.seenScenes.sort(), ['scene:BR-TOV-L01', 'travel:BR-TOV-L01']);
  // вхід у одиницю з гілки й карти — через сцену, якщо її ще не бачили
  for (const f of ['app-mvp/app/branch/[code].tsx', 'app-mvp/app/map/[code].tsx']) assert.ok(read(f).includes("shouldShow(useStore.getState().seenScenes, sceneKey(id))"), f);
  assert.ok(read('app-mvp/app/map/[code].tsx').includes('<Travel '), 'переїзд після одиниці на карті');
  assert.ok(read('app-mvp/app/scene/[id].tsx').includes('<StopScene'), 'сцена — наявний StopScene');
});

test('006-3.1: на переїзді — який навик освоєно й що відкрилось', () => {
  assert.deepEqual(travelCaption('Порахуй межу', ['Практика', 'Фінал'], 'Практика'), { skill: 'Освоєно: Порахуй межу', opened: 'Відкрилось: Практика, Фінал' });
  assert.deepEqual(travelCaption('Порахуй межу', [], 'Урок 3'), { skill: 'Освоєно: Порахуй межу', opened: 'Далі — Урок 3' });
  assert.deepEqual(travelCaption('Фінал', [], null), { skill: 'Освоєно: Фінал', opened: 'Гілку пройдено' });
});

test('006-3.4: пари у дві колонки — зліва, потім справа; один правий — одна пара; повторний дотик знімає пару; перевірка', () => {
  const pairs: [string, string][] = [['Чи працює доставка події; що отримує алгоритм', '30, кабінет'], ['Гроші: CPL для економіки, апрув, результат', '28, CRM'], ['Довга назва', 'Коротка']];
  const rights = ['28, CRM', 'Коротка', '30, кабінет'];
  let a = assignPair({}, 0, 2);
  a = assignPair(a, 1, 0);
  assert.equal(pairNoOfRight(a, 2), 1);
  assert.equal(pairNoOfRight(a, 0), 2);
  assert.equal(allPaired(a, 3), false);
  // той самий правий для іншого лівого — забирається
  a = assignPair(a, 2, 0);
  assert.deepEqual(a, { 0: 2, 2: 0 });
  a = unpairRight(a, 0);
  assert.deepEqual(a, { 0: 2 });
  a = assignPair(assignPair(a, 1, 0), 2, 1);
  assert.equal(allPaired(a, 3), true);
  assert.equal(matchOk(pairs, rights, a), true);
  assert.equal(matchOk(pairs, rights, { 0: 0, 1: 2, 2: 1 }), false);
  const src = read('app-mvp/src/components/steps.tsx');
  assert.ok(src.includes('styles.matchCols') && src.includes("matchCols: { flexDirection: 'row'"), 'дві колонки');
  assert.ok(src.includes("matchTxt: { color: C.txt, fontSize: 14, lineHeight: 19, fontWeight: '700', flexShrink: 1 }"), 'довгі назви переносяться всередині картки');
  assert.ok(!/numberOfLines/.test(src.slice(src.indexOf('export function MatchStep'), src.indexOf('// ─── Вписати число'))), 'текст пар не обрізається');
});

// контраст (WCAG): відносна яскравість
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const themeColor = (block: 'night' | 'day', key: string) => {
  const t = read('app-mvp/src/theme.ts');
  const start = block === 'night' ? t.indexOf("  bg: '#0d0f14'") : t.indexOf("  bg: '#f3f6fb'");
  const m = new RegExp(`\\n  ${key}: '(#[0-9a-fA-F]{6})'`).exec(t.slice(start - 200));
  return m![1];
};

test('006-4.2: 🐞 — у межах колонки застосунку, з відступом від бульбашки Гріндіка; рамка до фону ≥ 3:1 в обох темах', () => {
  // вкладки: унизу над панеллю вкладок; інші екрани: угорі; колонка 600 px або 680 px праворуч від бічної навігації
  assert.deepEqual(fabPlace('/home', 390, true), { placement: 'bottom', offset: 74, column: { left: 0, maxWidth: 600 } });
  assert.deepEqual(fabPlace('/home', 1440, true), { placement: 'bottom', offset: 16, column: { left: 190, maxWidth: 680 } });
  assert.deepEqual(fabPlace('/kb/ECO-01', 1440, true), { placement: 'top', offset: 8, column: { left: 0, maxWidth: 600 } });
  assert.equal(fabPlace('/scene/BR-TOV-L02', 390, true).offset, 54, 'на сцені — під рядком HUD');
  const fab = read('app-mvp/src/components/FeedbackSheet.tsx');
  assert.ok(fab.includes('borderColor: C.muted') && fab.includes('backgroundColor: C.panel'));
  for (const t of ['night', 'day'] as const) {
    const r = contrast(themeColor(t, 'muted'), themeColor(t, 'bg'));
    assert.ok(r >= 3, `${t}: ${r.toFixed(2)}`);
  }
});

test('006-4.3: вкладки адмінки — один рядок без перенесення, горизонтальна прокрутка на вузькому екрані', () => {
  const src = read('app-mvp/app/admin.tsx');
  assert.ok(src.includes('<ScrollView horizontal') && src.includes('numberOfLines={1}'));
  assert.ok(src.includes("tab: { flexGrow: 1, flexShrink: 0"), 'вкладка не стискається до перенесення');
});
