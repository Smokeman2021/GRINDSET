// Конвертер контенту: content/modules/grindset-module-NN-expanded.md -> app-mvp/src/data/generated/mNN.json
// Запуск: node scripts/import-modules.mjs   (нічого не встановлюючи)
// Правки тексту роби в .md і перезапускай скрипт: застосунок читає лише згенеровані JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'modules');
const OUT = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated');

// Матеріали, які для сторів і політик Meta ризиковані (обхід виявлення, купівля акаунтів, клоакінг).
// Лишаємо в репозиторії, але у збірку за замовчуванням не пускаємо: див. src/data/restricted.ts.
const RESTRICTED_LESSONS = new Set(['3.2', '3.3']);
const RESTRICTED_MODULES = new Set(['09']);
const RESTRICTED_FINALS = new Set(['03']);

// Ручні правки контенту: відповіді для завдань "вписати" і набори варіантів для питань, де в джерелі лише правильний (ключ: код уроку#номер питання, 0 = завдання шару 1).
// Значення: { answer: число, unit?: рядок, tolerance?: число }
const NUMERIC = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'overrides.json'), 'utf8'));

// Теми зі специфікації MVP, які не пускаємо в мобільну збірку: обхід виявлення, купівля/фарм акаунтів, клоакінг.
const RESTRICT_RE = /клоак|антидетект|fingerprint|дофарм|проксі|акаунт-парк|купле\p{L}*\s+акаунт|(?<![\p{L}])фарм(?!ац|ак)/iu;
const isRestrictedText = (s) => RESTRICT_RE.test(s);

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
  out.restricted = isRestrictedText(JSON.stringify(t));
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
      teach.push({ title: tTitle, body, restricted: isRestrictedText(`${tTitle}\n${body}`) });
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
        situationRestricted: isRestrictedText(situation),
        isFinal: /Фінальна/.test(s.heading),
        questions: parsed,
      };
    }
  });

  return { id, code, title, restricted: RESTRICTED_LESSONS.has(code), teach, l1, l2 };
}

function parseModule(file) {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const num = /module-(\d+)-/.exec(file)[1];
  const title = /^# Модуль \d+ — (.+)$/m.exec(text)[1].trim();
  const mod = { id: `m${Number(num)}`, number: num, title, restricted: RESTRICTED_MODULES.has(num), finalRestricted: RESTRICTED_FINALS.has(num) };

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
  return { ...mod, lessons, summary };
}

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /^grindset-module-\d+-expanded\.md$/.test(f)).sort();
const report = [];
for (const f of files) {
  const m = parseModule(f);
  fs.writeFileSync(path.join(OUT, `m${m.number}.json`), JSON.stringify(m, null, 1));
  const counts = {};
  let rT = 0;
  let rQ = 0;
  m.lessons.forEach((l) => {
    rT += l.teach.filter((t) => t.restricted).length;
    [...l.l1, ...(l.l2?.questions ?? [])].forEach((t) => {
      counts[t.type] = (counts[t.type] ?? 0) + 1;
      if (t.restricted) rQ++;
    });
  });
  report.push(
    `${m.id} «${m.title}»: ${m.lessons.length} уроків, ${m.lessons.reduce((s, l) => s + l.teach.length, 0)} підтем, завдання ${JSON.stringify(counts)}; ризикових: ${rT} підтем, ${rQ} завдань`
  );
}
console.log(report.join('\n'));
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
