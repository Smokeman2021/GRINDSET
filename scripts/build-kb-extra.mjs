// Матеріали «Бази», прийняті Ревізором у REVIEW-CONTENT-b26 §3 (ТЗ 006, 5.1): гайди GDE-01–04, 06–11, кейс CASE-13,
// описи інструментів INS-02, 03 (з переходом до наявних калькуляторів), INS-07, 08 (як чекліст і шаблон).
// Джерело — локальний пакет content/kb-source/guides-ru (не комітиться) і переклад UA з report/004-translate-guides.uk.md.
// Вихід — content/kb-extra/{uk,ru,en}/<ID>.md (комітиться), далі node scripts/import-kb.mjs.
//   node scripts/build-kb-extra.mjs
// GDE-05 і INS-01, 04, 05, 06, 09, 10 не беруться (REVIEW §3: не включати; калькуляторів для INS-06, 10 у застосунку немає).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'kb-source', 'guides-ru');
const OUT = path.join(ROOT, 'content', 'kb-extra');
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const GDE = ['GDE-01', 'GDE-02', 'GDE-03', 'GDE-04', 'GDE-06', 'GDE-07', 'GDE-08', 'GDE-09', 'GDE-10', 'GDE-11'];

function write(lang, id, title, body, source) {
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  fs.writeFileSync(path.join(OUT, lang, `${id}.md`), `---\nid: ${id}\nlang: ${lang}\nstatus: ready\nsource: ${source}\n---\n\n# ${title}\n\n${body.trim()}\n`);
}
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
// «**Заголовок.** Текст» → { title, body }
const split = (s) => {
  const m = /^\*\*(.+?)\.?\*\*\s*(.*)$/s.exec(s);
  return m ? { title: m[1].replace(/\.$/, ''), body: m[2] } : { title: s, body: '' };
};

// ───────── GDE: таблиця «ID | Українська | Русский | English» ─────────
const gdeRows = new Map();
for (const f of ['batch-014-01_LEARNING_GUIDES_2024-2026.md', 'batch-015-01_LEARNING_GUIDES_2024-2026.md']) {
  for (const line of read(path.join(SRC, f)).split('\n')) {
    const c = cells(line);
    if (c.length === 4 && /^GDE-\d\d$/.test(c[0])) gdeRows.set(c[0], { uk: c[1], ru: c[2], en: c[3], f });
  }
}
for (const id of GDE) {
  const r = gdeRows.get(id);
  if (!r) throw new Error(`${id}: немає в пакеті`);
  for (const lang of ['uk', 'ru', 'en']) {
    const { title, body } = split(r[lang]);
    write(lang, id, title, body, `content/kb-source/guides-ru/${r.f} (REVIEW-CONTENT-b26 §3: прийнято)`);
  }
}

// ───────── CASE-13: UA — з перекладу 004 (прийнято), RU — з пакета ─────────
const tr = read(path.join(ROOT, 'report', '004-translate-guides.uk.md'));
const caseUk = tr.slice(tr.indexOf('## CASE-13')).split('\n').slice(1).join('\n').split('\nПовʼязані картки')[0].trim();
const ukParas = caseUk.split(/\n\n+/).map((p) => p.replace(/^\*\*Ключ\*\* \(показується після спроби\)\./, '**Ключ.**'));
write('uk', 'CASE-13', 'Чому форма погіршилась?', ukParas.join('\n\n') + '\n\nПовʼязані картки: EXP-03, TRK-08, TRK-09, VRT-03.', 'report/004-translate-guides.uk.md (REVIEW §3: прийнято, арифметика вірна)');
const ru = read(path.join(SRC, 'batch-015-01_LEARNING_GUIDES_2024-2026.md'));
const ruData = /## Упражнение · CASE-13 · Почему форма ухудшилась\?\n\n(.+?)\n/s.exec(ru)[1];
const ruTask = /\*\*RU:\*\* «(.+?)»/.exec(ru)[1];
const ruKey = /\*\*Ключ RU:\*\* (.+)/.exec(ru)[1];
write('ru', 'CASE-13', 'Почему форма ухудшилась?', `**Учебные данные.** ${ruData.replace(/^Синтетические данные\.\s*/, '')}\n\n**Задание.** ${ruTask}\n\n**Ключ.** ${ruKey}\n\nСвязанные карточки: EXP-03, TRK-08, TRK-09, VRT-03.`, 'content/kb-source/guides-ru/batch-015-01 (REVIEW §3: прийнято)');

