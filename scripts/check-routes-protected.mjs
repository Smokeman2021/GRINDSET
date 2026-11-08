// Перевіряє, що кожен маршрут із app-mvp/app/ перелічений у PROTECTED_ROUTES (app/_layout.tsx), тобто закритий входом при закритому тесті.
// Новий файл-екран без запису в списку лишився б відкритим для людей без входу.   node scripts/check-routes-protected.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app-mvp', 'app');
const SKIP = new Set(['_layout', 'login']);

const routes = new Set();
function walk(dir, rel) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const r = rel ? `${rel}/${n}` : n;
    if (fs.statSync(p).isDirectory()) {
      // група в дужках — окремий маршрут верхнього рівня з внутрішнім навігатором
      if (/^\(.+\)$/.test(n) && !rel) routes.add(n);
      else walk(p, r);
    } else if (/\.tsx?$/.test(n)) {
      const name = r.replace(/\.tsx?$/, '');
      if (!SKIP.has(name) && !name.endsWith('/_layout')) routes.add(name);
    }
  }
}
walk(root, '');

const layout = fs.readFileSync(path.join(root, '_layout.tsx'), 'utf8');
const m = /PROTECTED_ROUTES\s*=\s*\[([\s\S]*?)\n\];/.exec(layout); // кінець списку = «];» з нового рядка (в назвах бувають дужки [id])
if (!m) {
  console.error('Не знайшов PROTECTED_ROUTES у app/_layout.tsx');
  process.exit(2);
}
const listed = new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
const open = [...routes].filter((r) => !listed.has(r));
const stale = [...listed].filter((r) => !routes.has(r));
if (open.length || stale.length) {
  if (open.length) console.error('НЕ ЗАКРИТІ входом (додай у PROTECTED_ROUTES):', open.join(', '));
  if (stale.length) console.error('У списку є зайві (файлу нема):', stale.join(', '));
  process.exit(1);
}
console.log(`OK: усі ${routes.size} маршрутів закриті входом`);
