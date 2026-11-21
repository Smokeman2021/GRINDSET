// Перевірка збірки для стори: після `expo export --clear` з EXPO_PUBLIC_INCLUDE_RESTRICTED=false
// у бандлі не має лишитись ризикових слів (uk / en / ru). Скрипт ЛИШЕ перевіряє, контент не змінює.
//   node scripts/check-restricted-bundle.mjs            (платформа web)
//   node scripts/check-restricted-bundle.mjs --platform android
//   node scripts/check-restricted-bundle.mjs --no-build  (лише просканувати вже зібраний dist/restricted-check)
// Перед збіркою запускається `import-modules.mjs --strict`: публічний набір має бути свіжим, а регулярка не повинна
// знаходити фрагментів, яких нема в content/restricted.json. Слова беруться з scripts/restricted-patterns.mjs.
// Код виходу 1, якщо знайдено збіги. Збіги виводяться з контекстом і кількістю.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE_PATTERNS } from './restricted-patterns.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app-mvp');
const OUT = join('dist', 'restricted-check'); // відносно app-mvp, dist/ у .gitignore
const args = process.argv.slice(2);
const platform = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : 'web';
const noBuild = args.includes('--no-build');

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
  console.log('Оновлюю набори контенту (import-modules --strict) ...');
  const imp = spawnSync(process.execPath, [join(root, 'scripts', 'import-modules.mjs'), '--strict'], { cwd: root, stdio: 'inherit' });
  if (imp.status !== 0) {
    console.error('import-modules --strict не пройшов: перевірку не виконано');
    process.exit(2);
  }
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

const files = walk(outDir);
const hits = []; // { lang, file, word, ctx }
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [lang, re] of Object.entries(BUNDLE_PATTERNS)) {
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
console.error('\nСкрипт нічого не змінює. Позначити фрагмент: content/restricted.json, далі node scripts/import-modules.mjs.');
process.exit(1);