// ───────── INS: назва UA/RU з пакета; опис UA — переклад CC (004), RU — з пакета; перехід до наявного в застосунку ─────────
const insUk = new Map();
for (const line of tr.split('\n')) {
  const c = cells(line);
  if (c.length === 3 && /^INS-\d\d$/.test(c[0])) insUk.set(c[0], { title: c[1], body: c[2] });
}
const insRu = new Map();
for (const f of ['batch-014-02_INSTRUMENTS.md', 'batch-015-02_INSTRUMENTS.md']) {
  for (const line of read(path.join(SRC, f)).split('\n')) {
    const c = cells(line);
    if (c.length >= 5 && /^INS-\d\d$/.test(c[0])) insRu.set(c[0], { title: c[2], body: c[4], f });
  }
}
const LINK = {
  'INS-02': { uk: '**Де порахувати:** «База» → Інструменти → Калькулятори → «Гранична вартість ліда».', ru: '**Где посчитать:** «База» → Инструменты → Калькуляторы → «Гранична вартість ліда».' },
  'INS-03': { uk: '**Де порахувати:** «База» → Інструменти → Калькулятори → «Беззбитковість і ROI».', ru: '**Где посчитать:** «База» → Инструменты → Калькуляторы → «Беззбитковість і ROI».' },
  'INS-07': { uk: '**Як користуватись:** це чекліст для самоперевірки перед запуском. Рішення й перевірку записуй у шаблонах M22-01 і M22-02 «Бази»; окремого інструмента немає.', ru: '**Как пользоваться:** это чек-лист для самопроверки перед запуском. Решение и проверку записывай в шаблонах M22-01 и M22-02 «Базы»; отдельного инструмента нет.' },
  'INS-08': { uk: '**Як користуватись:** це шаблон журналу. Цифри запусків веди в «Мої цифри» (Профіль), рішення — у шаблоні M22-01; окремого інструмента немає.', ru: '**Как пользоваться:** это шаблон журнала. Цифры запусков веди в «Мої цифри» (Профиль), решение — в шаблоне M22-01; отдельного инструмента нет.' },
};
for (const id of Object.keys(LINK)) {
  const u = insUk.get(id);
  const r = insRu.get(id);
  if (!u || !r) throw new Error(`${id}: немає UA або RU`);
  // у UA-описі INS-03 редакторська порада «спершу звірити з калькулятором…» замінена переходом до калькулятора
  const ukBody = u.body.replace(/\s*Спершу звірити з калькулятором, який уже є в GRINDSET\./, '').replace(/\s*Краще повʼязати з наявним «Мої цифри», щоб не дублювати введення\./, '');
  const ruBody = r.body.replace(/\s*Сначала сверить[^.]*\./, '').replace(/\s*Лучше связать[^.]*\./, '');
  write('uk', id, u.title, `${ukBody}\n\n${LINK[id].uk}`, 'report/004-translate-guides.uk.md (REVIEW §3: прийнято з умовою)');
  write('ru', id, r.title, `${ruBody}\n\n${LINK[id].ru}`, `content/kb-source/guides-ru/${r.f} (REVIEW §3: прийнято з умовою)`);
}
console.log(`kb-extra: GDE ${GDE.length} × 3 мови, CASE-13 uk/ru, INS ${Object.keys(LINK).length} × uk/ru`);
