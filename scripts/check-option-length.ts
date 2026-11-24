// Правило довжини варіантів (ТЗ 006, 5.2; REVIEW-CONTENT-b26 §6): правильний варіант ≤ 1,2 × найдовшого з інших.
// Допоміжна перевірка: показує всі вибори гілок, вправ «Бази» й «Лідів», що її порушують, і задокументовані винятки.
//   node --no-warnings scripts/check-option-length.ts          — список порушень
//   node --no-warnings scripts/check-option-length.ts --all    — усі вибори з коефіцієнтом
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectChoices, ratioOf, LENGTH_RATIO } from '../app-mvp/src/data/optionLength.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'kb-exercises.json'), 'utf8'));
const all = collectChoices(ex);
const bad = all.filter((c) => !c.exception && ratioOf(c) > LENGTH_RATIO);
const show = process.argv.includes('--all') ? all : bad;
for (const c of show) console.log(`${ratioOf(c).toFixed(2)}\t${c.where}\t${c.q.slice(0, 70)}${c.exception ? `\t[виняток: ${c.exception}]` : ''}`);
console.log(`\nУсього виборів: ${all.length}; порушень: ${bad.length}; винятків: ${all.filter((c) => c.exception).length}`);
process.exitCode = bad.length ? 1 : 0;
