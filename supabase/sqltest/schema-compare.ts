// Звірка структури: локальна база після міграцій 0001–N проти знімка продакшна (schema-dump.sql, виконаний власником у SQL Editor).
// Запуск: node --no-warnings schema-compare.ts [шлях до prod-schema.json] [N = 6]
// Без файла продакшна лише друкує локальний знімок у schema-local-<N>.json (перевірка, що запит працює).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb } from './harness.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const prodFile = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null;
const upTo = Number(process.argv[3] ?? 6);

type Snap = {
  pg_version: string;
  tables: Record<string, { rls: boolean; columns: { name: string; type: string; notnull: boolean; default: string | null }[] }>;
  constraints: { table: string; name: string; def: string }[] | null;
  indexes: string[] | null;
  policies: { table: string; name: string }[] | null;
  triggers: { table: string; name: string; def: string }[] | null;
  functions: { name: string; args: string; def: string; acl: string | null }[] | null;
  table_grants: { table: string; grantee: string; priv: string }[] | null;
};

// пробіли й регістр службових слів у визначеннях різняться між версіями Postgres: порівнюємо нормалізований текст
const norm = (s: unknown) => JSON.stringify(s ?? null).replace(/\\r/g, '').replace(/\s+/g, ' ').trim();
const keyed = <T>(rows: T[] | null, key: (r: T) => string) => new Map((rows ?? []).map((r) => [key(r), norm(r)]));

function diff(label: string, prod: Map<string, string>, local: Map<string, string>, out: string[]) {
  for (const [k, v] of prod) {
    if (!local.has(k)) out.push(`${label}: є в продакшні, немає локально → ${k}`);
    else if (local.get(k) !== v) out.push(`${label}: відрізняється → ${k}`);
  }
  for (const k of local.keys()) if (!prod.has(k)) out.push(`${label}: є локально, немає в продакшні → ${k}`);
}

const db = await startDb({ upTo });
try {
  const sql = fs.readFileSync(path.join(here, 'schema-dump.sql'), 'utf8');
  const local = JSON.parse((await db.admin.query(sql)).rows[0].schema) as Snap;
  const outFile = path.join(here, `schema-local-${String(upTo).padStart(4, '0')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(local, null, 2) + '\n');
  console.log(`локальний знімок (міграції до ${upTo}): таблиць ${Object.keys(local.tables).length}, функцій ${(local.functions ?? []).length}, політик ${(local.policies ?? []).length}, тригерів ${(local.triggers ?? []).length} → ${path.basename(outFile)}`);
  if (!prodFile) {
    console.log('знімка продакшна немає: порівняння пропущено');
  } else {
    const prod = JSON.parse(fs.readFileSync(prodFile, 'utf8')) as Snap;
    const out: string[] = [];
    const cols = (s: Snap) => new Map(Object.entries(s.tables).flatMap(([t, v]) => [[`${t} (rls)`, String(v.rls)] as [string, string], ...v.columns.map((c) => [`${t}.${c.name}`, norm(c)] as [string, string])]));
    diff('колонка', cols(prod), cols(local), out);
    diff('обмеження', keyed(prod.constraints, (r) => `${r.table}.${r.name}`), keyed(local.constraints, (r) => `${r.table}.${r.name}`), out);
    diff('політика', keyed(prod.policies, (r) => `${r.table}.${r.name}`), keyed(local.policies, (r) => `${r.table}.${r.name}`), out);
    diff('тригер', keyed(prod.triggers, (r) => `${r.table}.${r.name}`), keyed(local.triggers, (r) => `${r.table}.${r.name}`), out);
    // права на функції (acl) у Supabase мають власних власників ролей: порівнюємо лише тіло й підпис
    const fn = (s: Snap) => new Map((s.functions ?? []).map((f) => [`${f.name}(${f.args})`, norm(f.def)] as [string, string]));
    diff('функція', fn(prod), fn(local), out);
    console.log(`Postgres: продакшн ${prod.pg_version}, локально ${local.pg_version}`);
    console.log(out.length ? out.join('\n') : 'структура збігається');
    process.exitCode = out.length ? 2 : 0;
  }
} finally {
  await db.stop();
}
