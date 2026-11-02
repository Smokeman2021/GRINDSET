// Арт-система v2: стискає вихідні PNG з app-mvp/assets/art-v2 у легкі WebP (app-mvp/assets/art-v2-opt) і генерує маніфест
// app-mvp/src/art/manifest.generated.ts, через який застосунок підключає арт за КЛЮЧЕМ (шлях без розширення, напр. "worlds/locations/cafe").
//
// Заміна арту не вимагає змін коду: поклади файл з тим самим іменем у art-v2/, запусти `npm run art:build` (у app-mvp). Нові файли
// підхоплюються автоматично. Вихідні PNG лишаються еталоном (118 МБ), у застосунок їде лише стиснена копія (~10 МБ).
//
//   cd app-mvp && npm run art:build
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app-mvp');
const SRC = path.join(app, 'assets', 'art-v2');
const OUT = path.join(app, 'assets', 'art-v2-opt');
const MANIFEST = path.join(app, 'src', 'art', 'manifest.generated.ts');
const sharp = createRequire(path.join(app, 'package.json'))('sharp');

// Максимальна довга/ширина сторона й якість за папкою. Персонажі/заставки портретні, локації ландшафтні, іконки квадратні.
const RULES = [
  { match: /^fx\//, width: 512, quality: 88 },
  { match: /^ui\//, width: 320, quality: 88 },
  { match: /^worlds\/posters\//, width: 640, quality: 82 },
  { match: /^worlds\/(locations|weather|transport)\//, width: 1216, quality: 84 },
  { match: /^worlds\/(acts|splashes)\//, width: 832, quality: 84 },
  { match: /^character\//, width: 700, quality: 86 },
];
const SKIP = [/^lora-tests\//];

function walk(dir, rel = '') {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const r = rel ? `${rel}/${n}` : n;
    if (fs.statSync(p).isDirectory()) out.push(...walk(p, r));
    else if (/\.(png|jpe?g|webp)$/i.test(n)) out.push(r);
  }
  return out.sort();
}

const files = walk(SRC).filter((f) => !SKIP.some((s) => s.test(f)));
fs.rmSync(OUT, { recursive: true, force: true });
const entries = [];
let inBytes = 0;
let outBytes = 0;

for (const f of files) {
  const rule = RULES.find((r) => r.match.test(f)) ?? { width: 800, quality: 78 };
  const key = f.replace(/\.[^.]+$/, '');
  const dest = path.join(OUT, `${key}.webp`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const meta = await sharp(path.join(SRC, f)).metadata();
  const w = Math.min(meta.width, rule.width);
  const info = await sharp(path.join(SRC, f)).resize({ width: w }).webp({ quality: rule.quality, alphaQuality: 90, effort: 5 }).toFile(dest);
  inBytes += fs.statSync(path.join(SRC, f)).size;
  outBytes += info.size;
  entries.push({ key, w: info.width, h: info.height, alpha: !!meta.hasAlpha });
}

const lines = entries.map((e) => `  '${e.key}': { src: require('../../assets/art-v2-opt/${e.key}.webp'), w: ${e.w}, h: ${e.h} },`);
const ts = `// ЗГЕНЕРОВАНО скриптом scripts/optimize-art.mjs (npm run art:build). Не редагувати вручну.
// Ключ = шлях у assets/art-v2 без розширення. Заміна файла з тим самим іменем + art:build не вимагає змін коду.
export type ArtKey =
${entries.map((e) => `  | '${e.key}'`).join('\n')};

export const ART_MANIFEST: Record<ArtKey, { src: number; w: number; h: number }> = {
${lines.join('\n')}
};
`;
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, ts);
console.log(`Готово: ${entries.length} файлів, ${(inBytes / 1048576).toFixed(1)} МБ → ${(outBytes / 1048576).toFixed(1)} МБ`);
console.log(`Маніфест: ${path.relative(root, MANIFEST)}`);
