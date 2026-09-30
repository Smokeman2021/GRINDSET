// Заміняє реальний текст (напр. назви товарів) у прямокутних зонах скріншота на узагальнені
// підписи: білий прямокутник + SVG-текст поверх. Використовується для мапи Business Manager —
// див. content/business-manager-map/00-roadmap.md за метод і калібрування координат.
// Потребує `sharp`, який НЕ є залежністю репозиторію (як і @imgly/background-removal-node для
// аватарів) — ставити окремо в тимчасовій теці: npm install sharp.
// Використання: node relabel.cjs <вхідний.jpg> <вихідний.png> <rows.json>
//   rows.json: { scale, opts: {fontSize, color}, rows: [{x,y,w,h}], labels: [string] }
const sharp = require('sharp');
const fs = require('fs');

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function relabelRows(inFile, outFile, rows, labels, scale, opts = {}) {
  const img = sharp(inFile);
  const meta = await img.metadata();
  const pad = opts.padX ?? 4;
  const fontSize = opts.fontSize ?? 13;
  const rects = rows.map((r) => ({ x: r.x * scale, y: r.y * scale, w: r.w * scale + pad * 2, h: r.h * scale }));
  const svgRects = rects.map((r) => `<rect x="${r.x - pad}" y="${r.y - 1}" width="${r.w}" height="${r.h + 2}" fill="#ffffff"/>`).join('\n');
  const svgTexts = rects
    .map((r, i) => `<text x="${r.x - pad + 2}" y="${r.y + r.h / 2 + fontSize * 0.35}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${opts.color ?? '#1877f2'}">${escapeXml(labels[i])}</text>`)
    .join('\n');
  const svg = `<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">${svgRects}${svgTexts}</svg>`;
  await img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(outFile);
}

const [, , inFile, outFile, rowsJsonFile] = process.argv;
const spec = JSON.parse(fs.readFileSync(rowsJsonFile, 'utf8'));
relabelRows(inFile, outFile, spec.rows, spec.labels, spec.scale, spec.opts || {}).then(() => console.log('wrote', outFile));
