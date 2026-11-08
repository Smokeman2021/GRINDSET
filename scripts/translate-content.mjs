// Переклад контенту модулів (generated/mNN.json) через DeepL: uk -> en / ru.
// Використання:
//   node scripts/translate-content.mjs count            — порахувати символи, нічого не відправляти
//   node scripts/translate-content.mjs run en [m03 m04]  — перекласти (усі модулі або лише вказані)
// Ключ береться з DEEPL_API_KEY у .env у корені (git-ignored). Кеш: scripts/.translate-cache-<lang>.json,
// тож повторний запуск не витрачає квоту на вже перекладене.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const genDir = path.join(root, 'app-mvp', 'src', 'data', 'generated');
const TARGET = { en: 'EN-US', ru: 'RU' };

function loadKey() {
  const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
  const m = env.match(/^DEEPL_API_KEY=(.+)$/m);
  if (!m) throw new Error('DEEPL_API_KEY не знайдено в .env');
  return m[1].trim();
}

// Мапа ключів, які містять текст для гравця. Індекси відповідей, числа, типи, прапори не чіпаємо.
const TEXT_KEYS = new Set(['title', 'body', 'q', 'explain', 'situation', 'summary', 'label', 'unit']);
const TEXT_ARRAY_KEYS = new Set(['options', 'items']);

// Обходить JSON і викликає visit(obj, key, index) для кожного текстового рядка, який треба перекласти.
function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && TEXT_KEYS.has(k)) visit(node, k, null);
    else if (Array.isArray(v) && TEXT_ARRAY_KEYS.has(k)) v.forEach((s, i) => typeof s === 'string' && visit(v, i, null));
    else if (k === 'pairs' && Array.isArray(v)) v.forEach((p) => p.forEach((s, i) => typeof s === 'string' && visit(p, i, null)));
    else walk(v, visit);
  }
}

function files(only) {
  return fs
    .readdirSync(genDir)
    .filter((f) => /^m\d\d\.json$/.test(f))
    .filter((f) => !only.length || only.includes(f.replace('.json', '')));
}

async function translateBatch(key, lang, texts) {
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, source_lang: 'UK', target_lang: TARGET[lang], preserve_formatting: true }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  return (await res.json()).translations.map((t) => t.text);
}

const [cmd, lang, ...only] = process.argv.slice(2);

if (cmd === 'count') {
  let total = 0;
  for (const f of files(lang ? [lang, ...only] : [])) {
    const data = JSON.parse(fs.readFileSync(path.join(genDir, f), 'utf8'));
    let n = 0;
    walk(data, (o, k) => (n += o[k].length));
    console.log(f, n);
    total += n;
  }
  console.log('РАЗОМ символів:', total);
} else if (cmd === 'run' && TARGET[lang]) {
  const key = loadKey();
  const cachePath = path.join(root, 'scripts', `.translate-cache-${lang}.json`);
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  for (const f of files(only)) {
    const data = JSON.parse(fs.readFileSync(path.join(genDir, f), 'utf8'));
    const slots = [];
    walk(data, (o, k) => slots.push([o, k]));
    const todo = [...new Set(slots.map(([o, k]) => o[k]).filter((s) => !(s in cache)))];
    for (let i = 0; i < todo.length; i += 40) {
      const chunk = todo.slice(i, i + 40);
      const out = await translateBatch(key, lang, chunk);
      chunk.forEach((s, j) => (cache[s] = out[j]));
      fs.writeFileSync(cachePath, JSON.stringify(cache));
      console.log(f, `${Math.min(i + 40, todo.length)}/${todo.length}`);
    }
    slots.forEach(([o, k]) => (o[k] = cache[o[k]]));
    fs.writeFileSync(path.join(genDir, f.replace('.json', `.${lang}.json`)), JSON.stringify(data, null, 1));
    console.log('записано', f.replace('.json', `.${lang}.json`));
  }
} else {
  console.log('Використання: count | run <en|ru> [m03 m04 ...]');
}
