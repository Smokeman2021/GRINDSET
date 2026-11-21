// ТЗ 006, пункт 5: правки за REVIEW-CONTENT-b26 — правило довжини варіантів, інші ненавмисні підказки у фіналах,
// числове поле без підказки знака, плашка POLICY_PENDING, крок «яких доказів бракує», правки гілки GAM, абсурдні дистрактори.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectChoices, ratioOf, LENGTH_RATIO, LENGTH_EXCEPTIONS } from '../../app-mvp/src/data/optionLength.ts';
import { BRANCHES } from '../../app-mvp/src/data/branches/index.ts';
import { SIM_STEPS } from '../../app-mvp/src/data/simLeads.ts';
import { POLICY_PENDING, type BStep } from '../../app-mvp/src/data/branch.ts';
import { parseNum, toggleSign, NUM_KEYBOARD, NUM_PLACEHOLDER } from '../../app-mvp/src/data/numInput.ts';
import { fieldCorrect } from '../../app-mvp/src/data/kb.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const EX = JSON.parse(read('content/kb-exercises.json'));

test('006-5.2: правило довжини — правильний варіант ≤ 1,2 × найдовшого з інших у всіх виборах гілок, вправ і «Лідів» (multi — кожен правильний)', () => {
  const all = collectChoices(EX);
  assert.ok(all.length >= 120, `зібрано ${all.length} виборів`);
  // охоплення: гілки (самоперевірки, уроки, практики, фінали), вправи «Бази», «Ліди» (кроки, поля bundle, питання Б)
  for (const p of ['BR-TOV-SC', 'BR-ADT-FINAL', 'SUP-01', 'EX17-INF', 'BR-TOV-FINAL/forecast', 'BR-TOV-FINAL/rule#4', 'BR-TOV-FINAL/variant-B']) assert.ok(all.some((c) => c.where.startsWith(p)), p);
  const bad = all.filter((c) => !c.exception && ratioOf(c) > LENGTH_RATIO).map((c) => `${c.where} ${ratioOf(c).toFixed(2)}`);
  assert.deepEqual(bad, []);
  // винятки — лише з поясненням
  for (const [k, why] of Object.entries(LENGTH_EXCEPTIONS)) assert.ok(why.length > 20, k);
});

