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
  { match: /^cutout\//, width: 720, quality: 88 }, // прозорі фігури: вони «висять» на UI, альфа зберігається
  { match: /^fx\//, width: 512, quality: 88 },
  { match: /^ui\//, width: 320, quality: 88 },
  { match: /^worlds\/posters\//, width: 640, quality: 82 },
  { match: /^worlds\/(locations|weather|transport)\//, width: 1216, quality: 84 },
  { match: /^worlds\/(acts|splashes)\//, width: 832, quality: 84 },
  { match: /^character\//, width: 700, quality: 86 },
];
// character/* це непрозорі оригінали (картини з тлом): застосунок їх більше не використовує, фігури беремо з cutout/*
const SKIP = [/^lora-tests\//, /^character\//];

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

// Обличчя для круглих портретів: у прозорих фігур (cutout) знаходимо центр голови за альфа-каналом.
// x: центр верхніх рядків фігури; y: ~8.5% висоти фігури від її верху; span: яку частку висоти показувати в колі.
// Для портретів-крупних планів (не повнозростових) координати задано вручну.
const FACE_MANUAL = { 'cutout/grindik/grindik_portrait': { x: 0.46, y: 0.27, span: 0.62 } };
async function faceOf(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let y0 = -1;
  for (let y = 0; y < h && y0 < 0; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * c + c - 1] > 128) { y0 = y; break; }
  if (y0 < 0) return null;
  const band = Math.max(2, Math.round(0.04 * (h - y0)));
  let sx = 0;
  let n = 0;
  for (let y = y0; y < Math.min(h, y0 + band); y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * c + c - 1] > 128) { sx += x; n++; }
  if (!n) return null;
  const fig = h - y0;
  return { x: +(sx / n / w).toFixed(3), y: +((y0 + 0.085 * fig) / h).toFixed(3), span: +((0.17 * fig) / h).toFixed(3) };
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
  let pipeline = sharp(path.join(SRC, f));
  if (/^cutout\//.test(f)) {
    // Чистка альфи вирізки: напівпрозорий темний «серпанок» навколо фігури (залишки маски) на світлому тлі видно як плитку; прибираємо його
    const { data, info: ri } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) if (data[i] < 56) data[i] = 0;
    pipeline = sharp(data, { raw: { width: ri.width, height: ri.height, channels: 4 } });
  }
  const info = await pipeline.resize({ width: w }).webp({ quality: rule.quality, alphaQuality: 90, effort: 5 }).toFile(dest);
  inBytes += fs.statSync(path.join(SRC, f)).size;
  outBytes += info.size;
  const face = FACE_MANUAL[key] ?? (/^cutout\/(grindik\/(mood_|pose_)|archetypes|presets|wardrobe|npc)/.test(key) ? await faceOf(dest) : null);
  entries.push({ key, w: info.width, h: info.height, alpha: !!meta.hasAlpha, face });
}

// Транспорт (worlds/transport) це машини на однотонному темному студійному фоні. Для сцени «в дорозі» вирізаємо їх у прозорі cutout/transport/*:
// заливка від країв кадру по гладкому фону (сусід близький до батьківського пікселя й до середнього кольору кутів), зупиняється на контурі машини.
async function transportCutout(f, keyOverride) {
  const name = path.basename(f, path.extname(f));
  const key = keyOverride ?? `cutout/transport/${name}`;
  const dest = path.join(OUT, `${key}.webp`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const { data, info } = await sharp(path.join(SRC, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(px);
  const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / 4);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y, from) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (seen[i]) return;
    const c = px(i);
    if (dist(c, bg) > 52 || (from && dist(c, from) > 7)) return;
    seen[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < W; x++) { push(x, 0, null); push(x, H - 1, null); }
  for (let y = 0; y < H; y++) { push(0, y, null); push(W - 1, y, null); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = (i - x) / W;
    const c = px(i);
    push(x + 1, y, c); push(x - 1, y, c); push(x, y + 1, c); push(x, y - 1, c);
  }
  // розширюємо вирізану область на 2 px, щоб не лишався ореол фону на краях машини
  const cut = new Uint8Array(seen);
  for (let pass = 0; pass < 2; pass++) {
    const nxt = new Uint8Array(cut);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!cut[i] && (cut[i - 1] || cut[i + 1] || cut[i - W] || cut[i + W])) nxt[i] = 1; }
    cut.set(nxt);
  }
  // лишаємо лише найбільшу зв'язну компоненту машини (дрібні плями фону/тіні відпадають)
  const label = new Int32Array(W * H);
  let best = 0;
  let bestSize = 0;
  let nextLabel = 0;
  for (let s0 = 0; s0 < W * H; s0++) {
    if (cut[s0] || label[s0]) continue;
    nextLabel++;
    let size = 0;
    const st = [s0];
    label[s0] = nextLabel;
    while (st.length) {
      const i = st.pop();
      size++;
      const x = i % W;
      for (const j of [x + 1 < W ? i + 1 : -1, x > 0 ? i - 1 : -1, i + W, i - W]) if (j >= 0 && j < W * H && !cut[j] && !label[j]) { label[j] = nextLabel; st.push(j); }
    }
    if (size > bestSize) { bestSize = size; best = nextLabel; }
  }
  for (let i = 0; i < W * H; i++) cut[i] = label[i] === best ? 0 : 1;
  // силует по рядках: між крайніми точками машини все її (вікна й просвіти під кузовом не стають дірками)
  for (let y = 0; y < H; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < W; x++) if (!cut[y * W + x]) { if (a < 0) a = x; b = x; }
    if (a >= 0) for (let x = a; x <= b; x++) cut[y * W + x] = 0;
  }
  for (let i = 0; i < W * H; i++) if (cut[i]) data[i * 4 + 3] = 0;
  const out = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 92, effort: 5 }).toFile(dest);
  entries.push({ key, w: out.width, h: out.height, alpha: true, face: null });
}
for (const f of files) if (/^worlds\/transport\//.test(f)) await transportCutout(f);
// Скриня золота (fx/objects/chest_*) теж лежить на суцільному фоні: вирізаємо в cutout/objects/*, щоб стояла в сцені без прямокутника
for (const f of files) if (/^fx\/objects\/chest_/.test(f)) await transportCutout(f, `cutout/objects/${path.basename(f, path.extname(f))}`);

const lines = entries.map((e) => `  '${e.key}': { src: require('../../assets/art-v2-opt/${e.key}.webp'), w: ${e.w}, h: ${e.h} },`);
const faces = entries.filter((e) => e.face).map((e) => `  '${e.key}': { x: ${e.face.x}, y: ${e.face.y}, span: ${e.face.span} },`);
const ts = `// ЗГЕНЕРОВАНО скриптом scripts/optimize-art.mjs (npm run art:build). Не редагувати вручну.
// Ключ = шлях у assets/art-v2 без розширення. Заміна файла з тим самим іменем + art:build не вимагає змін коду.
export type ArtKey =
${entries.map((e) => `  | '${e.key}'`).join('\n')};

export const ART_MANIFEST: Record<ArtKey, { src: number; w: number; h: number }> = {
${lines.join('\n')}
};

// Центр обличчя у прозорих фігур (частки зображення) для круглих портретів: x, y центр, span частка висоти, що видно в колі
export const ART_FACE: Partial<Record<ArtKey, { x: number; y: number; span: number }>> = {
${faces.join('\n')}
};
`;
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, ts);
console.log(`Готово: ${entries.length} файлів, ${(inBytes / 1048576).toFixed(1)} МБ → ${(outBytes / 1048576).toFixed(1)} МБ`);
console.log(`Маніфест: ${path.relative(root, MANIFEST)}`);
