// Генерує docs/BRAND_MENTIONS.md: усі згадки назв продуктів третіх сторін (Facebook, Meta, Instagram, Ads Manager тощо)
// в інтерфейсі, коді, метаданих і контенті, плюс місця, де видно логотипи Meta.
//   node scripts/brand-mentions.mjs
// Перелік «логотипи Meta» ручний (див. LOGO_NOTES): його перевіряє людина, скрипт лише додає список файлів.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app-mvp');
// «Мета» українською = ціль, тому шукаємо лише латинське Meta (з великої) і регістро-залежні форми
const RE = /\bFB\b|Facebook|facebook|Фейсбук|фейсбук|\bMeta\b|Instagram|Messenger|WhatsApp|Ads Manager|Business Manager|Business Suite|Events Manager|Commerce Manager/;

const walk = (dir, out = []) => {
  for (const n of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.expo', 'assets'].includes(n)) continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|js|md)$/.test(n)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

const ui = []; // { file, line, text }
const contentCounts = []; // { file, n }
const isContent = (r) => /^app-mvp\/src\/data\/(generated|generated-public)\//.test(r) || /^app-mvp\/src\/data\/(lessons|module02|adsManagerTour|library|library\.restricted|glossary|glossary\.restricted)\.ts$/.test(r) || /^content\//.test(r);
const skip = (r) => /^app-mvp\/src\/brand\.ts$/.test(r) || /^app-mvp\/src\/data\/bm\/adsmanager\.ts$/.test(r) || /package-lock\.json$/.test(r) || /^docs\//.test(r) || /^scripts\//.test(r) || /\.restricted\.public\.ts$/.test(r);

for (const f of [...walk(path.join(APP, 'app')), ...walk(path.join(APP, 'src')), path.join(APP, 'app.json'), path.join(APP, 'package.json'), ...walk(path.join(ROOT, 'content', 'modules'))]) {
  const r = rel(f);
  if (skip(r)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const hits = lines.map((t, i) => [i + 1, t]).filter(([, t]) => RE.test(t));
  if (!hits.length) continue;
  if (isContent(r)) contentCounts.push({ file: r, n: hits.length });
  else for (const [line, t] of hits) ui.push({ file: r, line, text: t.trim().replace(/\|/g, '\\|').slice(0, 150) });
}
// Каталог екранів карти кабінету: назви розділів
const bmScreens = fs.readFileSync(path.join(APP, 'src', 'data', 'bm', 'adsmanager.ts'), 'utf8');
const bmHits = bmScreens.split('\n').filter((l) => RE.test(l)).length;

const shots = fs.existsSync(path.join(APP, 'assets', 'bm', 'adsmanager')) ? fs.readdirSync(path.join(APP, 'assets', 'bm', 'adsmanager')).filter((n) => n.endsWith('.png')) : [];

const LOGO_NOTES = [
  '`app-mvp/assets/bm/adsmanager/*.png`: реальні знімки кабінету. Інтерфейс Meta на них видно цілком. Перевірено вручну: `campaigns-list.png` (логотип-«нескінченність» зліва вгорі, він є й на інших екранах із тією ж лівою панеллю Ads Manager) і `mbs-home.png` (напис «Meta Business Suite» у лівому верхньому куті, згадки Facebook/Instagram у тексті сторінки).',
  '`/adsim` і розділ «Карта кабінету» у Бібліотеці (`app-mvp/app/adsim.tsx`, `src/components/BmExplorer.tsx`): показують ці знімки як є. Окремий тренажер у `adsim.tsx` перемальований власними компонентами в палітрі, схожій на кабінет, без логотипів, але з текстами «Ads Manager» і «Facebook» у підказках.',
  'Решту знімків (список вище) на наявність логотипа окремо не перевіряв: вважати, що логотип або назва продукту є на кожному зі знімків ліворуч угорі.',
  '`app-mvp/assets/app-icon.png`: логотипів Meta немає (персонаж Гріндік на зеленому тлі).',
];

const REMOVED = [
  'Шапка застосунку: було «FB АРБІТРАЖ», тепер назва курсу з `app-mvp/src/brand.ts` (`COURSE_NAME` = «Арбітраж трафіку»; en/ru: `COURSE_NAMES`).',
  'Назва модуля 02: було «Facebook: знайомство та фундамент», тепер «Рекламна платформа: знайомство та фундамент» (`src/data/modules.ts`). Нову назву перевірити автору.',
  'Назва модуля 05 (uk/en/ru): перевизначена в `content/overrides.json` (ключ `titles:m5`), importer застосовує її до всіх мов. Нові назви перевірити автору.',
  'Питання онбордингу/адаптації «А з рекламним кабінетом Facebook?» → «А з рекламним кабінетом?».',
  'Бібліотека → Рекламний кабінет: описи без «Facebook Ads Manager».',
  'Метадані: `app.json` (name = GRINDSET, опис без згадок бренду, `web.name`/`web.shortName`); `package.json` (`grindset-mvp`). Назва вкладки браузера = GRINDSET.',
  'Додано дисклеймер (`META_DISCLAIMER` у `brand.ts`): дрібно на першому екрані онбордингу і в Налаштування → Про застосунок.',
];

const out = [];
out.push('# Згадки назв продуктів третіх сторін і логотипи Meta');
out.push('');
out.push('Файл генерує `node scripts/brand-mentions.mjs` (розділи 2–4 автоматично), розділи 1 і 5 пишуться вручну в самому скрипті. Не редагувати вручну.');
out.push('');
out.push('Правило: у шапці, назвах модулів, назві застосунку, іконках і метаданих назв продуктів третіх сторін нема. Описові згадки в тексті уроків не змінювалися.');
out.push('');
out.push('## 1. Що прибрано з оболонки застосунку');
out.push('');
REMOVED.forEach((r) => out.push('- ' + r));
out.push('');
out.push('## 2. Згадки в інтерфейсі й коді застосунку (залишились)');
out.push('');
out.push('Це описові тексти (підказки, репліки Гріндіка, пояснення, службові коментарі) і назви розділів. Для перегляду автору.');
out.push('');
out.push('| Файл | Рядок | Текст |');
out.push('|---|---|---|');
ui.forEach((u) => out.push(`| ${u.file} | ${u.line} | ${u.text} |`));
out.push('');
out.push(`Окремо: \`app-mvp/src/data/bm/adsmanager.ts\` (каталог екранів карти кабінету): ${bmHits} рядків з назвами продуктів у заголовках і підказках екранів.`);
out.push('');
out.push('## 3. Контент (описові згадки, не чіпати)');
out.push('');
out.push('| Файл | Рядків зі згадками |');
out.push('|---|---|');
contentCounts.filter((c) => !/generated/.test(c.file)).sort((a, b) => b.n - a.n).forEach((c) => out.push(`| ${c.file} | ${c.n} |`));
out.push('');
out.push(`\`generated/\` і \`generated-public/\` (з \`content/modules/*.md\`): ${contentCounts.filter((c) => /generated\/|generated-public\//.test(c.file)).reduce((s, c) => s + c.n, 0)} рядків; змінюються лише через \`.md\`.`);
out.push('');
out.push('## 4. Метадані');
out.push('');
out.push('- `app-mvp/app.json`: `name`, `slug`, `description`, `web.name`, `web.shortName`: без назв продуктів третіх сторін (перевіряється цим скриптом: якщо в `app.json` зʼявиться згадка, вона потрапить у розділ 2).');
out.push('- Назва вкладки браузера й іконка застосунку: GRINDSET, власна ілюстрація.');
out.push('');
out.push('## 5. Де видно логотипи Meta');
out.push('');
LOGO_NOTES.forEach((l) => out.push('- ' + l));
out.push('');
out.push(`Знімки в \`app-mvp/assets/bm/adsmanager/\` (${shots.length} файлів):`);
out.push('');
out.push(shots.map((s) => '`' + s + '`').join(', '));
out.push('');
fs.writeFileSync(path.join(ROOT, 'docs', 'BRAND_MENTIONS.md'), out.join('\n'));
console.log(`docs/BRAND_MENTIONS.md: інтерфейс ${ui.length} рядків, контент ${contentCounts.length} файлів, знімків ${shots.length}`);
