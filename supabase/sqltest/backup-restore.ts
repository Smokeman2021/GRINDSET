// Перевірка резервної копії на ІЗОЛЬОВАНІЙ локальній базі (ТЗ 007, п. 2). Даних не друкує: лише числа рядків, збіг сум і так / ні.
//   node --no-warnings supabase/sqltest/backup-restore.ts <backup.csv|backup.json> [--schema <prod-schema.json>] [--emit-rollback <шлях.sql>]
// Копія — результат report/007-backup-export.sql (CSV із SQL Editor або JSON). Що робить:
//   1) піднімає порожню локальну базу з міграціями тієї ж версії, що на продакшні (0001–0006; якщо в копії є журнал / помітки — до 0007 / 0008);
//   2) відновлює всі рядки (тригери автора на час відновлення вимкнено, ідентифікатори зберігаються);
//   3) звіряє число рядків і md5 з копією; функції, права, політики й тригери — зі знімком prod-schema.json (якщо передано);
//   4) проходить вхід і завантаження прогресу кожною активною учёткою (сеанс з копії) — як застосунок.
// --emit-rollback: SQL повного відкату даних продакшна до цієї копії (містить дані!) — лише в приватну папку поза репозиторієм.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { startDb } from './harness.ts';
import type { Db } from './harness.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASE_TABLES = ['allowed_users', 'progress', 'events', 'feedback', 'keepalive', 'login_throttle'] as const;
// порядок відновлення (зовнішні ключі): спершу учётки, далі залежні; необовʼязкові — лише якщо є в копії
const ORDER = ['allowed_users', 'progress', 'progress_ops', 'progress_settings', 'progress_mode_log', 'events', 'feedback', 'feedback_review', 'keepalive', 'login_throttle'];
const ORDER_KEY: Record<string, string> = { allowed_users: 'id', progress: 'user_id', events: 'id', feedback: 'id', keepalive: 'id', login_throttle: 'key' };

export type Backup = { format: string; exported_at: string; tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number>; md5: Record<string, string> };

// CSV із SQL Editor: заголовок «backup» і одна клітинка в лапках ("" усередині = ")
export function parseBackup(text: string): Backup {
  const t = text.replace(/^﻿/, '').trim();
  if (t.startsWith('{')) return JSON.parse(t) as Backup;
  if (t.startsWith('[')) return (JSON.parse(t) as { backup: string | Backup }[]).map((r) => (typeof r.backup === 'string' ? JSON.parse(r.backup) : r.backup))[0] as Backup;
  const nl = t.indexOf('\n');
  let cell = t.slice(nl + 1).trim();
  if (cell.startsWith('"') && cell.endsWith('"')) cell = cell.slice(1, -1).replace(/""/g, '"');
  return JSON.parse(cell) as Backup;
}

// md5 і кількість за тим самим виразом, що й у report/007-backup-export.sql (UTC: однаковий текст часу)
export async function checksums(c: pg.Client): Promise<{ counts: Record<string, number>; md5: Record<string, string> }> {
  await c.query("set timezone to 'UTC'");
  const counts: Record<string, number> = {};
  const md5: Record<string, string> = {};
  for (const t of BASE_TABLES) {
    const k = ORDER_KEY[t];
    const r = (await c.query(`select count(*)::int n, md5(coalesce(string_agg(to_jsonb(x)::text, '' order by ${k}), '')) h from public.${t} x`)).rows[0];
    counts[t] = r.n;
    md5[t] = r.h;
  }
  return { counts, md5 };
}

