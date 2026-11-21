// Заміняє реальний текст (напр. назви товарів) у прямокутних зонах скріншота на узагальнені
// підписи: колір фону береться СЕМПЛОМ із самого скріншота (не білий прямокутник), тому шов
// не видно — виглядає так, ніби підпис завжди там був, а не заліплений зверху.
// Потребує `sharp`, який НЕ є залежністю репозиторію (як і @imgly/background-removal-node для
// аватарів) — ставити окремо в тимчасовій теці: npm install sharp.
// Використання: node relabel.cjs <вхідний.jpg> <вихідний.png> <rows.json>
//   rows.json: { scale, opts: {fontSize, color}, rows: [{x,y,w,h,sampleX?,sampleY?}], labels: [string] }
//   sampleX/sampleY (опційно) — точка на скріншоті, звідки брати колір фону для цього рядка
//   (за замовчуванням — трохи правіше й нижче від прямокутника, у порожньому місці рядка).
const sharp = require('sharp');
const fs = require('fs');

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function sampleColor(raw, info, x, y) {
  const px = Math.max(0, Math.min(info.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(info.height - 1, Math.round(y)));
  const ch = info.channels;
  const i = (py * info.width + px) * ch;
  const r = raw[i], g = raw[i + 1], b = raw[i + 2];
  return `rgb(${r},${g},${b})`;
}

async function relabelRows(inFile, outFile, rows, labels, scale, opts = {}) {
  const img = sharp(inFile);
  const meta = await img.metadata();
  const { data: raw, info } = await img.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pad = opts.padX ?? 4;
  const fontSize = opts.fontSize ?? 13;
  const rects = rows.map((r) => ({
    x: r.x * scale,
    y: r.y * scale,
    w: r.w * scale + pad * 2,
    h: r.h * scale,
    sampleX: r.sampleX != null ? r.sampleX * scale : undefined,
    sampleY: r.sampleY != null ? r.sampleY * scale : undefined,
  }));
  const parts = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const sx = r.sampleX ?? r.x + r.w + 20;
    const sy = r.sampleY ?? r.y + r.h / 2;
    const bg = await sampleColor(raw, info, sx, sy);
    parts.push(`<rect x="${r.x - pad}" y="${r.y - 1}" width="${r.w}" height="${r.h + 2}" fill="${bg}"/>`);
  }
  const svgTexts = rects
    .map(
      (r, i) =>
        `<text x="${r.x - pad + 2}" y="${r.y + r.h / 2 + fontSize * 0.35}" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="${fontSize}" fill="${opts.color ?? '#1877f2'}">${escapeXml(labels[i])}</text>`
    )
    .join('\n');
  const svg = `<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">${parts.join('\n')}${svgTexts}</svg>`;
  await img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(outFile);
}

const [, , inFile, outFile, rowsJsonFile] = process.argv;
const spec = JSON.parse(fs.readFileSync(rowsJsonFile, 'utf8'));
relabelRows(inFile, outFile, spec.rows, spec.labels, spec.scale, spec.opts || {}).then(() => console.log('wrote', outFile));
