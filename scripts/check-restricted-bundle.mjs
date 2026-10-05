// Перевірка збірки для стори: після `expo export --clear` з EXPO_PUBLIC_INCLUDE_RESTRICTED=false
// у бандлі не має лишитись ризикових слів (uk / en / ru). Скрипт ЛИШЕ перевіряє, контент не змінює.
//   node scripts/check-restricted-bundle.mjs            (платформа web)
//   node scripts/check-restricted-bundle.mjs --platform android
//   node scripts/check-restricted-bundle.mjs --no-build  (лише просканувати вже зібраний dist/restricted-check)
// Код виходу 1, якщо знайдено збіги. Збіги виводяться з контекстом і кількістю по файлах.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app-mvp');
const OUT = join('dist', 'restricted-check'); // відносно app-mvp, dist/ у .gitignore
const args = process.argv.slice(2);
const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'web';
const noBuild = args.includes('--no-build');

// Шаблони. Український збігається з RESTRICT_RE у app-mvp/src/data/restricted.ts і scripts/import-modules.mjs
const PATTERNS = {
  uk: /клоак|антидетект|fingerprint|дофарм|проксі|акаунт-парк|купле\p{L}*\s+акаунт|(?<![\p{L}])фарм(?!ац|ак)/giu,
  en: /cloak(?:ing|ed)?|anti-?detect|fingerprint(?:ing)?|(?:bought|buy(?:ing)?|purchased)\s+accounts?|account\s+farm(?:ing)?|warm(?:ing)?[- ]up\s+(?:of\s+)?accounts?|(?:residential|mobile|datacenter|buy|rent(?:ing)?|cheap)\s+prox(?:y|ies)|Proxies:\s+Why|prox(?:y|ies)\s+(?:server|provider|pool)s?/giu,
  ru: /клоак|антидетект|фингерпринт|прогрев\p{L}*\s+аккаунт|(?<![\p{L}])фарм(?!ац|ак)|купленн\p{L}*\s+аккаунт|прокси/giu,
};

// Сам вихідний текст регулярки з restricted.ts потрапляє в бандл: його вирізаємо, щоб не ловити власний фільтр
function selfSources() {
  const src = readFileSync(join(app, 'src', 'data', 'restricted.ts'), 'utf8');
  const m = src.match(/RESTRICT_RE\s*=\s*\/(.+)\/[a-z]*;/);
  if (!m) return [];
  // у бандлі кирилиця в літералі екранована як \uXXXX, тому вирізаємо і цей варіант
  const esc = m[1].replace(/[^\u0000-\u007f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return [m[1], esc];
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|hbc|json|bundle)$/.test(name)) out.push(p);
  }
  return out;
}

const outDir = join(app, OUT);

if (!noBuild) {
  rmSync(outDir, { recursive: true, force: true });
  console.log(`Збираю (${platform}) з EXPO_PUBLIC_INCLUDE_RESTRICTED=false ...`);
  const r = spawnSync('npx', ['expo', 'export', '--platform', platform, '--clear', '--output-dir', OUT], {
    cwd: app,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_INCLUDE_RESTRICTED: 'false', CI: '1' },
  });
  if (r.status !== 0) {
    console.error('expo export завершився з помилкою: перевірку не виконано');
    process.exit(2);
  }
}

if (!existsSync(outDir)) {
  console.error(`Нема ${outDir}: спершу збери без --no-build`);
  process.exit(2);
}

const strip = selfSources();
const files = walk(outDir);
const hits = []; // { lang, file, word, ctx }
for (const f of files) {
  let text = readFileSync(f, 'utf8');
  for (const s of strip) text = text.split(s).join('');
  for (const [lang, re] of Object.entries(PATTERNS)) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const a = Math.max(0, m.index - 40);
      hits.push({ lang, file: f.slice(outDir.length + 1), word: m[0], ctx: text.slice(a, m.index + m[0].length + 40).replace(/\s+/g, ' ') });
    }
  }
}

if (!hits.length) {
  console.log(`OK: у ${files.length} файлах бандла ризикових слів нема.`);
  process.exit(0);
}

const byLang = {};
for (const h of hits) byLang[h.lang] = (byLang[h.lang] ?? 0) + 1;
console.error(`\nЗНАЙДЕНО ${hits.length} збігів у бандлі з INCLUDE_RESTRICTED=false (${Object.entries(byLang).map(([l, n]) => `${l}: ${n}`).join(', ')}).`);
const groups = new Map();
for (const h of hits) {
  const key = `${h.lang}|${h.word.toLowerCase()}`;
  const g = groups.get(key) ?? { n: 0, ctx: h.ctx, lang: h.lang, word: h.word };
  g.n++;
  groups.set(key, g);
}
for (const g of [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 40)) console.error(` [${g.lang}] «${g.word}» x${g.n} ...${g.ctx}...`);
console.error('\nСкрипт нічого не змінює. Прибрати ризикові матеріали з бандла: рішення автора (див. docs/DECISIONS.md, 1.2).');
process.exit(1);
