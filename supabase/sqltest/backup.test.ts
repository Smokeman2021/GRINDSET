// ТЗ 007, п. 2: резервна копія тим самим запитом, що виконає власник (report/007-backup-export.sql), і відновлення на ізольованій базі.
// Синтетичні дані тієї ж структури, що на продакшні (міграції 0001–0006 = знімок 18.11). Перевіряється: число рядків, md5,
// функції, права, політики, тригери, вхід і завантаження прогресу; SQL повного відкату повертає дані до копії.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb } from './harness.ts';
import type { Db, TestUser } from './harness.ts';
import { checksums, outsideRepo, parseBackup, rollbackSql, verifyBackup, type Backup } from './backup-restore.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_SQL = fs.readFileSync(path.join(here, '..', '..', 'report', '007-backup-export.sql'), 'utf8');
let db: Db;
let users: TestUser[] = [];
let backup: Backup;
let schemaA: unknown;

async function exportBackup(): Promise<Backup> {
  const res = (await db.admin.query(EXPORT_SQL)) as unknown as { rows: { backup?: string }[] }[];
  const last = res[res.length - 1];
  return JSON.parse(last.rows[0].backup!) as Backup;
}

before(async () => {
  db = await startDb({ upTo: 6 }); // стан продакшна на 18.11
  for (const n of ['alpha', 'beta', 'gamma']) users.push(await db.newUser(n));
  await db.admin.query("update public.allowed_users set is_admin = true, telegram_id = 1001 where id = $1", [users[0].id]);
  await db.admin.query("insert into public.allowed_users (username, status) values ('invited_only', 'invited')");
  for (const [i, u] of users.slice(0, 2).entries()) {
    await db.rpc(u, 'select public.save_progress($1::jsonb)', [JSON.stringify({ completed: ['l1', `l${i + 2}`], xp: 20 + i, coins: 40, totalCoinsEarned: 40, answersTotal: 10, answersCorrect: 7, playerName: `Гравець ${i}`, history: [{ id: 'l1', xp: 10, coins: 20, date: '2026-11-17' }] })]);
    await db.rpc(u, "insert into public.feedback (kind, body, screen, lesson_id, step_idx, build) values ('bug', $1, 'lesson', 'BR-TOV-L01', 2, 24)", [`відгук ${i} з "лапками" і комою, а також \\ скісною`]);
    await db.rpc(u, "insert into public.events (name, props, build) values ('lesson_complete', '{\"lesson\":\"l1\"}', 24)");
  }
  await db.admin.query("select public.throttle_hit('ip:127.0.0.1', 30, 600)");
  schemaA = JSON.parse((await db.admin.query(fs.readFileSync(path.join(here, 'schema-dump.sql'), 'utf8'))).rows[0].schema);
  backup = await exportBackup();
});
after(async () => {
  await db?.stop();
});

test('копія: усі шість таблиць продакшна з рядками, кількість і md5; формат CSV із SQL Editor читається так само', async () => {
  assert.equal(backup.format, 'grindset-backup-v1');
  assert.deepEqual(Object.keys(backup.tables).sort(), ['allowed_users', 'events', 'feedback', 'keepalive', 'login_throttle', 'progress']);
  assert.deepEqual(backup.counts, { allowed_users: 4, progress: 2, events: 2, feedback: 2, keepalive: 1, login_throttle: 1 });
  assert.deepEqual((await checksums(db.admin)).md5, backup.md5, 'той самий вираз сум у запиті й у перевірці');
  // CSV із SQL Editor: заголовок і одна клітинка в лапках
  const csv = `backup\n"${JSON.stringify(backup).replace(/"/g, '""')}"\n`;
  assert.deepEqual(parseBackup(csv), backup);
  assert.deepEqual(parseBackup(`[${JSON.stringify({ backup: JSON.stringify(backup) })}]`), backup, '«Copy as JSON»');
});

test('відновлення на ізольованій базі: рядки й суми збігаються; функції, права, політики, тригери — як у знімку; вхід і прогрес працюють', async () => {
  const r = await verifyBackup(backup, schemaA);
  for (const [t, x] of Object.entries(r.tables)) assert.deepEqual([t, x.countOk, x.md5Ok], [t, true, true]);
  assert.deepEqual(r.structure, []);
  assert.deepEqual(r.login, { checked: 3, ok: 3 });
  assert.equal(r.ok, true);
});

test('SQL повного відкату повертає дані продакшна до копії (після змін у вікні); пише лише поза репозиторієм', async () => {
  // «вікно»: нові відгуки, видалена учётка, змінений прогрес
  await db.rpc(users[2], "insert into public.feedback (kind, body, screen) values ('idea', 'після копії', 'home')");
  await db.admin.query("delete from public.allowed_users where username = 'invited_only'");
  await db.admin.query("update public.progress set state = state || '{\"xp\": 999}'::jsonb where user_id = $1", [users[0].id]);
  assert.notDeepEqual((await checksums(db.admin)).md5, backup.md5);
  await db.admin.query(rollbackSql(backup));
  const back = await checksums(db.admin);
  assert.deepEqual(back.md5, backup.md5);
  assert.deepEqual(back.counts, backup.counts);
  // після відкату нові відгуки отримують нові id (послідовність зсунуто), тригер автора знову працює
  await db.rpc(users[2], "insert into public.feedback (kind, body, screen) values ('idea', 'після відкату', 'home')");
  assert.equal(Number((await db.admin.query("select count(*) n from public.feedback where body = 'після відкату' and user_id = $1", [users[2].id])).rows[0].n), 1);
  // файли з даними — лише поза репозиторієм і папкою власника
  assert.equal(outsideRepo(path.join(os.homedir(), 'GRINDSET-backups', '2026-11-18', 'rollback.sql')), true);
  assert.equal(outsideRepo(path.join(here, 'rollback.sql')), false);
  assert.equal(outsideRepo(path.resolve(here, '..', '..', '..', 'GRINDSET', 'report', 'x.sql')), false);
});
