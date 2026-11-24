// Точкові правки жаргону після машинного перекладу (DeepL без глосарія): арбітраж/зв'язка.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'app-mvp', 'src', 'data', 'generated');
const RULES = [
  [/Arbitrators/g, 'Media buyers'],
  [/arbitrators/g, 'media buyers'],
  [/Arbitrator/g, 'Media buyer'],
  [/arbitrator/g, 'media buyer'],
  [/Arbitration/g, 'Arbitrage'],
  [/arbitration/g, 'arbitrage'],
  [/The Team — The Heart of Arbitrage/g, 'The Bundle — The Heart of Arbitrage'],
  [/Five Elements of a Relationship/g, 'Five Elements of a Bundle'],
  [/Where the ligament tears/g, 'Where the bundle breaks'],
  [/ligament/g, 'bundle'],
];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.en.json'))) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, 'utf8');
  for (const [re, to] of RULES) s = s.replace(re, to);
  JSON.parse(s);
  fs.writeFileSync(p, s);
  console.log('ok', f);
}
