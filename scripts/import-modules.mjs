// Конвертер контенту: content/modules/grindset-module-NN-expanded.md -> app-mvp/src/data/generated/mNN.json
//                                                                     + app-mvp/src/data/generated-public/mNN.json
// Запуск: node scripts/import-modules.mjs [--seed] [--strict]   (нічого не встановлюючи)
// Правки тексту роби в .md і перезапускай скрипт: застосунок читає лише згенеровані JSON.
//
// Ризикові фрагменти (обхід виявлення, купівля акаунтів, клоакінг):
//  - позначка ставиться В ДЖЕРЕЛІ: content/restricted.json (модулі, уроки, фрагменти за ID: див. walkFragments);
//  - ID стабільні й однакові в uk / en / ru, тож позначка з uk переноситься на переклади за ID;
//  - регулярки (scripts/restricted-patterns.mjs, uk + en + ru) лише друга перевірка: збіг у непозначеному фрагменті
//    потрапляє у звіт, з --strict скрипт завершується з помилкою, а у публічний набір такий фрагмент усе одно не йде;
//  - generated/ — повний набір (flags + ids), generated-public/ — набір без позначених фрагментів для збірки
//    з EXPO_PUBLIC_INCLUDE_RESTRICTED=false (підміну файлів робить app-mvp/metro.config.js);
//  - --seed дописує в restricted.json усе, що знайшли регулярки й що було позначене раніше в коді;
//  - заодно оновлюється docs/RESTRICTED_IDS.md (лише ID, без цитат тексту).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAGMENT_PATTERNS, anyHit } from './restricted-patterns.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'modules');
const OUT = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated');
const OUT_PUBLIC = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated-public');
const RESTRICTED_FILE = path.join(ROOT, 'content', 'restricted.json');
const IDS_DOC = path.join(ROOT, 'docs', 'RESTRICTED_IDS.md');
const ARGS = process.argv.slice(2);
const SEED = ARGS.includes('--seed');
const STRICT = ARGS.includes('--strict');

// Раніше ризикове позначалось у коді; --seed переносить це в restricted.json один раз
const LEGACY_LESSON_CODES = new Set(['3.2', '3.3']);
const LEGACY_MODULES = new Set(['09']);
const LEGACY_FINAL_MODULES = new Set(['03']);

// Ручні правки контенту: відповіді для завдань "вписати" і набори варіантів для питань, де в джерелі лише правильний (ключ: код уроку#номер питання, 0 = завдання шару 1).
// Значення: { answer: число, unit?: рядок, tolerance?: число }
const NUMERIC = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'overrides.json'), 'utf8'));


const warnings = [];
const incomplete = [];
const warn = (m) => warnings.push(m);

// Прибирає **жирний** з коротких текстів (питання, варіанти): там розмітка не рендериться
const plain = (s) => (typeof s === 'string' ? s.replace(/\*\*/g, '') : s);
function cleanTask(t) {
  if (!t) return t;
  const out = { ...t };
  for (const k of ['q', 'explain']) if (out[k]) out[k] = plain(out[k]);
  if (out.options) out.options = out.options.map(plain);
  if (out.items) out.items = out.items.map(plain);
  if (out.pairs) out.pairs = out.pairs.map((p) => p.map(plain));
  out.restricted = false; // справжнє значення ставить annotate() за restricted.json
  return out;
}

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const stem = (w) => w.slice(0, 5);

function parseOptions(lines) {
  const options = [];
  const marks = [];
  const rest = [];
  const before = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = /^- ([A-ZА-ЯЄІЇ])\)\s*(.*?)(\s*✓)?$/.exec(line);
    if (m) {
      started = true;
      options.push(m[2].trim());
      marks.push(Boolean(m[3]));
    } else if (!started) {
      before.push(line);
    } else if (line.trim()) {
      rest.push(line.trim());
    }
  }
  return { options, marks, before, rest };
}

function cleanExplain(rest) {
  const e = rest.map((l) => l.replace(/^\*+|\*+$/g, '').trim()).filter(Boolean);
  return e.length ? e.join(' ') : undefined;
}

function joinQ(before) {
  return before.map((l) => l.trim()).filter(Boolean).join('\n');
}