// Відновлення рядків у базу зі схемою тієї ж версії
export async function restoreRows(c: pg.Client, b: Backup): Promise<void> {
  await c.query("set timezone to 'UTC'");
  await c.query('begin');
  try {
    // учётки посилаються на auth.users: у тій самій базі продакшна вони є; в ізольованій — створюємо ті самі id
    const authIds = (b.tables.allowed_users ?? []).map((u) => u.auth_user_id).filter((x): x is string => typeof x === 'string');
    if (authIds.length) await c.query('insert into auth.users (id) select unnest($1::uuid[]) on conflict do nothing', [authIds]);
    const present = ORDER.filter((t) => Array.isArray(b.tables[t]));
    for (const t of present) await c.query(`alter table public.${t} disable trigger user`);
    for (const t of [...present].reverse()) await c.query(`delete from public.${t}`);
    for (const t of present) {
      const rows = b.tables[t];
      if (!rows.length) continue;
      await c.query(`insert into public.${t} overriding system value select * from json_populate_recordset(null::public.${t}, $1::json)`, [JSON.stringify(rows)]);
    }
    for (const t of present) await c.query(`alter table public.${t} enable trigger user`);
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

// SQL повного відкату даних до копії (для продакшна, SQL Editor). Містить дані — лише в приватну папку поза репозиторієм.
export function rollbackSql(b: Backup): string {
  const present = ORDER.filter((t) => Array.isArray(b.tables[t]));
  // дані копії писали тестери (тексти відгуків): тег лапок не повинен траплятися в них, інакше текст закрив би лапки й став SQL
  const body = JSON.stringify(b.tables);
  let tag = '';
  do tag = 'grindset_backup_' + crypto.randomUUID().replace(/-/g, '');
  while (body.includes(tag));
  const lines = [
    `-- Повний відкат даних до копії від ${b.exported_at}. Таблиці: ${present.join(', ')}. Виконувати лише за рішенням власника.`,
    'begin;',
    "set local timezone to 'UTC';",
    ...present.map((t) => `alter table public.${t} disable trigger user;`),
    ...[...present].reverse().map((t) => `delete from public.${t};`),
    ...present.filter((t) => b.tables[t].length).map((t) => `insert into public.${t} overriding system value select * from json_populate_recordset(null::public.${t}, $${tag}$${JSON.stringify(b.tables[t])}$${tag}$::json);`),
    ...present.map((t) => `alter table public.${t} enable trigger user;`),
    ...present.filter((t) => ['events', 'feedback', 'progress_mode_log'].includes(t)).map((t) => `select setval(pg_get_serial_sequence('public.${t}', 'id'), coalesce((select max(id) from public.${t}), 0) + 1, false);`),
    'commit;',
  ];
  return lines.join('\n') + '\n';
}

// Вхід і завантаження прогресу кожною активною учёткою з сеансом (так, як робить застосунок через PostgREST)
export async function loginCheck(db: Db, b: Backup): Promise<{ checked: number; ok: number }> {
  const users = (b.tables.allowed_users ?? []).filter((u) => u.auth_user_id && u.active_sid && u.status !== 'blocked');
  const withProgress = new Set((b.tables.progress ?? []).map((p) => p.user_id));
  const c = await db.connect();
  let ok = 0;
  for (const u of users) {
    await db.begin({ id: String(u.id), authId: String(u.auth_user_id), sid: String(u.active_sid), username: String(u.username) }, c);
    try {
      const me = (await c.query('select public.session_me() r')).rows[0].r as { session_ok: boolean; id: string };
      const lp = (await c.query('select public.load_progress() r')).rows[0].r as { state: unknown } | null;
      if (me?.session_ok && me.id === u.id && (lp !== null) === withProgress.has(u.id)) ok++;
    } finally {
      await c.query('rollback');
    }
  }
  return { checked: users.length, ok };
}

// Структура відновленої бази проти знімка: функції (без коментарів) і їхні права, політики, тригери, права таблиць
export function structureDiff(prod: any, local: any): string[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: string[] = [];
  const nc = (d: string) => String(d ?? '').replace(/--[^\r\n]*/g, '').replace(/\s+/g, '');
  const acl = (a: string | null) => String(a ?? '').replace(/[{}]/g, '').split(',').sort().join(',');
  const m = (rows: any[] | null, key: (r: any) => string, val: (r: any) => string) => new Map((rows ?? []).map((r) => [key(r), val(r)])); // eslint-disable-line @typescript-eslint/no-explicit-any
  const cmp = (label: string, a: Map<string, string>, b: Map<string, string>) => {
    for (const [k, v] of a) if (b.get(k) !== v) out.push(`${label}: ${k}`);
    for (const k of b.keys()) if (!a.has(k)) out.push(`${label} (зайве): ${k}`);
  };
  cmp('функція', m(prod.functions, (f) => `${f.name}(${f.args})`, (f) => nc(f.def)), m(local.functions, (f) => `${f.name}(${f.args})`, (f) => nc(f.def)));
  cmp('права функції', m(prod.functions, (f) => `${f.name}(${f.args})`, (f) => acl(f.acl)), m(local.functions, (f) => `${f.name}(${f.args})`, (f) => acl(f.acl)));
  cmp('політика', m(prod.policies, (p) => `${p.table}.${p.name}`, (p) => JSON.stringify(p)), m(local.policies, (p) => `${p.table}.${p.name}`, (p) => JSON.stringify(p)));
  cmp('тригер', m(prod.triggers, (t) => `${t.table}.${t.name}`, (t) => nc(t.def)), m(local.triggers, (t) => `${t.table}.${t.name}`, (t) => nc(t.def)));
  const g = (s: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = new Map<string, string[]>();
    for (const x of s.table_grants ?? []) r.set(`${x.table}→${x.grantee}`, [...(r.get(`${x.table}→${x.grantee}`) ?? []), x.priv]);
    return new Map([...r].map(([k, v]) => [k, v.sort().join(',')]));
  };
  cmp('права таблиці', g(prod), g(local));
  return out;
}

export type VerifyReport = { tables: Record<string, { rows: number; countOk: boolean; md5Ok: boolean }>; structure: string[] | null; login: { checked: number; ok: number }; ok: boolean };

export async function verifyBackup(b: Backup, schema?: unknown): Promise<VerifyReport> {
  if (b.format !== 'grindset-backup-v1') throw new Error('не той формат копії');
  const upTo = b.tables.feedback_review ? 8 : b.tables.progress_ops ? 7 : 6;
  const db = await startDb({ upTo });
  try {
    await restoreRows(db.admin, b);
    const got = await checksums(db.admin);
    const tables: VerifyReport['tables'] = {};
    for (const t of BASE_TABLES) tables[t] = { rows: got.counts[t], countOk: got.counts[t] === Number(b.counts[t]), md5Ok: got.md5[t] === b.md5[t] };
    let structure: string[] | null = null;
    if (schema) {
      const local = JSON.parse((await db.admin.query(fs.readFileSync(path.join(here, 'schema-dump.sql'), 'utf8'))).rows[0].schema);
      structure = structureDiff(schema, local);
    }
    const login = await loginCheck(db, b);
    const ok = Object.values(tables).every((x) => x.countOk && x.md5Ok) && (structure === null || structure.length === 0) && login.ok === login.checked;
    return { tables, structure, login, ok };
  } finally {
    await db.stop();
  }
}

// Шлях для файлів із даними — лише поза робочими папками репозиторію
export function outsideRepo(p: string): boolean {
  const abs = path.resolve(p).toLowerCase();
  const repo = path.resolve(here, '..', '..').toLowerCase();
  const owner = path.resolve(repo, '..', 'GRINDSET').toLowerCase();
  return !abs.startsWith(repo + path.sep) && !abs.startsWith(owner + path.sep);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args[0];
  if (!file) {
    console.error('використання: backup-restore.ts <backup.csv|json> [--schema prod-schema.json] [--emit-rollback шлях.sql]');
    process.exit(1);
  }
  const b = parseBackup(fs.readFileSync(file, 'utf8'));
  const si = args.indexOf('--schema');
  const schema = si > 0 ? JSON.parse(fs.readFileSync(args[si + 1], 'utf8')) : undefined;
  const r = await verifyBackup(b, schema);
  console.log(`копія від ${b.exported_at}`);
  for (const [t, x] of Object.entries(r.tables)) console.log(`${t.padEnd(16)} рядків ${String(x.rows).padStart(5)}  кількість ${x.countOk ? 'збігається' : 'НЕ збігається'}  md5 ${x.md5Ok ? 'збігається' : 'НЕ збігається'}`);
  console.log(r.structure === null ? 'структура: знімок не передано (--schema)' : r.structure.length ? `структура: розбіжності\n  ${r.structure.join('\n  ')}` : 'структура: функції, права, політики й тригери збігаються зі знімком');
  console.log(`вхід і завантаження прогресу: ${r.login.ok} з ${r.login.checked} учёток`);
  const ei = args.indexOf('--emit-rollback');
  if (ei > 0) {
    const out = args[ei + 1];
    if (!out || !outsideRepo(out)) {
      console.error('файл відкату містить дані: вкажіть шлях ПОЗА репозиторієм і папкою GRINDSET');
      process.exit(1);
    }
    fs.writeFileSync(out, rollbackSql(b));
    console.log(`SQL відкату записано: ${out}`);
  }
  console.log(r.ok ? 'КОПІЯ ПРИДАТНА: відновлення перевірено' : 'КОПІЯ НЕ ПРОЙШЛА ПЕРЕВІРКУ');
  process.exitCode = r.ok ? 0 : 2;
}
