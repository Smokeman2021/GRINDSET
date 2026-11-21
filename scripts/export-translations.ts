// Експорт текстів для перекладу RU/EN (ТЗ 006, 5.6; REVIEW-CONTENT-b26 §7; уточнення Codex п. 2).
//   node --no-warnings scripts/export-translations.ts
// Вихід: report/004-translate-<КОД>.uk.md (8 гілок; у TOV — і тренажер «Ліди») і report/004-translate-kb-extra.uk.md
// (MET-06, MET-07, VRT-07, вправи «Бази», а також матеріали без EN: CASE-13, INS-02/03/07/08).
// Кожен видимий текст — окремий рядок зі стабільним ID. Ключі (правильна відповідь) і розбір — окремими рядками з позначкою
// «Показ», щоб перекладач не вніс їх в умову: умова / варіант / після спроби / ключ (не показується до спроби) / за запитом / кнопка.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANCHES } from '../app-mvp/src/data/branches/index.ts';
import { POLICY_PENDING, type Branch, type BStep, type Unit } from '../app-mvp/src/data/branch.ts';
import { ADS, AD1_FIXED, CRITERIA, G, GOALS, LANDING, LEAD_MARKS, LEVEL_ITEMS, REASONS, SIM_STEPS, SLICE_D3, SLICE_D6, VARIANT_B_CHECK, VARIANTS, AD_FIELD_LABELS } from '../app-mvp/src/data/simLeads.ts';
import { kbGet } from '../app-mvp/src/data/kb.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'report');
type Row = [id: string, field: string, show: string, text: string];
const esc = (s: string) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const table = (rows: Row[]) => ['| ID | Поле | Показ | UA |', '|---|---|---|---|', ...rows.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} | ${esc(r[3])} |`)].join('\n');

const COND = 'умова';
const OPT = 'варіант';
const AFTER = 'після спроби';
const KEY = '**ключ** — не показувати до спроби';
const ONREQ = 'за запитом';

function stepRows(id: string, s: BStep): Row[] {
  const r: Row[] = [];
  const p = (f: string, show: string, t: string | undefined) => {
    if (t !== undefined && t !== '') r.push([`${id}.${f}`, f.split('.')[0], show, t]);
  };
  if (s.type === 'teach') {
    p('title', COND, s.title);
    p('body', COND, s.body);
    (s.cards ?? []).forEach((c, i) => {
      p(`card.${i + 1}.title`, COND, c.title);
      p(`card.${i + 1}.text`, COND, c.text);
    });
    return r;
  }
  const q = s as Record<string, unknown> & BStep;
  p('scenario', COND, q.scenario as string | undefined);
  p('q', COND, q.q as string | undefined);
  if (Array.isArray(q.options)) (q.options as string[]).forEach((o, i) => p(`opt.${i + 1}`, OPT, o));
  if (s.type === 'choice' || s.type === 'fill') p('answer', KEY, `opt.${(s.answer as number) + 1}`);
  if (s.type === 'multi') p('answer', KEY, s.answers.map((a) => `opt.${a + 1}`).join(', '));
  if (s.type === 'numeric')
    s.fields.forEach((f, i) => {
      p(`field.${i + 1}.label`, COND, f.label);
      p(`field.${i + 1}.unit`, COND, f.unit);
      p(`field.${i + 1}.answer`, KEY, `${f.answer}${f.tolerance !== undefined ? ` (допуск ±${f.tolerance})` : ''}`);
    });
  if (s.type === 'bundle')
    s.slots.forEach((sl, k) => {
      p(`slot.${k + 1}.label`, COND, sl.label);
      sl.options.forEach((o, i) => p(`slot.${k + 1}.opt.${i + 1}`, OPT, o));
      p(`slot.${k + 1}.answer`, KEY, `slot.${k + 1}.opt.${sl.answer + 1}`);
    });
  if (s.type === 'match') {
    s.pairs.forEach(([a, b], i) => {
      p(`pair.${i + 1}.left`, COND, a);
      p(`pair.${i + 1}.right`, OPT, b);
    });
    p('answer', KEY, s.pairs.map((_, i) => `pair.${i + 1}.left → pair.${i + 1}.right`).join('; '));
  }
  if (s.type === 'order') {
    s.items.forEach((it, i) => p(`item.${i + 1}`, OPT, it));
    p('answer', KEY, `правильний порядок: ${s.items.map((_, i) => `item.${i + 1}`).join(' → ')}`);
  }
  if (s.type === 'reflect') p('hint', ONREQ, (s as { hint?: string }).hint);
  p('hint', ONREQ, q.hint as string | undefined);
  p('ok', AFTER, q.okMsg as string | undefined);
  p('no', AFTER, q.noMsg as string | undefined);
  p('explain', AFTER, q.explain as string | undefined);
  return r;
}

function unitRows(u: Unit | { id: string; title: string; steps: BStep[] }): Row[] {
  const rows: Row[] = [[`${u.id}.title`, 'title', COND, u.title]];
  u.steps.forEach((s, i) => rows.push(...stepRows(`${u.id}.s${i + 1}`, s)));
  return rows;
}

// Кнопки й підписи екрана уроку — однакові ID у всіх файлах
const UI: Row[] = [
  ['ui.check', 'кнопка', 'кнопка', 'Перевірити'],
  ['ui.next', 'кнопка', 'кнопка', 'Далі'],
  ['ui.got', 'кнопка', 'кнопка', 'Зрозумів'],
  ['ui.finish', 'кнопка', 'кнопка', 'Завершити'],
  ['ui.restart', 'кнопка', 'кнопка', 'Почати заново'],
  ['ui.resume', 'підпис', COND, '↩ Продовжуємо з кроку {n} з {m}'],
  ['ui.hint', 'кнопка', 'кнопка', 'Підказка Гріндіка'],
  ['ui.numHint', 'підпис', COND, 'Впиши відповідь числом'],
  ['ui.sign', 'кнопка (доступність)', 'кнопка', 'Змінити знак числа'],
  ['ui.matchHint', 'підпис', COND, 'Торкнись елемента зліва, потім його пари справа'],
  ['ui.matchHint2', 'підпис', COND, 'Тепер обери пару справа'],
  ['ui.bundleHint', 'підпис', COND, 'Обери по одному варіанту в кожному полі'],
  ['ui.note', 'підпис', COND, 'Твоє пояснення (необовʼязково, не оцінюється)'],
  ['ui.correct', 'підпис', AFTER, 'Правильно: {відповідь}'],
  ['ui.etalon', 'підпис', AFTER, 'Еталон: {текст}'],
  ['ui.selfcheck', 'підпис', COND, '🧭 САМОПЕРЕВІРКА · {гілка} · без нагороди'],
  ['ui.final', 'підпис', COND, '🏁 ФІНАЛ · рішення, дані, наступний крок'],
  ['ui.finalNoLaunch', 'підпис', COND, ' · без запуску'],
  ['ui.practice', 'підпис', COND, '🎯 ПРАКТИКА · {гілка}'],
  ['ui.repeat', 'підпис', COND, '🔁 ПОВТОРЕННЯ · без нагороди (уже зараховано)'],
  ['ui.policyPending', 'плашка', COND, POLICY_PENDING],
  ['ui.startBasics', 'кнопка', 'кнопка', 'Почати з основ'],
  ['ui.checkSelf', 'кнопка', 'кнопка', 'Перевірити себе · 2 завдання'],
  ['ui.mapKyiv', 'кнопка', 'кнопка', '🗺 Карта Києва'],
  ['ui.enter', 'кнопка', 'кнопка', 'Увійти'],
  ['ui.toFinal', 'кнопка', 'кнопка', 'До фіналу'],
  ['ui.travelSkill', 'підпис', AFTER, 'Освоєно: {одиниця}'],
  ['ui.travelOpened', 'підпис', AFTER, 'Відкрилось: {список}'],
  ['ui.travelNext', 'підпис', AFTER, 'Далі — {одиниця}'],
  ['ui.branchDone', 'підпис', AFTER, 'Гілку пройдено'],
];

const HEAD = (title: string) =>
  [
    `# Експорт для перекладу RU/EN · ${title}`,
    '',
    '**ТЗ 006, 5.6.** Тексти після правок Ревізора (REVIEW-CONTENT-b26 §1–§6). Згенеровано `scripts/export-translations.ts` з даних застосунку — не редагувати вручну, правки вносити в дані й перегенерувати.',
    '',
    '**Як перекладати.** Кожен рядок — один видимий текст зі стабільним ID (`<одиниця>.s<крок>.<поле>`). Переклад повертати таблицею з тими самими ID (колонки `RU`, `EN`).',
    '- **Показ: ключ** — правильна відповідь як посилання на ID варіанта/числа. Не перекладається й не вноситься в умову: застосунок показує її лише після спроби.',
    '- **Показ: після спроби** — розбір, «Вірно / Не зовсім»; **за запитом** — підказка. Не переносити в умову.',
    '- Довжина: правильний варіант не довший за 1,2 × найдовшого з інших (у перекладі теж); числа, валюту й ID не змінювати; `{…}` — підстановка.',
    '',
  ].join('\n');