function orderFromKey(items, keyText) {
  const arrow = keyText.split('→').map((s) => s.trim()).filter(Boolean);
  if (arrow.every((t) => /^\d+$/.test(t))) return arrow.map((n) => items[Number(n) - 1]);
  const used = new Set();
  const result = [];
  for (const token of arrow) {
    const words = norm(token).split(' ').filter((w) => w.length > 2);
    let best = -1;
    let bestScore = 0;
    items.forEach((it, i) => {
      if (used.has(i)) return;
      const n = norm(it);
      const score = words.reduce((s, w) => s + (n.includes(stem(w)) ? 1 : 0), 0) / Math.max(1, words.length);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best < 0 || bestScore < 0.5) return null;
    used.add(best);
    result.push(items[best]);
  }
  return result.length === items.length ? result : null;
}

function parseTask(kind, lines, ctx) {
  const k = kind.toLowerCase();
  if (k.includes('drag')) {
    const rows = lines.filter((l) => l.trim().startsWith('|'));
    const pairs = rows
      .slice(2)
      .map((r) => r.split('|').slice(1, -1).map((c) => c.trim()))
      .filter((c) => c.length >= 2);
    const q = joinQ(lines.filter((l) => !l.trim().startsWith('|')));
    return { type: 'match', q, pairs: pairs.map((p) => [p[0], p[1]]) };
  }
  if (k.includes('послідовн')) {
    const items = [];
    const before = [];
    let key = '';
    for (const raw of lines) {
      const line = raw.trim();
      if (/^\*?Правильний порядок:/i.test(line)) key = line.replace(/^\*?Правильний порядок:\s*/i, '').replace(/\*$/, '');
      else if (/^\*?Правильно:.*→/i.test(line)) key = line.replace(/^\*?Правильно:\s*/i, '').replace(/\*$/, '');
      else if (/^- /.test(line)) items.push(line.slice(2).trim());
      else if (line && !items.length) before.push(line);
    }
    // елементів у списку нема: порядок є лише в ключі відповіді
    const ordered = items.length ? orderFromKey(items, key) : key.split('→').map((s) => s.trim()).filter(Boolean);
    if (!ordered || ordered.length < 2) {
      warn(`${ctx}: не вдалося розпізнати порядок «${key}» для ${JSON.stringify(items)}`);
      return null;
    }
    return { type: 'order', q: joinQ(before), items: ordered };
  }
  if (k.includes('вписати')) {
    const explainLines = lines.filter((l) => /^\*?Правильно:/i.test(l.trim()));
    const q = joinQ(lines.filter((l) => !/^\*?Правильно:/i.test(l.trim()) && !l.includes('___')));
    const explain = cleanExplain(explainLines.map((l) => l.replace(/^\*?Правильно:\s*/i, '').replace(/\*$/, '')));
    const manual = NUMERIC[ctx];
    if (!manual) {
      warn(`${ctx}: немає ручної відповіді в content/overrides.json`);
      return null;
    }
    return { type: 'numeric', q: manual.q ?? q, fields: manual.fields, explain };
  }
  // вибір / множинний вибір
  const { options, marks, before, rest } = parseOptions(lines);
  if (!options.length) {
    warn(`${ctx}: немає варіантів`);
    return null;
  }
  const answers = marks.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  if (!answers.length) warn(`${ctx}: жоден варіант не позначений ✓`);
  const q = joinQ(before);
  // У джерелі інколи записано лише правильний варіант: беремо ручний набір або пропускаємо питання
  if (options.length < 2) {
    const ov = NUMERIC[`options:${ctx}`];
    if (!ov) {
      incomplete.push(`${ctx}: «${q.replace(/\n/g, ' ').slice(0, 70)}»; у джерелі лише варіанти: ${JSON.stringify(options)}`);
      return null;
    }
    return { type: 'choice', q, options: ov.options, answer: ov.answer, explain: cleanExplain(rest) };
  }
  const explain = cleanExplain(rest.filter((l) => !/^\*?Правильно: [A-ZА-Я]( і [A-ZА-Я])*\*?$/i.test(l)));
  if (k.includes('множин') || answers.length > 1) return { type: 'multi', q, options, answers, explain };
  return { type: 'choice', q, options, answer: answers[0] ?? 0, explain };
}

function parseLesson(mod, chunk, index, isLast) {
  const head = /^## Урок (\d+\.\d+) — (.+)$/.exec(chunk[0]);
  const code = head[1];
  const title = head[2].trim();
  const id = `m${Number(mod.number)}l${index + 1}`;

  const sections = [];
  let cur = null;
  for (const line of chunk.slice(1)) {
    const m = /^### (.+)$/.exec(line);
    if (m) {
      cur = { heading: m[1].trim(), lines: [] };
      sections.push(cur);
    } else if (cur) cur.lines.push(line);
  }

  const teach = [];
  const l1 = [];
  let l2 = null;
  sections.forEach((s) => {
    const body = s.lines.join('\n').replace(/\n-{3,}\s*$/m, '').trim();
    if (/^Підтема/.test(s.heading)) {
      const tTitle = s.heading.replace(/^Підтема \d+:\s*/, '');
      teach.push({ title: tTitle, body, restricted: false });
    } else if (/^Шар 1/.test(s.heading)) {
      const blocks = [];
      let b = null;
      for (const line of s.lines) {
        const m = /^\*\*Тип:\s*(.+?)\*\*$/.exec(line.trim());
        if (m) {
          b = { kind: m[1], lines: [] };
          blocks.push(b);
        } else if (b && line.trim() !== '---') b.lines.push(line);
      }
      blocks.forEach((blk, qi) => {
        const t = parseTask(blk.kind, blk.lines, `${code}#L1-${qi + 1}`);
        if (t) l1.push(cleanTask(t));
      });
    } else if (/^Шар 2/.test(s.heading)) {
      // Умова = усе перед першим питанням (різні мітки: «Ситуація», «Задача А», «Оффер А», таблиці тощо)
      const situationLines = [];
      const questions = [];
      let q = null;
      for (const line of s.lines) {
        const t = line.trim();
        if (t === '---') continue;
        const qm = /^Питання (\d+)(?: \((.+?)\))?:?\s*(.*)$/.exec(t);
        if (qm) {
          q = { kind: qm[2] ?? 'вибір', lines: qm[3] ? [qm[3]] : [] };
          questions.push(q);
          continue;
        }
        if (q) q.lines.push(line);
        else situationLines.push(line);
      }
      const parsed = questions
        .map((qq, qi) => parseTask(qq.kind, qq.lines, `${code}#${qi + 1}`))
        .filter(Boolean)
        .map(cleanTask);
      const situation = plain(situationLines.join('\n').trim());
      l2 = {
        situation,
        situationRestricted: false,
        isFinal: /Фінальна/.test(s.heading),
        questions: parsed,
      };
    }
  });

  return { id, code, title, restricted: false, teach, l1, l2 };
}

function parseModule(file) {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const num = /module-(\d+)-/.exec(file)[1];
  const title = /^# Модуль \d+ — (.+)$/m.exec(text)[1].trim();
  const mod = { id: `m${Number(num)}`, number: num, title, restricted: false, finalRestricted: false };

  const starts = [];
  lines.forEach((l, i) => {
    if (/^## Урок /.test(l) || /^## Підсумок/.test(l)) starts.push(i);
  });
  const lessons = [];
  let summary = null;
  starts.forEach((s, idx) => {
    const e = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
    const chunk = lines.slice(s, e);
    if (/^## Підсумок/.test(chunk[0])) {
      const body = chunk
        .slice(1)
        .filter((l) => l.trim() !== '---' && !/^\*Grindset/.test(l.trim()) && !/^\*Перевірено/.test(l.trim()))
        .join('\n')
        .trim();
      summary = body;
    } else {
      lessons.push(parseLesson(mod, chunk, lessons.length, false));
    }
  });
  return { ...mod, lessons, summary, summaryRestricted: [] };
}

// ───────── Позначки ризикового: ID, перенесення за ID, публічний набір ─────────

// Обхід фрагментів у фіксованому порядку: ID однакові в усіх мовах. Типи: t = теорія, a = завдання шару 1,
// s = ситуація шару 2, b = завдання шару 2, u = рядок підсумку модуля.
function walkFragments(mod, visit) {
  visit(mod, mod.id, 'module');
  mod.lessons.forEach((l) => {
    visit(l, l.id, 'lesson');
    l.teach.forEach((t, i) => visit(t, l.id + ':t' + (i + 1), 'teach'));
    l.l1.forEach((t, i) => visit(t, l.id + ':a' + (i + 1), 'l1'));
    if (l.l2) {
      visit(l.l2, l.id + ':s', 'situation');
      l.l2.questions.forEach((t, i) => visit(t, l.id + ':b' + (i + 1), 'l2'));
    }
  });
  (mod.summary ?? '').split('\n').forEach((line, i) => visit({ text: line }, mod.id + ':u' + (i + 1), 'summary'));
}

// Текст фрагмента для другої перевірки регулярками
function fragmentText(node, kind) {
  switch (kind) {
    case 'module':
    case 'lesson':
      return node.title ?? '';
    case 'teach':
      return node.title + '\n' + node.body;
    case 'situation':
      return node.situation ?? '';
    case 'summary':
      return node.text;
    default: {
      const { restricted, id, ...rest } = node;
      return JSON.stringify(rest);
    }
  }
}

const marks = fs.existsSync(RESTRICTED_FILE)
  ? JSON.parse(fs.readFileSync(RESTRICTED_FILE, 'utf8'))
  : { modules: [], lessons: [], fragments: [] };
const marked = new Set([...(marks.modules ?? []), ...(marks.lessons ?? []), ...(marks.fragments ?? [])]);

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(OUT_PUBLIC, { recursive: true, force: true });
fs.mkdirSync(OUT_PUBLIC, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /^grindset-module-\d+-expanded\.md$/.test(f)).sort();

const LANGS = ['', 'en', 'ru'];
const report = [];
const warnList = [];
const seedAdd = new Set();
const docRows = []; // для docs/RESTRICTED_IDS.md
const infoById = new Map(); // id -> { module, lessonCode, type }

for (const f of files) {
  const uk = parseModule(f);
  const trees = { '': uk };
  for (const lang of ['en', 'ru']) {
    const fp = path.join(OUT, 'm' + uk.number + '.' + lang + '.json');
    if (fs.existsSync(fp)) trees[lang] = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }

  // ID у порядку обходу; в усіх мовах мають збігатися
  const idList = {};
  for (const [lang, tree] of Object.entries(trees)) {
    idList[lang] = [];
    walkFragments(tree, (n, id, kind) => idList[lang].push(id + '|' + kind));
  }
  for (const lang of ['en', 'ru']) {
    if (trees[lang] && idList[lang].join() !== idList[''].join()) {
      warn(uk.id + ': структура ' + (lang || 'uk') + ' не збігається з uk (.md змінювався після перекладу): переклад ' + lang + ' пропущено, перекласти заново');
      delete trees[lang];
    }
  }

  // Назви модулів, перевизначені в content/overrides.json (ключ titles:mN: { uk, en, ru }): без назв продуктів третіх сторін
  const titleOv = NUMERIC['titles:' + uk.id];
  if (titleOv) for (const [lang, tree] of Object.entries(trees)) tree.title = titleOv[lang || 'uk'] ?? tree.title;

  // Сукупність позначених: restricted.json + (за --seed) старі прапори з коду + збіги регулярок будь-якою мовою
  const flagged = new Set();
  const byLang = Object.entries(trees);
  const codeOf = {};
  const typeOf = {};
  walkFragments(uk, (n, id, kind) => {
    if (kind === 'lesson') codeOf[id] = n.code;
    typeOf[id] = kind === 'l1' || kind === 'l2' ? n.type : kind;
  });
  const finalLesson = uk.lessons.find((l) => l.l2?.isFinal);
  const legacy = new Set();
  if (LEGACY_MODULES.has(uk.number)) legacy.add(uk.id);
  uk.lessons.forEach((l) => LEGACY_LESSON_CODES.has(l.code) && legacy.add(l.id));
  if (LEGACY_FINAL_MODULES.has(uk.number) && finalLesson) {
    legacy.add(finalLesson.id + ':s');
    finalLesson.l2.questions.forEach((_, i) => legacy.add(finalLesson.id + ':b' + (i + 1)));
  }
  const hits = new Set();
  for (const [lang, tree] of byLang) {
    walkFragments(tree, (n, id, kind) => {
      if (anyHit(fragmentText(n, kind))) hits.add(id);
    });
  }
  const all = new Set([...marked, ...(SEED ? legacy : []), ...hits]);
  for (const id of all) if (id === uk.id || id.startsWith(uk.id + 'l') || id.startsWith(uk.id + ':')) flagged.add(id);
  const unmarked = [...hits].filter((id) => !marked.has(id));
  if (SEED) {
    for (const id of [...hits, ...legacy]) if (!marked.has(id)) seedAdd.add(id);
  } else {
    unmarked.forEach((id) => warnList.push(id));
  }

  // Каскад: позначений модуль / урок знімає й усе вкладене
  const isFlagged = (id) => {
    if (flagged.has(id)) return true;
    const m = /^(m\d+)(l\d+)?/.exec(id);
    if (!m) return false;
    if (flagged.has(m[1])) return true;
    return m[2] ? flagged.has(m[1] + m[2]) && id !== m[1] : false;
  };

  for (const [lang, tree] of Object.entries(trees)) {
    // повний набір: ID й прапори
    walkFragments(tree, (n, id, kind) => {
      const fl = isFlagged(id);
      if (kind === 'module') n.restricted = fl;
      else if (kind === 'lesson') n.restricted = fl;
      else if (kind === 'situation') n.situationRestricted = fl;
      else if (kind === 'summary') {
        const idx = Number(id.split(':u')[1]) - 1;
        if (fl) tree.summaryRestricted = [...new Set([...(tree.summaryRestricted ?? []), idx])];
      } else {
        n.restricted = fl;
        n.id = id;
      }
    });
    if (!tree.summaryRestricted) tree.summaryRestricted = [];
    const suffix = lang ? '.' + lang : '';
    fs.writeFileSync(path.join(OUT, 'm' + uk.number + suffix + '.json'), JSON.stringify(tree, null, 1));
    // публічний набір
    fs.writeFileSync(path.join(OUT_PUBLIC, 'm' + uk.number + suffix + '.json'), JSON.stringify(toPublic(tree, isFlagged), null, 1));
  }

  // для звіту й docs/RESTRICTED_IDS.md: лише верхні позначені одиниці, без тексту
  const top = [...flagged].filter((id) => {
    const m = /^(m\d+)(l\d+)?/.exec(id);
    if (id === m[1]) return true;
    if (flagged.has(m[1])) return false;
    if (m[2] && id !== m[1] + m[2] && flagged.has(m[1] + m[2])) return false;
    return true;
  });
  for (const id of top.sort((x, y) => x.localeCompare(y, 'en', { numeric: true }))) {
    const m = /^(m\d+)(l\d+)?/.exec(id);
    let type = typeOf[id];
    const lesson = m[2] ? codeOf[m[1] + m[2]] ?? '' : '';
    docRows.push({ module: uk.number, lesson, id, type: typeLabel(type, id), source: marked.has(id) ? 'restricted.json' : SEED ? 'seed' : 'regex' });
  }
  const counts = {};
  let rT = 0;
  let rQ = 0;
  uk.lessons.forEach((l) => {
    rT += l.teach.filter((t) => t.restricted).length;
    [...l.l1, ...(l.l2?.questions ?? [])].forEach((t) => {
      counts[t.type] = (counts[t.type] ?? 0) + 1;
      if (t.restricted) rQ++;
    });
  });
  report.push(
    uk.id + ' «' + uk.title + '»: ' + uk.lessons.length + ' уроків, ' + uk.lessons.reduce((n, l) => n + l.teach.length, 0) + ' підтем, завдання ' + JSON.stringify(counts) + '; позначено: ' + flagged.size + ' (модуль: ' + (isFlagged(uk.id) ? 'так' : 'ні') + '), мови: ' + Object.keys(trees).map((l) => l || 'uk').join('/')
  );
}

function typeLabel(type, id) {
  if (!type) return '';
  const map = { module: 'модуль', lesson: 'урок', teach: 'теорія (підтема)', situation: 'ситуація шару 2', summary: 'рядок підсумку модуля' };
  return map[type] ?? 'завдання: ' + type;
}

// Публічна копія: без позначених модулів / уроків / фрагментів. Прапорів у ній нема (все, що лишилось, безпечне).
function toPublic(mod, isFlagged) {
  const clean = (t) => {
    const { restricted, id, ...rest } = t;
    return { ...rest, restricted: false };
  };
  if (isFlagged(mod.id)) {
    return { id: mod.id, number: mod.number, title: '', restricted: false, finalRestricted: false, lessons: [], summary: null, summaryRestricted: [] };
  }
  const lessons = mod.lessons
    .filter((l) => !isFlagged(l.id))
    .map((l) => {
      const teach = l.teach.map((t, i) => [t, l.id + ':t' + (i + 1)]).filter(([, id]) => !isFlagged(id)).map(([t]) => clean(t));
      const l1 = l.l1.map((t, i) => [t, l.id + ':a' + (i + 1)]).filter(([, id]) => !isFlagged(id)).map(([t]) => clean(t));
      let l2 = null;
      if (l.l2 && !isFlagged(l.id + ':s')) {
        const questions = l.l2.questions.map((t, i) => [t, l.id + ':b' + (i + 1)]).filter(([, id]) => !isFlagged(id)).map(([t]) => clean(t));
        l2 = { ...l.l2, situationRestricted: false, questions };
      }
      return { id: l.id, code: l.code, title: l.title, restricted: false, teach, l1, l2 };
    })
    .filter((l) => l.teach.length > 0);
  const summary = (mod.summary ?? '').split('\n').filter((_, i) => !isFlagged(mod.id + ':u' + (i + 1))).join('\n');
  return { id: mod.id, number: mod.number, title: mod.title, restricted: false, finalRestricted: false, lessons, summary, summaryRestricted: [] };
}

// ───────── Підсумки ─────────
if (SEED) {
  const next = {
    _comment: 'Джерело істини для ризикового контенту (обхід виявлення, купівля акаунтів, клоакінг). Позначка за ID фрагмента: m3 = модуль, m3l2 = урок, m3l2:t1 = підтема (t), :a1 = завдання шару 1 (a), :s = ситуація шару 2, :b1 = завдання шару 2 (b), m3:u4 = рядок підсумку (u). Перенесення в en/ru за ID робить scripts/import-modules.mjs.',
    modules: [...new Set([...(marks.modules ?? []), ...[...seedAdd].filter((id) => /^m\d+$/.test(id))])].sort((x, y) => x.localeCompare(y, 'en', { numeric: true })),
    lessons: [...new Set([...(marks.lessons ?? []), ...[...seedAdd].filter((id) => /^m\d+l\d+$/.test(id))])].sort((x, y) => x.localeCompare(y, 'en', { numeric: true })),
    fragments: [...new Set([...(marks.fragments ?? []), ...[...seedAdd].filter((id) => /:/.test(id))])].sort((x, y) => x.localeCompare(y, 'en', { numeric: true })),
  };
  fs.writeFileSync(RESTRICTED_FILE, JSON.stringify(next, null, 1) + '\n');
  console.log('restricted.json: модулів ' + next.modules.length + ', уроків ' + next.lessons.length + ', фрагментів ' + next.fragments.length);
}

docRows.sort((x, y) => x.module.localeCompare(y.module) || x.id.localeCompare(y.id, 'en', { numeric: true }));
fs.mkdirSync(path.dirname(IDS_DOC), { recursive: true });
const idsText =
  ['# Ризикові фрагменти: перелік ID', '',
    'Для подальшого переписування в інформаційному форматі. Тут лише ID, текст не цитується. Джерело істини: content/restricted.json. Файл генерує node scripts/import-modules.mjs, вручну не редагувати.', '',
    'Схема ID: m3 = модуль, m3l2 = урок, m3l2:t1 = підтема (теорія), :a1 = завдання шару 1, :s = ситуація шару 2, :b1 = завдання шару 2, m3:u4 = рядок підсумку модуля. Позначений модуль або урок знімає й усе вкладене.', '',
    '| Модуль | Урок | ID | Тип кроку |', '|---|---|---|---|',
    ...docRows.map((r) => '| ' + r.module + ' | ' + (r.lesson || '—') + ' | ' + r.id + ' | ' + r.type + ' |'), '',
    'Разом позначених одиниць: ' + docRows.length + '.', ''].join('\n');
fs.writeFileSync(IDS_DOC, idsText);

console.log(report.join('\n'));
if (warnList.length) {
  console.log('\nУВАГА: регулярка знайшла ризикові фрагменти, яких нема в content/restricted.json (у публічний набір вони все одно не потраплять): ' + warnList.length);
  console.log(warnList.slice(0, 30).join(', ') + (warnList.length > 30 ? ', ...' : ''));
  console.log('Додай їх у restricted.json (node scripts/import-modules.mjs --seed) або перевір, чи це хибне спрацювання.');
  if (STRICT) process.exit(1);
}
if (warnings.length) console.log('\nПОПЕРЕДЖЕННЯ:\n' + warnings.join('\n'));
if (!incomplete.length) fs.rmSync(path.join(ROOT, 'content', 'INCOMPLETE.md'), { force: true });
if (incomplete.length) {
  console.log('\nНЕПОВНІ ПИТАННЯ (пропущено, автору треба доповнити варіанти в .md):\n' + incomplete.join('\n'));
  fs.writeFileSync(
    path.join(ROOT, 'content', 'INCOMPLETE.md'),
    '# Питання, яким у джерелі бракує варіантів\n\nКонвертер їх пропускає. Додай хибні варіанти в .md і запусти `node scripts/import-modules.mjs`.\n\n' +
      incomplete.map((l) => `- ${l}`).join('\n') +
      '\n'
  );
}
