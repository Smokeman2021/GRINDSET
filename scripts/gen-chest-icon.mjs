// Генерація варіантів іконки «Скриня золота» через Replicate (flux-kontext-pro + remove-bg).
// Запуск: node scripts/gen-chest-icon.mjs <назва> "<опис форми>"   Результат: app-mvp/assets/icons/new/<назва>.png
// Токен читається з .env у корені (REPLICATE_API_TOKEN), у вивід не потрапляє.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const TOKEN = env.REPLICATE_API_TOKEN;
if (!TOKEN) throw new Error('нема REPLICATE_API_TOKEN у .env');

const [name, shape] = process.argv.slice(2);
if (!name || !shape) throw new Error('використання: node scripts/gen-chest-icon.mjs <назва> "<опис>"');

const refPath = path.join(root, 'app-mvp', 'assets', 'icons', 'coin.png'); // канонічний стиль
const ref = 'data:image/png;base64,' + fs.readFileSync(refPath).toString('base64');

async function run(model, input) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
      body: JSON.stringify({ input }),
    });
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 12000));
      continue;
    }
    let p = await r.json();
    if (!r.ok) throw new Error(`${model}: ${r.status} ${JSON.stringify(p).slice(0, 300)}`);
    while (p.status === 'starting' || p.status === 'processing') {
      await new Promise((res) => setTimeout(res, 2000));
      p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    }
    if (p.status !== 'succeeded') throw new Error(`${model}: ${p.status} ${p.error ?? ''}`);
    return Array.isArray(p.output) ? p.output[0] : p.output;
  }
  throw new Error('ліміт запитів Replicate, спробуй пізніше');
}

const prompt =
  `Create a NEW game icon in exactly the same 3D clay glossy style, lighting, material finish and palette as the reference coin icon (soft rounded forms, glossy highlights, thick soft bevel). ` +
  `Subject: a golden treasure chest, a valuable trophy reward. ${shape} ` +
  `Futuristic tech feel: subtle glowing cyan-teal accents. Do NOT include a coin or star or any copy of the reference object. ` +
  `Single centered object, plain flat light-grey background, no text, no shadow on the ground, full object visible with margin.`;

const gen = await run('black-forest-labs/flux-kontext-pro', { prompt, input_image: ref, aspect_ratio: '1:1', output_format: 'png', safety_tolerance: 2 });
const rawBuf = Buffer.from(await (await fetch(gen)).arrayBuffer());
const outDir = path.join(root, 'app-mvp', 'assets', 'icons', 'new');
fs.writeFileSync(path.join(outDir, `${name}.raw.png`), rawBuf);

const cut = await run('lucataco/remove-bg', { image: 'data:image/png;base64,' + rawBuf.toString('base64') });
const cutBuf = Buffer.from(await (await fetch(cut)).arrayBuffer());
fs.writeFileSync(path.join(outDir, `${name}.png`), cutBuf);
console.log('готово', path.join('app-mvp/assets/icons/new', `${name}.png`));
