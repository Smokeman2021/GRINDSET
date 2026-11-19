// Автотест витоку після збірки (ТЗ 004, B3). Перевіряє ЗІБРАНИЙ веб-бандл:
//   1) немає внутрішніх рядків (реєстри, приватні дослідження, форуми);
//   2) у публічній збірці (EXPO_PUBLIC_INCLUDE_RESTRICTED=false) немає текстів 29 позначених одиниць (content/restricted.json) і ризикових карток/термінів;
//   3) розбори кейсів і еталони вправ є в бандлі лише як дані (екран показує їх після спроби — перевіряється в браузері).
// Запуск: KB_BUNDLE_DIR=<dist> [KB_BUNDLE_PUBLIC=1] node --test supabase/tests/kb-leak.test.ts
// Без KB_BUNDLE_DIR тест пропускається (звичайний npm run test:cloud не збирає застосунок).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = process.env.KB_BUNDLE_DIR;
const PUBLIC = process.env.KB_BUNDLE_PUBLIC === '1';

function bundleText(dir: string): string {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html|json)$/.test(e.name)) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  // бандл зберігає не-ASCII як \uXXXX, а переноси як \n: розкодовуємо, щоб шукати звичайний текст
  return out
    .join('\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"');
}

// Тексти позначених фрагментів (поля, довші за 40 символів) з повних даних модулів
function restrictedTexts(): string[] {
  const gen = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated');
  const texts = new Set<string>();
  for (const f of fs.readdirSync(gen).filter((x) => /^m\d\d\.json$/.test(x))) {
    const walk = (o: unknown, inRestricted: boolean) => {
      if (Array.isArray(o)) o.forEach((x) => walk(x, inRestricted));
      else if (o && typeof o === 'object') {
        const r = inRestricted || (o as { restricted?: boolean }).restricted === true;
        for (const [k, v] of Object.entries(o)) {
          if (r && typeof v === 'string' && v.length > 40 && k !== 'id') texts.add(v.slice(0, 60));
          walk(v, r);
        }
      }
    };
    walk(JSON.parse(fs.readFileSync(path.join(gen, f), 'utf8')), false);
  }
  return [...texts];
}

test('витік: внутрішніх рядків у зібраному бандлі немає', { skip: !DIR }, () => {
  const b = bundleText(DIR!).toLowerCase();
  for (const s of ['fb-killa', 'research-private', 'внутрішній реєстр', 'редакторський реєстр', 'джерела для редактора', 'ftvclub', 'kb-source']) assert.ok(!b.includes(s.toLowerCase()), s);
});

test('витік: у публічній збірці немає текстів позначених одиниць і ризикових карток', { skip: !DIR || !PUBLIC }, () => {
  const b = bundleText(DIR!);
  const texts = restrictedTexts();
  assert.ok(texts.length > 50, `мало зразків: ${texts.length}`);
  const leaked = texts.filter((t) => b.includes(JSON.stringify(t).slice(1, -1)) || b.includes(t));
  assert.deepEqual(leaked.slice(0, 5), [], `у публічному бандлі ${leaked.length} позначених текстів`);
  const restrictedLib = fs.readFileSync(path.join(ROOT, 'app-mvp', 'src', 'data', 'library.restricted.ts'), 'utf8');
  const names = [...restrictedLib.matchAll(/name: '([^']{4,})'/g)].map((m) => m[1]);
  assert.ok(names.length > 5);
  for (const n of names) assert.ok(!b.includes(`"${n}"`) && !b.includes(`'${n}'`), `ризикова картка ${n} у публічному бандлі`);
});

// C1.0: старий курс (модулі 01–10) прибрано з інтерфейсу й не імпортується в бандл; гілки — є.
// (Колишня перевірка «у повній збірці позначені тексти є» зняла сенс: позначені тексти жили в старому курсі,
// тепер їх немає в жодній збірці; що тест бачить бандл, підтверджують рядки гілок нижче.)
test('старого курсу в зібраному бандлі немає, гілки вертикалей є', { skip: !DIR }, () => {
  const b = bundleText(DIR!);
  const lessonsSrc = fs.readFileSync(path.join(ROOT, 'app-mvp', 'src', 'data', 'lessons.ts'), 'utf8');
  const oldTitles = [...lessonsSrc.matchAll(/title: '([^']{12,})'/g)].map((m) => m[1]).slice(0, 15);
  assert.ok(oldTitles.length >= 10);
  const gen = path.join(ROOT, 'app-mvp', 'src', 'data', 'generated');
  for (const f of fs.readdirSync(gen).filter((x) => /^m\d\d\.json$/.test(x))) oldTitles.push(...JSON.parse(fs.readFileSync(path.join(gen, f), 'utf8')).lessons.slice(0, 2).map((l: { title: string }) => l.title).filter((t: string) => t.length >= 12));
  const leaked = oldTitles.filter((t) => b.includes(`'${t}'`) || b.includes(`"${t}"`));
  assert.deepEqual(leaked, []);
  for (const s of ['Академія', 'Практика: втрати по етапах CRM', 'BR-ADT-PR', 'BR-TOV-A1-L09']) assert.ok(b.includes(s), s);
});
