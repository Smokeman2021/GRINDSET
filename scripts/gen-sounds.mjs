// Синтез ігрових звуків: низькі, плавні, технологічні, з легким святковим відтінком («відчуття виграшу»).
// Запуск: node scripts/gen-sounds.mjs   → пише WAV у app-mvp/assets/sounds/ (44.1 кГц, mono, 16 біт).
// Параметри (висота, довжина, тембр) змінюються тут, потім скрипт запускається знову. Усі звуки вирівнюються за гучністю (RMS).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app-mvp', 'assets', 'sounds');
const TARGET_RMS = 0.11; // однакова відчутна гучність усіх ефектів
const PEAK_LIMIT = 0.6;

// Нота: тепла синусоїда + м'які гармоніки + підсилення «баса» + легка FM-блискітка (технологічний відтінок)
function note(buf, start, freq, dur, { gain = 1, attack = 0.014, decay = 4.5, shimmer = 0.5, glide = 0.03, sub = 0.35 } = {}) {
  const n = Math.floor(dur * SR);
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t) * Math.min(1, (dur - t) / 0.04);
    const f = freq * (1 + glide * Math.exp(-t * 40)); // короткий підйом висоти на старті, як «увімкнення»
    const ph = 2 * Math.PI * f * t;
    const fm = shimmer * Math.exp(-t * 14) * Math.sin(2 * Math.PI * f * 2 * t);
    const v =
      Math.sin(ph + fm) +
      0.22 * Math.sin(2 * ph) +
      0.07 * Math.sin(3 * ph) +
      sub * Math.sin(ph / 2);
    buf[s0 + i] += v * env * gain;
  }
}

// Шипіння-«свіш» з нижніх частот (фільтрований шум), для відчуття відкривання
function swoosh(buf, start, dur, f0, f1, gain = 0.2) {
  const n = Math.floor(dur * SR);
  const s0 = Math.floor(start * SR);
  let lp = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / n;
    const cutoff = f0 + (f1 - f0) * t;
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    lp += a * (Math.random() * 2 - 1 - lp);
    const env = Math.sin(Math.PI * t) ** 2;
    buf[s0 + i] += lp * env * gain * 3;
  }
}

// Низькочастотний фільтр + проста «кімната» (розріджене відлуння), щоб звук був м'яким і не різав вухо
function finish(buf, { cutoff = 2400, wet = 0.22 } = {}) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
  for (const [ms, g] of [[61, 0.55], [97, 0.4], [149, 0.28]]) {
    const d = Math.floor((ms / 1000) * SR);
    for (let i = buf.length - 1; i >= d; i--) buf[i] += buf[i - d] * g * wet;
  }
  // нормалізація за RMS із обмеженням піка
  let sum = 0;
  for (const v of buf) sum += v * v;
  const rms = Math.sqrt(sum / buf.length) || 1;
  let k = TARGET_RMS / rms;
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  k = Math.min(k, PEAK_LIMIT / (peak || 1));
  // плавні краї без клацань
  const fade = Math.floor(0.012 * SR);
  for (let i = 0; i < buf.length; i++) {
    let m = 1;
    if (i < fade) m = i / fade;
    if (buf.length - i < fade * 4) m = Math.min(m, (buf.length - i) / (fade * 4));
    buf[i] *= k * m;
  }
}

function writeWav(name, buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([h, data]));
  console.log(name, (buf.length / SR).toFixed(2) + ' с');
}

const mk = (sec) => new Float32Array(Math.floor(sec * SR));
const F = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25 };

