// Знаходить точні y-межі кожного рядка синього тексту (посилання) у стовпці x0..x1,
// скануючи пікселі напряму — без залежності від DOM-таймінгу.
const sharp = require('sharp');

async function findRows(file, x0, x1, opts = {}) {
  const tol = opts.tol ?? 40;
  const target = opts.color ?? [24, 119, 242]; // Meta link blue
  const img = sharp(file);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const isMatch = (x, y) => {
    const i = (y * info.width + x) * ch;
    const dr = data[i] - target[0], dg = data[i + 1] - target[1], db = data[i + 2] - target[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) < tol;
  };
  const rowHas = new Array(info.height).fill(false);
  for (let y = 0; y < info.height; y++) {
    for (let x = x0; x < x1; x += 1) {
      if (isMatch(x, y)) { rowHas[y] = true; break; }
    }
  }
  const bands = [];
  let start = -1;
  for (let y = 0; y < info.height; y++) {
    if (rowHas[y] && start === -1) start = y;
    if (!rowHas[y] && start !== -1) { bands.push([start, y - 1]); start = -1; }
  }
  if (start !== -1) bands.push([start, info.height - 1]);
  return bands;
}

const [, , file, x0, x1] = process.argv;
findRows(file, Number(x0), Number(x1)).then((b) => console.log(JSON.stringify(b)));
