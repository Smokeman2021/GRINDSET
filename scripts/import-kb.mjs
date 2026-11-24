// Імпорт «Бази» (ТЗ 004, етап B): content/kb-source/ (локальний пакет, у репозиторій не йде) → дані бандла.
//   node scripts/import-kb.mjs
// Що йде в бандл: лише записи content/kb-include.json зі status = "include", на мовах, які є в пакеті.
// Вихід (комітиться): app-mvp/src/data/generated/kb/meta.ts і texts.<lang>.ts (модулі з даними: однаково читаються Metro і Node-тестами).
// Правила очистки:
//  • службова шапка (--- id/lang/status ---) і редакторські рядки («GRINDSET · партія …», «Основа: G22-…», «Формат продукту: …») не імпортуються;
//  • у картках вертикалей розділ «Що піде в модуль і що дособрати» (план редакції) не імпортується;
//  • у кейсах розбір/ключ (Ключ, Розбір, Оцінка, Критерії · Разбор/Оценка · Answer/Debrief/Score/Key) відокремлюється в solution:
//    екран показує його лише після спроби;
//  • вправи з оцінюванням беруться з content/kb-exercises.json (умова без відповіді + поля + еталон + критерії);
//  • самозвіти — лише як вправа «як читати чужий звіт», з позначкою;
//  • гілки 023 (kind = branch) — лише з правками REVIEWER-EDITS (механічні тут, текстові з content/kb-branch-edits.json),
//    BR-TOV-FINAL не імпортується; переклади гілок у branches/ru|en/ підхоплюються тим самим кодом;
//  • заборонені рядки (внутрішні реєстри) зупиняють імпорт з помилкою.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'kb-source');
const OUT = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated', 'kb');
const LANGS = ['uk', 'ru', 'en'];
export const FORBIDDEN = ['fb-killa', 'research-private', 'Внутрішній реєстр', 'Редакторський реєстр', 'Джерела для редактора', 'ftvclub'];
const ALLOWED_STATUS = new Set(['ready', 'method', 'exercise', 'self-report', 'branch-editorial']);

// Матеріали, написані або перекладені CC (ТЗ 006: MET-06, MET-07, VRT-07, гайди GDE, CASE-13 UA) — content/kb-extra/, комітиться.
// У kb-include.json шлях з префіксом «extra:»; manifest пакета для них не потрібен, перевірка заборонених рядків та сама.
const EXTRA = path.join(ROOT, 'content', 'kb-extra');
const abs = (rel) => (rel.startsWith('extra:') ? path.join(EXTRA, rel.slice(6)) : path.join(SRC, rel));
const read = (rel) => fs.readFileSync(abs(rel), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => fs.existsSync(abs(rel));

export function stripFrontmatter(s) {
  return s.replace(/^---\n[\s\S]*?\n---\n+/, '');
}

// Розділ «## <prefix>…» до наступного «## » (або до кінця)
export function section(s, prefix) {
  const lines = s.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).startsWith(prefix));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join('\n');
}

function dropSection(s, prefix) {
  const sec = section(s, prefix);
  return sec ? s.replace(sec, '') : s;
}