// правильна відповідь: дві м'які ноти вгору (G3 → D4)
{
  const b = mk(0.55);
  note(b, 0, F.G3, 0.3, { decay: 6, gain: 0.8 });
  note(b, 0.1, F.D4, 0.4, { decay: 5.5 });
  finish(b);
  writeWav('correct.wav', b);
}
// хибна відповідь: низький м'який спуск, без різкості
{
  const b = mk(0.5);
  note(b, 0, F.A2 * 1.5, 0.3, { decay: 7, shimmer: 0.1, glide: -0.02 });
  note(b, 0.12, F.A2, 0.38, { decay: 6, shimmer: 0.1, glide: -0.02 });
  finish(b, { cutoff: 1500, wet: 0.12 });
  writeWav('wrong.wav', b);
}
// урок пройдено: тихе технологічне «включення» і арпеджіо C3-E3-G3-C4 з теплим акордом
{
  const b = mk(1.5);
  swoosh(b, 0, 0.3, 200, 900, 0.1);
  note(b, 0.1, F.C3, 0.5, { decay: 3.2 });
  note(b, 0.22, F.E3, 0.5, { decay: 3.2 });
  note(b, 0.34, F.G3, 0.55, { decay: 3.0 });
  note(b, 0.46, F.C4, 0.95, { decay: 2.4, gain: 0.9 });
  note(b, 0.46, F.E4, 0.9, { decay: 3.0, gain: 0.35, sub: 0 });
  finish(b);
  writeWav('lesson.wav', b);
}
// скриня золота (кінець модуля, головна нагорода): довший підйом, глибокий акорд, легка «іскра» зверху
{
  const b = mk(2.3);
  swoosh(b, 0, 0.55, 160, 1300, 0.14);
  note(b, 0.2, F.C3, 0.7, { decay: 2.4 });
  note(b, 0.34, F.G3, 0.7, { decay: 2.4 });
  note(b, 0.48, F.C4, 0.8, { decay: 2.2 });
  note(b, 0.62, F.E4, 0.9, { decay: 2.2, gain: 0.8 });
  note(b, 0.78, F.G4, 1.4, { decay: 1.9, gain: 0.85 });
  note(b, 0.78, F.C3, 1.5, { decay: 1.6, gain: 0.7 });
  note(b, 0.78, F.E3, 1.5, { decay: 1.8, gain: 0.45, sub: 0 });
  note(b, 1.0, F.C5, 0.9, { decay: 4.2, gain: 0.16, shimmer: 0.8, sub: 0 }); // легка святкова іскра
  finish(b, { wet: 0.3 });
  writeWav('chest.wav', b);
}
// новий рівень: коротша й рівніша версія нагороди
{
  const b = mk(1.6);
  swoosh(b, 0, 0.3, 160, 1000, 0.1);
  note(b, 0.12, F.D3, 0.5, { decay: 3 });
  note(b, 0.26, F.A3, 0.5, { decay: 3 });
  note(b, 0.4, F.D4, 0.5, { decay: 2.8 });
  note(b, 0.54, F.A4, 0.95, { decay: 2.3, gain: 0.7 });
  note(b, 0.54, F.D3, 1.0, { decay: 2, gain: 0.6 });
  finish(b, { wet: 0.28 });
  writeWav('levelup.wav', b);
}
// покупка в магазині: «розблокування» (низька нота + м'яка пара вгору й тепле завершення)
{
  const b = mk(0.95);
  note(b, 0, F.G3, 0.35, { decay: 5, gain: 0.9, shimmer: 0.8 });
  swoosh(b, 0.02, 0.22, 300, 1100, 0.07);
  note(b, 0.12, F.D4, 0.5, { decay: 3.6, shimmer: 0.7 });
  note(b, 0.26, F.G4, 0.65, { decay: 3.2, gain: 0.75, shimmer: 0.6 });
  note(b, 0.26, F.G3, 0.65, { decay: 3, gain: 0.5, sub: 0 });
  finish(b, { wet: 0.25 });
  writeWav('purchase.wav', b);
}
// монети (нагорода за завдання, підрахунок коїнів): коротка м'яка пара
{
  const b = mk(0.5);
  note(b, 0, F.D4, 0.25, { decay: 7, shimmer: 0.6 });
  note(b, 0.08, F.A4, 0.4, { decay: 5.5, shimmer: 0.6, gain: 0.8 });
  finish(b, { cutoff: 2800 });
  writeWav('coin.wav', b);
}
// стрік: три теплі ноти вгору
{
  const b = mk(0.9);
  note(b, 0, F.E3, 0.35, { decay: 4.5 });
  note(b, 0.13, F.G3, 0.35, { decay: 4.5 });
  note(b, 0.26, F.B3, 0.6, { decay: 3.2, gain: 0.9 });
  finish(b);
  writeWav('streak.wav', b);
}
// дотик по кнопці: дуже тихий низький «тик»
{
  const b = mk(0.1);
  note(b, 0, 190, 0.08, { decay: 40, attack: 0.004, shimmer: 0, glide: 0.05, sub: 0 });
  finish(b, { cutoff: 1800, wet: 0 });
  for (let i = 0; i < b.length; i++) b[i] *= 0.7;
  writeWav('tap.wav', b);
}
