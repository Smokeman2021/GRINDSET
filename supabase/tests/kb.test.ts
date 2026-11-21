// Автотести «Бази» (ТЗ 004, етап B): дані бандла, білий список, мови, єдиний ID, вправи, шаблони.
// Перевірка витоку в зібраному бандлі — supabase/tests/kb-leak.test.ts (потребує веб-збірки).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldCorrect, kbGet, kbIds, kbList, kbMeta, KB_STARTER, templateParts } from '../../app-mvp/src/data/kb.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const include = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-include.json'), 'utf8')) as { items: { id: string; status: string; kind: string }[] };
const GEN = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated', 'kb');
const genText = ['meta.ts', 'texts.uk.ts', 'texts.ru.ts', 'texts.en.ts'].map((f) => fs.readFileSync(path.join(GEN, f), 'utf8')).join('\n');

test('у бандл іде лише білий список: кожен ID даних є в kb-include зі status include, і навпаки', () => {
  const inc = new Set(include.items.filter((i) => i.status === 'include').map((i) => i.id));
  const ids = kbIds();
  assert.deepEqual([...ids].sort(), [...inc].sort());
  for (const i of include.items.filter((x) => x.status !== 'include')) assert.equal(kbMeta(i.id), undefined, `${i.id} поза білим списком потрапив у дані`);
});

test('склад білого списку — максимум за ТЗ: усі ready-картки й кейси 01–12, GEO-01, вертикалі, M22, SUP, 017, самозвіти з позначкою', () => {
  const ids = new Set(kbIds());
  for (const p of ['ECO', 'TRK', 'EXP', 'VRT', 'PAY', 'SUB', 'NUT', 'RSK', 'MET', 'FB', 'FBR', 'TOOL', 'OPS']) assert.ok([...ids].some((i) => i.startsWith(`${p}-`)), p);
  for (let n = 1; n <= 12; n++) assert.ok(ids.has(`CASE-${String(n).padStart(2, '0')}`));
  for (const id of ['GEO-01', 'M22-01', 'M22-02', 'M22-03', 'SUP-01', 'SUP-02', 'SUP-03', 'SUP-04', 'SUP-05', 'SUP-06', 'EX17-SRV', 'EX17-INF', 'FBK-020', 'FBK-021']) assert.ok(ids.has(id), id);
  for (const v of ['TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT']) assert.ok(ids.has(`VERT-${v}`));
  for (const id of ['FBK-020', 'FBK-021']) assert.deepEqual(kbMeta(id)!.labels, ['self-report']);
  // REVIEW-CONTENT-b26 §3 (ТЗ 006): GDE-01–04, 06–11, CASE-13, INS-02/03/07/08 — у бандлі; GDE-05 і INS-01/04/05/06/09/10 — ні
  for (const id of ['GDE-01', 'GDE-04', 'GDE-06', 'GDE-11', 'CASE-13', 'INS-02', 'INS-03', 'INS-07', 'INS-08']) assert.ok(kbMeta(id), id);
  for (const id of ['GDE-05', 'INS-01', 'INS-04', 'INS-05', 'INS-06', 'INS-09', 'INS-10']) assert.equal(kbMeta(id), undefined, id);
  assert.ok(!genText.includes('BR-TOV-FINAL'));
  // каталоги софту 014-03, 015-03, 016-03 і довідка 016-02 не включаються
  assert.ok(!/SOFTWARE_UKRAINE|AI_SOFTWARE|INSTRUMENTS_AND_POLICY/.test(genText));
  // теги: PAY-02/03 також для дейтингу й адалту; SUP-03 — методичка без мітки «навчальні дані»; CASE-13 — uk/ru
  for (const id of ['PAY-02', 'PAY-03']) for (const v of ['dat', 'adt'] as const) assert.ok(kbMeta(id)!.verticals.includes(v), `${id} ${v}`);
  assert.deepEqual(kbMeta('SUP-03')!.labels, []);
  assert.deepEqual(kbMeta('CASE-13')!.langs, ['uk', 'ru']);
  // CASE-13: ключ відокремлено від умови; INS-02/03 ведуть до наявних калькуляторів, INS-07/08 — без обіцянки окремого інструмента
  const c13 = kbGet('CASE-13', 'uk')!;
  assert.ok(c13.solution?.includes('$6,67') && !c13.body.includes('$6,67'));
  assert.ok(kbGet('INS-02', 'uk')!.body.includes('«Гранична вартість ліда»') && kbGet('INS-03', 'uk')!.body.includes('«Беззбитковість і ROI»'));
  for (const id of ['INS-07', 'INS-08']) assert.ok(kbGet(id, 'uk')!.body.includes('окремого інструмента немає'), id);
});

test('заборонені рядки й редакторські вставки відсутні в даних бандла', () => {
  for (const s of ['fb-killa', 'research-private', 'Внутрішній реєстр', 'Редакторський реєстр', 'Джерела для редактора', 'ftvclub', 'GRINDSET · партія', 'Основа: G22', 'Формат продукту', 'внутрішній каталог', 'Що піде в модуль']) {
    assert.ok(!genText.toLowerCase().includes(s.toLowerCase()), s);
  }
});

test('мови: спільні ID; немає перекладу → українська з позначкою; RU/EN для карток і кейсів 001–013', () => {
  const ru = kbGet('ECO-01', 'ru')!;
  assert.equal(ru.lang, 'ru');
  assert.equal(ru.fallback, false);
  const geoEn = kbGet('GEO-01', 'en')!;
  assert.equal(geoEn.lang, 'uk');
  assert.equal(geoEn.fallback, true);
  // MET-06, MET-07, VRT-07, CASE-13 (ТЗ 006): EN немає — після передачі перекладачу
  const EXTRA_UK_RU = new Set(['MET-06', 'MET-07', 'VRT-07', 'CASE-13']);
  for (const id of kbIds().filter((i) => /^(ECO|TRK|EXP|VRT|PAY|SUB|NUT|RSK|MET|FB|FBR|TOOL|OPS|CASE)-/.test(i) && !EXTRA_UK_RU.has(i))) assert.deepEqual(kbMeta(id)!.langs, ['uk', 'ru', 'en'], id);
  for (const id of EXTRA_UK_RU) assert.deepEqual(kbMeta(id)!.langs, ['uk', 'ru'], id);
});

