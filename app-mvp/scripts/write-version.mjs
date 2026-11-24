// Перед веб-збіркою записує public/version.json з номером збірки (UI_BUILD з src/version.ts) і часом.
// Застосунок при запуску порівнює свій номер з /version.json (той віддається без кешу) і, якщо він новіший, скидає кеші й перезавантажується:
// так Telegram Mini App, що агресивно кешує index.html, не лишає тестерів на старій версії. Запускається в buildCommand (vercel.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(app, 'src', 'version.ts'), 'utf8');
const m = /export const UI_BUILD\s*=\s*(\d+)/.exec(src);
if (!m) {
  console.error('Не знайшов UI_BUILD у src/version.ts');
  process.exit(1);
}
const out = path.join(app, 'public', 'version.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ build: Number(m[1]), at: new Date().toISOString() }) + '\n');
console.log(`public/version.json: build ${m[1]}`);