function branchFile(b: Branch): string {
  const parts: string[] = [HEAD(`${b.code} «${b.title}»`)];
  parts.push('## Гілка', table([
    [`BR-${b.code}.title`, 'title', COND, b.title],
    [`BR-${b.code}.scenario`, 'scenario', COND, b.scenario],
    [`BR-${b.code}.intro`, 'intro', COND, b.intro],
    [`BR-${b.code}.wgb`, 'wgb', COND, b.wgb],
  ]));
  parts.push(`## BR-${b.code}-SC · Самоперевірка`, table(unitRows({ id: `BR-${b.code}-SC`, title: 'Самоперевірка', steps: b.selfcheck })));
  for (const u of b.lessons) parts.push(`## ${u.id} · ${u.title}`, table(unitRows(u)));
  parts.push(`## ${b.practice.id} · ${b.practice.title}`, table(unitRows(b.practice)));
  if (b.final && !b.final.sim) parts.push(`## ${b.final.id} · ${b.final.title}`, table(unitRows(b.final)));
  if (b.final?.sim === 'leads') parts.push(leadsSection());
  parts.push('## Кнопки й підписи екрана (спільні для всіх гілок)', table(UI));
  return parts.join('\n\n') + '\n';
}

function leadsSection(): string {
  const id = 'BR-TOV-FINAL';
  const rows: Row[] = [[`${id}.title`, 'title', COND, 'Тренажер «Ліди»']];
  for (const [k, v] of Object.entries(G)) rows.push([`${id}.grindyk.${k}`, 'репліка Гріндіка', COND, v]);
  for (const [k, v] of Object.entries(AD_FIELD_LABELS)) rows.push([`${id}.adField.${k}`, 'підпис поля оголошення', COND, v]);
  [...ADS, AD1_FIXED].forEach((a, i) => {
    const n = i < ADS.length ? `ad.${i + 1}` : 'ad.1fixed';
    rows.push([`${id}.${n}.n`, 'номер', COND, a.n], [`${id}.${n}.primary`, 'текст оголошення', COND, a.primary], [`${id}.${n}.headline`, 'заголовок', COND, a.headline], [`${id}.${n}.description`, 'опис', COND, a.description], [`${id}.${n}.button`, 'кнопка оголошення', COND, a.button]);
  });
  rows.push([`${id}.landing.title`, 'лендинг', COND, LANDING.title], [`${id}.landing.price`, 'лендинг', COND, LANDING.price], [`${id}.landing.terms`, 'лендинг', COND, LANDING.terms], [`${id}.landing.button`, 'лендинг', COND, LANDING.button]);
  LANDING.form.forEach((f, i) => rows.push([`${id}.landing.form.${i + 1}`, 'лендинг', COND, f]));
  const tab = (name: string, data: [string, string][]) => data.forEach(([a, b], i) => rows.push([`${id}.${name}.${i + 1}.label`, 'таблиця', COND, a], [`${id}.${name}.${i + 1}.value`, 'таблиця', COND, b]));
  tab('sliceD3', SLICE_D3);
  tab('sliceD6', SLICE_D6);
  tab('reasons', REASONS);
  for (const [k, v] of Object.entries(LEAD_MARKS)) rows.push([`${id}.leadMark.${k}`, 'позначка заявки', AFTER, v]);
  GOALS.forEach((g) => {
    rows.push([`${id}.goal.${g.id}.label`, 'ціль кампанії', OPT, g.label]);
    if (g.desc) rows.push([`${id}.goal.${g.id}.desc`, 'опис цілі (кабінет)', OPT, g.desc]);
    rows.push([`${id}.goal.${g.id}.explain`, 'пояснення цілі', 'після відкриття цілі', g.explain]);
  });
  rows.push([`${id}.goal.answer`, 'ключ', KEY, `goal.${GOALS.find((g) => g.pick)!.id}`]);
  LEVEL_ITEMS.forEach((it, i) => rows.push([`${id}.level.${i + 1}`, 'параметр кабінету', OPT, it.label], [`${id}.level.${i + 1}.answer`, 'ключ', KEY, it.level]));
  SIM_STEPS.forEach((s, i) => {
    const sid = `${id}.${s.id}`;
    rows.push([`${sid}.stage`, 'етап', COND, s.stage]);
    if (s.grindyk) rows.push([`${sid}.grindyk`, 'репліка Гріндіка', COND, s.grindyk]);
    if (s.grindykWrong) rows.push([`${sid}.grindykWrong`, 'репліка Гріндіка', 'після помилки', s.grindykWrong]);
    if (s.grindykAfter) rows.push([`${sid}.grindykAfter`, 'репліка Гріндіка', AFTER, s.grindykAfter]);
    if (s.kind === 'step') rows.push(...stepRows(sid, s.step));
    else if ('q' in s) rows.push([`${sid}.q`, 'q', COND, s.q]);
    if ('explain' in s && s.explain) rows.push([`${sid}.explain`, 'explain', AFTER, s.explain]);
    void i;
  });
  VARIANTS.forEach((v) => {
    const vid = `${id}.variant.${v.id}`;
    rows.push([`${vid}.label`, 'варіант повтору', OPT, v.label]);
    (v.rows ?? []).forEach(([a, b], k) => rows.push([`${vid}.row.${k + 1}.label`, 'таблиця результату', AFTER, a], [`${vid}.row.${k + 1}.value`, 'таблиця результату', AFTER, b]));
    if (v.pre) rows.push([`${vid}.pre`, 'текст до питання', AFTER, v.pre]);
    rows.push([`${vid}.why`, 'пояснення', AFTER, v.why]);
    if (v.grindyk) rows.push([`${vid}.grindyk`, 'репліка Гріндіка', AFTER, v.grindyk]);
  });
  rows.push([`${id}.variantB.q`, 'q', AFTER, VARIANT_B_CHECK.q]);
  VARIANT_B_CHECK.options.forEach((o, i) => rows.push([`${id}.variantB.opt.${i + 1}`, 'варіант', OPT, o]));
  rows.push([`${id}.variantB.answer`, 'ключ', KEY, `variantB.opt.${VARIANT_B_CHECK.answer + 1}`]);
  CRITERIA.forEach((c) => rows.push([`${id}.criterion.${c.n}`, c.mandatory ? 'критерій розбору (обовʼязковий)' : 'критерій розбору', 'розбір', c.text]));
  rows.push(
    [`${id}.ui.mandatory`, 'позначка', 'розбір', 'обовʼязковий'],
    [`${id}.ui.retry`, 'кнопка', 'розбір', 'Пройти крок ще раз: {етап} →'],
    [`${id}.ui.finish`, 'кнопка', 'розбір', 'Завершити тренажер'],
    [`${id}.ui.fixMandatory`, 'кнопка', 'розбір', 'Виправ обовʼязкові критерії'],
    [`${id}.ui.later`, 'кнопка', 'розбір', 'Вийти, продовжити пізніше'],
    [`${id}.ui.toReview`, 'кнопка', 'кнопка', 'До розбору'],
  );
  return `## ${id} · Тренажер «Ліди» (фінал товарки)\n\nСценарій — docs/CASE-TOVARKA-LEADS-APPROVED.md. Назви кабінету Ads Manager (цілі, рівні, поля) перекладати за інтерфейсом кабінету відповідною мовою.\n\n${table(rows)}`;
}

