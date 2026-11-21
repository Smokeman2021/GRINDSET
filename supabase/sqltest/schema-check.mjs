// Перевірка знімка структури продакшна перед порівнянням: це має бути лише схема, без рядків даних і без секретів.
// Запуск: node schema-check.mjs <шлях до research/prod-schema.json>. Код виходу 0 = чисто, 2 = знайдено підозріле.
import fs from 'node:fs';

const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const findings = [];
const patterns = [
  ['JWT (eyJ…)', /eyJ[A-Za-z0-9_-]{8,}/],
  ['sb_secret', /sb_secret/i],
  ['sb_publishable', /sb_publishable/i],
  ['service_role ключ', /service_role[^"\n]{0,20}(key|ключ)|"service_role_key"/i],
  ['token', /\btoken\b\s*[:=]\s*["']?[A-Za-z0-9:_-]{16,}/i],
  ['Telegram bot token', /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/],
  ['password', /password\s*[:=]\s*["'][^"']+["']/i],
  ['хеш коду запрошення', /\b[0-9a-f]{64}\b/],
  ['код запрошення', /\b[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}\b/],
  ['електронна пошта', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
];
for (const [name, re] of patterns) {
  const m = raw.match(re);
  if (m) findings.push(`${name}: «${m[0].slice(0, 12)}…»`);
}
let j;
try {
  j = JSON.parse(raw);
  if (typeof j === 'string') j = JSON.parse(j);
} catch (e) {
  findings.push(`не JSON: ${e.message}`);
}
if (j) {
  const allowed = new Set(['pg_version', 'tables', 'constraints', 'indexes', 'policies', 'triggers', 'functions', 'table_grants']);
  const extra = Object.keys(j).filter((k) => !allowed.has(k));
  if (extra.length) findings.push(`зайві розділи (можливо, дані): ${extra.join(', ')}`);
  for (const [t, v] of Object.entries(j.tables ?? {})) {
    const keys = Object.keys(v);
    if (keys.some((k) => !['rls', 'columns'].includes(k))) findings.push(`таблиця ${t} має не лише структуру: ${keys.join(', ')}`);
  }
}
console.log(`розмір ${raw.length} байт; таблиць ${Object.keys(j?.tables ?? {}).length}, функцій ${(j?.functions ?? []).length}`);
console.log(findings.length ? `ПІДОЗРІЛЕ:\n- ${findings.join('\n- ')}` : 'рядків даних і ознак секретів не знайдено');
process.exitCode = findings.length ? 2 : 0;