// Інші ненавмисні підказки (5.4): лише правильний варіант із цифрами; правильний повторює слова питання, а інші — ні
const words = (s: string) => new Set(s.toLowerCase().replace(/[«»"'().,:;—–!?№]/g, ' ').split(/\s+/).filter((w) => w.length >= 5));
function hints(where: string, s: BStep): string[] {
  const items: { q: string; options: string[]; correct: number[] }[] = [];
  if (s.type === 'choice') items.push({ q: s.q, options: s.options, correct: [s.answer] });
  if (s.type === 'multi') items.push({ q: s.q, options: s.options, correct: s.answers });
  if (s.type === 'bundle') s.slots.forEach((sl) => items.push({ q: `${s.q} ${sl.label}`, options: sl.options, correct: [sl.answer] }));
  const out: string[] = [];
  for (const it of items) {
    const wrong = it.options.map((_, i) => i).filter((i) => !it.correct.includes(i));
    const digit = it.options.map((o) => /\d/.test(o));
    if (it.correct.every((i) => digit[i]) && wrong.every((i) => !digit[i])) out.push(`${where}: цифри лише в правильному`);
    const qw = words(it.q);
    const ov = it.options.map((o) => [...words(o)].filter((w) => qw.has(w)).length);
    const maxWrong = Math.max(0, ...wrong.map((i) => ov[i]));
    if (it.correct.some((i) => ov[i] >= 2 && ov[i] > maxWrong)) out.push(`${where}: правильний повторює слова питання`);
  }
  return out;
}
test('006-5.4: вісім фіналів — без інших ненавмисних підказок (цифри лише в правильному, повтор слів питання)', () => {
  const found: string[] = [];
  for (const b of BRANCHES) if (b.final && !b.final.sim) b.final.steps.forEach((s, i) => found.push(...hints(`${b.final!.id}/${i + 1}`, s)));
  for (const s of SIM_STEPS) if (s.kind === 'step') found.push(...hints(`BR-TOV-FINAL/${s.id}`, s.step));
  assert.deepEqual(found, []);
});

test('006-5.4: абсурдних дистракторів немає (колір кнопки / банера, лайки)', () => {
  const texts = [JSON.stringify(BRANCHES), JSON.stringify(SIM_STEPS), JSON.stringify(EX)].join(' ').toLowerCase();
  for (const s of ['колір кнопки', 'кольору кнопки', 'колір банера', 'колір оголошення', 'колір креативу', 'яскравий колір', 'лайк', 'корпоративних кольорах']) assert.ok(!texts.includes(s), s);
});

test('006-5.3: числове поле — без плейсхолдера зі знаком, однакова клавіатура, кнопка «±» в усіх числових полях; кома/крапка, мінус', () => {
  const steps = read('app-mvp/src/components/steps.tsx');
  assert.ok(!steps.includes('зі знаком'), 'плейсхолдер зі знаком прибрано');
  assert.ok(!/f\.answer\s*</.test(steps), 'клавіатура й плейсхолдер не залежать від знака відповіді');
  assert.ok(steps.includes('keyboardType={NUM_KEYBOARD}') && steps.includes('placeholder={NUM_PLACEHOLDER}') && steps.includes('<SignButton'));
  const kb = read('app-mvp/app/kb/[id].tsx');
  assert.ok(kb.includes('<SignButton') && kb.includes('keyboardType={NUM_KEYBOARD}'), 'вправи «Бази» — те саме');
  assert.equal(NUM_KEYBOARD, 'decimal-pad');
  assert.equal(NUM_PLACEHOLDER, '0');
  // розбір
  assert.equal(parseNum('−48'), -48);
  assert.equal(parseNum('-48'), -48);
  assert.equal(parseNum('–48'), -48);
  assert.equal(parseNum('33,1'), 33.1);
  assert.equal(parseNum('33.1'), 33.1);
  assert.equal(parseNum('1 500'), 1500);
  assert.equal(parseNum('₴ 53,6'), 53.6);
  for (const bad of ['', '−', '48−', '1-2', 'abc']) assert.ok(Number.isNaN(parseNum(bad)), bad);
  // «±»
  assert.equal(toggleSign('48'), '−48');
  assert.equal(toggleSign('−48'), '48');
  assert.equal(toggleSign('-48'), '48');
  assert.equal(toggleSign(''), '−');
  // вправи «Бази»: «−» (U+2212) більше не губиться; порожнє поле не дорівнює 0
  const f = { id: 'x', type: 'number' as const, label: 'x', answer: -48, tolerance: 0.5 };
  assert.equal(fieldCorrect(f, '−48'), true);
  assert.equal(fieldCorrect(f, '48'), false);
  assert.equal(fieldCorrect({ ...f, answer: 0 }, ''), false);
});

test('006-5.5: плашка POLICY_PENDING — навчальна ситуація; у кожній регульованій гілці крок «яких доказів бракує»; policy-facts.json порожній', () => {
  assert.equal(POLICY_PENDING, '⚠️ Підтвердженого правила майданчика для цього випадку немає. Визнач, яких доказів бракує, перш ніж погоджувати запуск.');
  assert.ok(!JSON.stringify(BRANCHES).includes('до звірки. Конкретні правила'));
  assert.deepEqual(JSON.parse(read('content/policy-facts.json')), []);
  for (const b of BRANCHES.filter((x) => x.regulated)) {
    const units = [...b.lessons, b.practice, ...(b.final ? [b.final] : [])];
    const ev = units.flatMap((u) => u.steps).filter((s) => s.type === 'multi' && /доказ|бракує/i.test(s.q));
    assert.ok(ev.length >= 1, `${b.code}: крок вибору доказів, яких бракує`);
    // плашка показується в регульованій гілці
    assert.ok(JSON.stringify(b).includes('Підтвердженого правила майданчика для цього випадку немає'), `${b.code}: плашка`);
  }
});

test('006-5.1: GAM — канал у фіналі, L01 як непідтверджене твердження партнера; бриф фіналів «Прийми рішення редактора»', () => {
  const gam = BRANCHES.find((b) => b.code === 'GAM')!;
  const all = JSON.stringify(gam);
  assert.ok(all.includes('Канал: немає підтвердження, що цей канал дозволений для оператора'));
  assert.ok(!all.includes('Канал: соцмережі в Україні з обмеженнями'));
  assert.ok(!all.includes('Регулятор попереджав'));
  assert.ok(/Партнер каже: «Регулятор начебто/.test(all));
  for (const b of BRANCHES) assert.ok(!JSON.stringify(b).includes('Напиши рішення редактора'), b.code);
  assert.ok(all.includes('Прийми рішення редактора'));
});

test('006-5.6: експорт для перекладу — 8 гілок і kb-extra, стабільні ID, ключ і розбір окремими рядками', () => {
  for (const b of BRANCHES) {
    const f = read(`report/004-translate-${b.code}.uk.md`);
    for (const u of [`BR-${b.code}-SC`, ...b.lessons.map((l) => l.id), b.practice.id]) assert.ok(f.includes(`\`${u}.title\``), `${b.code}: ${u}`);
    assert.ok(f.includes('`ui.check`') && f.includes('`ui.policyPending`'), `${b.code}: кнопки й підписи`);
    // кожен вибір має рядок-ключ, а текст розбору не стоїть у рядку умови
    const rows = f.split('\n').filter((l) => l.startsWith('| `'));
    const keyRows = rows.filter((l) => l.includes('**ключ**'));
    assert.ok(keyRows.length > 5, `${b.code}: ключі окремими рядками`);
    assert.ok(!rows.some((l) => /\.src`/.test(l)), 'службові формулювання 023 не експортуються');
    for (const l of rows.filter((x) => / \| умова \| /.test(x))) assert.ok(!/^\| `[^`]+\.(answer|explain|ok|no)`/.test(l), l.slice(0, 60));
  }
  assert.ok(read('report/004-translate-TOV.uk.md').includes('`BR-TOV-FINAL.variantB.answer`'), 'тренажер «Ліди» у файлі TOV');
  const kb = read('report/004-translate-kb-extra.uk.md');
  for (const id of ['MET-06', 'MET-07', 'VRT-07', 'SUP-01', 'SUP-06', 'EX17-SRV', 'EX17-INF', 'CASE-13', 'INS-07']) assert.ok(kb.includes(`\`${id}.title\``), id);
  assert.ok(kb.includes('`SUP-01.etalon` | еталон | після спроби'), 'еталон вправи — після спроби');
});