function kbExtraFile(): string {
  const parts: string[] = [HEAD('«База»: MET-06, MET-07, VRT-07, вправи; матеріали без EN')];
  const article = (id: string, need: string) => {
    const a = kbGet(id, 'uk');
    if (!a) throw new Error(id);
    const rows: Row[] = [[`${id}.title`, 'title', COND, a.title]];
    a.body.split(/\n\n+/).forEach((p, i) => rows.push([`${id}.p${i + 1}`, 'абзац', COND, p]));
    if (a.solution) a.solution.split(/\n\n+/).forEach((p, i) => rows.push([`${id}.solution.p${i + 1}`, 'ключ / розбір', AFTER, p]));
    return `## ${id} · ${a.title}\n\nПотрібно: ${need}.\n\n${table(rows)}`;
  };
  for (const id of ['MET-06', 'MET-07', 'VRT-07']) parts.push(article(id, 'EN (RU вже є: оригінал v5)'));
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-exercises.json'), 'utf8')) as Record<string, Record<string, { title: string; task: string; etalon: string; fields: { id: string; type: string; label: string; unit?: string; options?: string[]; answer?: number; tolerance?: number; correct?: number | number[] }[]; criteria: string[] }>>;
  for (const [id, langs] of Object.entries(ex)) {
    if (id.startsWith('_') || !langs.uk) continue;
    const x = langs.uk;
    const rows: Row[] = [[`${id}.title`, 'title', COND, x.title], [`${id}.task`, 'умова', COND, x.task]];
    for (const f of x.fields) {
      rows.push([`${id}.${f.id}.label`, 'поле', COND, f.label]);
      if (f.unit) rows.push([`${id}.${f.id}.unit`, 'одиниця', COND, f.unit]);
      (f.options ?? []).forEach((o, i) => rows.push([`${id}.${f.id}.opt.${i + 1}`, 'варіант', OPT, o]));
      if (f.type === 'number') rows.push([`${id}.${f.id}.answer`, 'ключ', KEY, `${f.answer} (допуск ±${f.tolerance})`]);
      else rows.push([`${id}.${f.id}.answer`, 'ключ', KEY, ([] as number[]).concat(f.correct as number).map((c) => `${id}.${f.id}.opt.${c + 1}`).join(', ')]);
    }
    rows.push([`${id}.etalon`, 'еталон', AFTER, x.etalon]);
    x.criteria.forEach((c, i) => rows.push([`${id}.criterion.${i + 1}`, 'критерій', AFTER, c]));
    parts.push(`## ${id} · ${x.title}\n\nПотрібно: RU, EN.\n\n${table(rows)}`);
  }
  for (const id of ['CASE-13', 'INS-02', 'INS-03', 'INS-07', 'INS-08']) parts.push(article(id, 'EN (RU є)'));
  return parts.join('\n\n') + '\n';
}

fs.mkdirSync(OUT, { recursive: true });
const done: string[] = [];
for (const b of BRANCHES) {
  const f = `004-translate-${b.code}.uk.md`;
  fs.writeFileSync(path.join(OUT, f), branchFile(b));
  done.push(f);
}
fs.writeFileSync(path.join(OUT, '004-translate-kb-extra.uk.md'), kbExtraFile());
done.push('004-translate-kb-extra.uk.md');
console.log(done.map((f) => `report/${f}`).join('\n'));
