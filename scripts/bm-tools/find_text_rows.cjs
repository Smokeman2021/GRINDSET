// Знаходить точні y-межі кожного рядка кольорового тексту (напр. синього посилання) у
// стовпці x0..x1, скануючи пікселі напряму — без залежності від DOM-таймінгу.
// Метод "не сірий піксель" (r/g/b помітно розходяться) замість пошуку конкретного кольору:
// JPEG-стиснення зсуває колір, тому точний match на "Meta link blue" повертає порожньо.
const sharp = require('sharp');

async function findRows(file, x0, x1, opts = {}) {
  const notGrayTol = opts.notGrayTol ?? 15;
  const img = sharp(file);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const isMatch = (x, y) => {
    const i = (y * info.width + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.abs(r - g) > notGrayTol || Math.abs(g - b) > notGrayTol || Math.abs(r - b) > notGrayTol;
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