const EDITORIAL = [
  /^GRINDSET · партія[^\n]*\n+/gm,
  /\s*Основа: G22-[^.\n]*\.?/g,
  /\s*Формат( продукту)?: [^\n]*?(?=\n|$)/g,
  /\s*Ідентифікатори джерел ведуть у внутрішній каталог\./g,
];
function cleanEditorial(s) {
  let out = s;
  for (const re of EDITORIAL) out = out.replace(re, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// Заголовок: перший «# » або «## »; «ID · Назва» → «Назва»
function titleAndBody(s, id) {
  const lines = s.split('\n');
  const i = lines.findIndex((l) => /^#{1,2} /.test(l));
  let title = i >= 0 ? lines[i].replace(/^#{1,2} /, '').trim() : id;
  title = title.replace(new RegExp(`^${id.replace(/[-]/g, '\\-')}\\s*·\\s*`), '');
  const body = (i >= 0 ? lines.slice(i + 1) : lines).join('\n').trim();
  return { title, body };
}

const SOLUTION = /^(\*\*)?(Ключ|Розбір|Оцінка|Критерії|Разбор|Оценка|Критерии|Answer|Debrief|Score|Key|Criteria)(?=[\s.:,*])/u;
export function splitSolution(body) {
  const paras = body.split(/\n\n+/);
  const k = paras.findIndex((p) => SOLUTION.test(p.trim()));
  if (k < 0) return { body, solution: null };
  return { body: paras.slice(0, k).join('\n\n').trim(), solution: paras.slice(k).join('\n\n').trim() };
}

// ───────── гілки 023 ─────────
// Механічні правки REVIEWER-EDITS (загальні п. 1–2); текстові правки уроків — content/kb-branch-edits.json
const BRANCH_ID_EDITS = {
  'BR-TOV-L04': [['TRK', 'TRK-05, TRK-09']],
  'BR-SRV-L03': [['TRK', 'TRK-04']],
  'BR-INF-L03': [['TRK', 'TRK-01']],
  'BR-DAT-L02': [['TRK', 'TRK-01, TRK-02']],
  'BR-CRY-L04': [['PAY, TRK', 'PAY-04, TRK-04']],
  'BR-ADT-L05': [['TRK', 'TRK-10']],
  'BR-GAM-L02': [['PAY-02', 'PAY-01']],
  'BR-GAM-L03': [['PAY-03', 'PAY-04']],
};
export function parseBranch(text, code, lang, edits = {}) {
  const s = text.replace(/\r\n/g, '\n').replace(/Google Ads/g, 'правила обраного майданчика (Meta Advertising Standards)');
  const sec = (re) => {
    const m = s.split('\n');
    const i = m.findIndex((l) => re.test(l));
    if (i < 0) return null;
    let e = m.findIndex((l, j) => j > i && l.startsWith('## '));
    if (e < 0) e = m.length;
    return { head: m[i].replace(/^## /, ''), body: m.slice(i + 1, e).join('\n').trim() };
  };
  const field = (body, name) => {
    const m = body.match(new RegExp(`\\*\\*${name}\\.\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|$)`));
    return m ? m[1].trim() : null;
  };
  const lessons = [];
  for (let n = 1; n <= 5; n++) {
    const id = `BR-${code}-L0${n}`;
    const x = sec(new RegExp(`^## ${id}\\b`));
    if (!x) continue;
    let kb = field(x.body, 'База') ?? '';
    for (const [a, b] of BRANCH_ID_EDITS[id] ?? []) kb = kb.replace(new RegExp(`(^|,\\s*)${a.replace(/,\s*/g, ',\\s*')}(?=\\.|,|$)`), `$1${b}`);
    const over = edits[id]?.[lang] ?? edits[id]?.uk ?? {};
    lessons.push({
      id,
      title: x.head.replace(new RegExp(`^${id}\\s*·\\s*`), ''),
      brief: over.brief ?? field(x.body, 'Бриф'),
      task: over.task ?? field(x.body, 'Завдання'),
      hint: over.hint ?? field(x.body, 'Підказка Гріндіка'),
      etalon: over.etalon ?? field(x.body, 'Еталон для розбору'),
      kb: kb.replace(/\.$/, '').split(/,\s*/).filter(Boolean),
    });
  }
  const finalSec = code === 'TOV' ? null : sec(new RegExp(`^## BR-${code}-FINAL\\b`)); // BR-TOV-FINAL замінено тренажером «Ліди»
  return {
    code,
    lang,
    title: (s.match(/^# (.*)$/m)?.[1] ?? code).replace(/^BR-[A-Z]+\s*·\s*/, ''),
    intro: sec(/^## Вступ/)?.body ?? null,
    selfcheck: sec(/^## Самоперевірка/)?.body ?? null,
    lessons,
    final: finalSec ? { title: finalSec.head.replace(/^BR-[A-Z]+-FINAL\s*·\s*/, ''), body: finalSec.body } : null,
  };
}

// ───────── основний прохід ─────────
export function runImport({ write = true } = {}) {
  const include = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-include.json'), 'utf8'));
  const exercises = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-exercises.json'), 'utf8'));
  const branchEdits = fs.existsSync(path.join(ROOT, 'content', 'kb-branch-edits.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-branch-edits.json'), 'utf8')) : {};
  const manifest = JSON.parse(read('manifest.json'));
  const statusOf = new Map(manifest.map((m) => [m.path, m.status]));

  const meta = [];
  const texts = Object.fromEntries(LANGS.map((l) => [l, {}]));
  const branches = Object.fromEntries(LANGS.map((l) => [l, {}]));
  const skipped = [];

  for (const it of include.items) {
    if (it.status !== 'include') {
      skipped.push({ id: it.id, why: it.status });
      continue;
    }
    const langs = [];
    for (const lang of LANGS) {
      const rel = it.file.replace('{lang}', lang);
      if (!exists(rel)) continue;
      const st = rel.startsWith('extra:') ? 'ready' : statusOf.get(rel);
      if (!st) throw new Error(`${it.id}: ${rel} немає в manifest.json`);
      if (!ALLOWED_STATUS.has(st)) throw new Error(`${it.id}: статус ${st} не допускається в бандл`);
      const raw = stripFrontmatter(read(rel));

      if (it.kind === 'branch') {
        branches[lang][it.id] = parseBranch(raw, it.id.replace(/^BR-/, ''), lang, branchEdits);
        langs.push(lang);
        continue;
      }
      if (it.kind === 'exercise') {
        const ex = exercises[it.id]?.[lang];
        if (!ex) continue; // мова без авторської форми вправи
        texts[lang][it.id] = { title: ex.title, body: ex.task, solution: ex.etalon, exercise: { fields: ex.fields, criteria: ex.criteria } };
        langs.push(lang);
        continue;
      }
      let part = raw;
      if (it.part) {
        part = section(raw, it.part);
        if (!part) throw new Error(`${it.id}: розділ «${it.part}» не знайдено в ${rel}`);
      }
      if (it.kind === 'vertical') part = dropSection(part, 'Що піде в модуль');
      if (it.kind === 'method') {
        // SUP-03: лише сама вправа (абзац «**Вправа.**» і далі), без редакторського вступу про джерела
        const k = part.indexOf('**Вправа.**');
        part = part.split('\n')[0] + '\n\n' + (k >= 0 ? part.slice(k) : part);
      }
      let { title, body } = titleAndBody(cleanEditorial(part), it.id);
      let solution = null;
      if (it.kind === 'case') ({ body, solution } = splitSolution(body));
      if (it.kind === 'read-report') title = `Як читати чужий звіт: ${title}`;
      texts[lang][it.id] = solution ? { title, body, solution } : { title, body };
      langs.push(lang);
    }
    if (!langs.length) throw new Error(`${it.id}: жодної мови в пакеті`);
    meta.push({ id: it.id, kind: it.kind, section: it.section, verticals: it.verticals, tasks: it.tasks, labels: it.labels ?? [], starter: !!it.starter, langs });
  }

  // заборонені рядки
  const all = JSON.stringify({ meta, texts, branches });
  for (const f of FORBIDDEN) if (all.toLowerCase().includes(f.toLowerCase())) throw new Error(`заборонений рядок у даних бандла: ${f}`);

  if (write) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(OUT)) if (/\.(json|ts)$/.test(f)) fs.rmSync(path.join(OUT, f));
    const mod = (data) => `// ЗГЕНЕРОВАНО scripts/import-kb.mjs з content/kb-source/ за content/kb-include.json. Не редагувати вручну.\nconst data: unknown = ${JSON.stringify(data)};\nexport default data;\n`;
    fs.writeFileSync(path.join(OUT, 'meta.ts'), mod({ items: meta }));
    for (const l of LANGS) fs.writeFileSync(path.join(OUT, `texts.${l}.ts`), mod(texts[l]));
    const anyBranch = LANGS.some((l) => Object.keys(branches[l]).length);
    if (anyBranch) for (const l of LANGS) fs.writeFileSync(path.join(OUT, `branches.${l}.ts`), mod(branches[l]));
  }
  return { meta, texts, branches, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = runImport();
  const per = LANGS.map((l) => `${l} ${Object.keys(r.texts[l]).length}`).join(', ');
  console.log(`«База»: ${r.meta.length} записів (${per}); поза бандлом: ${r.skipped.length} (${[...new Set(r.skipped.map((s) => s.why))].join(', ')})`);
}
