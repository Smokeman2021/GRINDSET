import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/Users/murak/Downloads/GRINDSET/content/adsmanager-map';
const out = 'C:/Users/murak/Downloads/GRINDSET/app-mvp/src/data/adsManagerTour.ts';

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const entries = files.map((f) => {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n').trim();
  const firstLine = raw.split('\n')[0];
  const title = firstLine.replace(/^#\s*Екран:\s*/, '').replace(/^#\s*/, '').trim();
  const body = raw.split('\n').slice(1).join('\n').trim();
  const id = f.replace(/^\d+-/, '').replace(/\.md$/, '');
  return { id, title, body };
});

const lines = [];
lines.push("// Автоматично зібрано зі content/adsmanager-map/*.md — node scripts/import-adsmanager-tour.mjs (перезапустити після правок мапи).");
lines.push("export type AdsManagerScreen = { id: string; title: string; body: string };");
lines.push("");
lines.push("export const ADS_MANAGER_TOUR: AdsManagerScreen[] = [");
for (const e of entries) {
  lines.push(`  { id: ${JSON.stringify(e.id)}, title: ${JSON.stringify(e.title)}, body: ${JSON.stringify(e.body)} },`);
}
lines.push('];');

fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log('wrote', out, entries.length, 'screens');