test('кейси: розбір відокремлено від умови в усіх мовах (показується лише після спроби)', () => {
  for (let n = 1; n <= 12; n++) {
    const id = `CASE-${String(n).padStart(2, '0')}`;
    for (const l of ['uk', 'ru', 'en'] as const) {
      const a = kbGet(id, l)!;
      assert.ok(a.solution && a.solution.length > 20, `${id} ${l}: немає розбору`);
      assert.ok(!/(^|\n)\**(Ключ|Розбір|Разбор|Answer|Key)[.:*]/u.test(a.body), `${id} ${l}: розбір в умові`);
    }
  }
});

test('вправи SUP і 017: умова без відповіді, поля перевіряються, еталон і критерії окремо', () => {
  for (const id of ['SUP-01', 'SUP-02', 'SUP-04', 'SUP-05', 'SUP-06', 'EX17-SRV', 'EX17-INF']) {
    const a = kbGet(id, 'uk')!;
    assert.ok(a.exercise && a.exercise.fields.length >= 3, id);
    assert.ok(a.exercise.criteria.length >= 2, id);
    assert.ok(a.solution, id);
    // відповіді числових полів не видно в умові
    for (const f of a.exercise.fields) if (f.type === 'number' && Math.abs(f.answer) >= 10) assert.ok(!a.body.includes(`${f.answer}%`) && !a.body.includes(`₴${f.answer}`), `${id}: відповідь ${f.answer} в умові`);
  }
  assert.equal(kbGet('SUP-03', 'uk')!.exercise, undefined); // SUP-03 — лише методичка, без оцінки
  const f = kbGet('SUP-01', 'uk')!.exercise!.fields;
  assert.equal(fieldCorrect(f[0], '25'), true);
  assert.equal(fieldCorrect(f[0], '25,3'), true);
  assert.equal(fieldCorrect(f[0], '27'), false);
  assert.equal(fieldCorrect(f[3], 0), true);
  assert.equal(fieldCorrect(f[4], [3, 2, 1, 0]), true);
  assert.equal(fieldCorrect(f[4], [0, 1, 2]), false);
});

test('шаблони M22: чекліст і поля шаблону рішення/перевірки/брифу', () => {
  const m1 = templateParts(kbGet('M22-01', 'uk')!.body);
  assert.equal(m1.steps.length, 5);
  assert.ok(m1.forms[0].fields.includes('рішення'));
  const m2 = templateParts(kbGet('M22-02', 'uk')!.body);
  assert.equal(m2.steps.length, 5);
  assert.ok(m2.forms.length >= 1);
  const m3 = templateParts(kbGet('M22-03', 'uk')!.body);
  assert.ok(m3.forms.some((x) => x.title === 'Бриф'));
  assert.ok(m3.steps.length >= 3);
});

// glossary.ts тягне модулі без розширень (Metro), тому в Node читаємо його як текст
const GLOSS = fs.readFileSync(path.join(ROOT, 'app-mvp', 'src', 'data', 'glossary.ts'), 'utf8');
const ARTICLE = Object.fromEntries([...(GLOSS.match(/const ARTICLE[^{]*\{([\s\S]*?)\};/)?.[1] ?? '').matchAll(/(\w+): '([A-Z0-9-]+)'/g)].map((m) => [m[1], m[2]]));
const TERM_IDS = [...GLOSS.matchAll(/\{ id: '([a-z_]+)'/g)].map((m) => m[1]);

test('єдиний ID: терміни глосарію ведуть на наявні статті; стартова добірка повна', () => {
  const withArticle = Object.entries(ARTICLE);
  assert.ok(withArticle.length >= 20);
  for (const [term, id] of withArticle) {
    assert.ok(TERM_IDS.includes(term), `термін ${term} не існує`);
    assert.ok(kbGet(id, 'uk'), `${term} → ${id}`);
  }
  for (const g of KB_STARTER) for (const id of g.ids) assert.ok(kbGet(id, 'uk'), id);
  assert.deepEqual(KB_STARTER.flatMap((g) => g.ids), ['GEO-01', 'ECO-01', 'ECO-02', 'ECO-03', 'ECO-04', 'PAY-01', 'M22-01', 'M22-02', 'TRK-01', 'M22-03', 'EXP-02', 'EXP-03']);
  assert.equal(new Set(TERM_IDS).size, TERM_IDS.length); // доповнення глосарію без дублів
});

test('пошук і фільтри: заголовок, текст; вертикаль і задача; розбір не шукається', () => {
  assert.ok(kbList('uk', { query: 'когорт' }).length > 3);
  assert.equal(kbList('uk', { query: 'GEO-01' })[0].id, 'GEO-01');
  const gam = kbList('uk', { section: 'guides', vertical: 'gam', task: 'risk' }).map((a) => a.id);
  assert.ok(gam.includes('RSK-01') && gam.includes('VERT-GAM'));
  assert.ok(!gam.includes('RSK-05'));
  assert.equal(kbList('uk', { query: 'зовсімнеіснуючеслово' }).length, 0);
  // фраза лише з розбору CASE-03 не знаходиться
  assert.ok(!kbList('uk', { query: 'Внесок A = $0' }).some((a) => a.id === 'CASE-03'));
});
