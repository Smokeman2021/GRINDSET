import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, type Db, type TestUser } from './harness.ts';

type Roster = { week_start: string; players: { name: string; points: number; is_me: boolean }[] };
let db: Db;
let viewer: TestUser;
let beginner: TestUser;
let owner: TestUser;
let service: TestUser;
let invited: TestUser;
let blocked: TestUser;
const list = (viewer: TestUser) => db.rpc<Roster>(viewer, 'select public.weekly_league_roster()');

before(async () => {
  db = await startDb();
  viewer = await db.newUser('learner');
  beginner = await db.newUser('beginner');
  owner = await db.newUser('owner');
  service = await db.newUser('preview_check');
  invited = await db.newUser('invited');
  blocked = await db.newUser('blocked');
  await db.admin.query("update public.allowed_users set display_name = 'Видиме ім’я' where id = $1", [beginner.id]);
  await db.admin.query('update public.allowed_users set is_admin = true where id = $1', [owner.id]);
  await db.admin.query('update public.allowed_users set is_service = true where id = $1', [service.id]);
  await db.admin.query("update public.allowed_users set status = 'invited' where id = $1", [invited.id]);
  await db.admin.query("update public.allowed_users set status = 'blocked' where id = $1", [blocked.id]);
});

after(async () => { await db?.stop(); });

test('roster includes active members without a progress row and returns only display name, points and self flag', async () => {
  const roster = await list(viewer);
  const expected = (await db.admin.query("select date_trunc('week', now() at time zone 'Europe/Kyiv')::date::text as start")).rows[0].start;
  assert.equal(roster.week_start, expected);
  assert.deepEqual(new Set(roster.players.map((row) => row.name)), new Set([viewer.username, 'Видиме ім’я', owner.username]));
  assert.deepEqual(roster.players.filter((row) => row.is_me), [{ name: viewer.username, points: 0, is_me: true }]);
  assert.ok(roster.players.every((row) => row.points === 0 && Object.keys(row).sort().join(',') === 'is_me,name,points'));
  assert.ok((await list(service)).players.every((row) => !row.is_me));
});

test('the roster rejects replaced and inactive sessions and denies guest execution', async () => {
  for (const user of [invited, blocked, { ...viewer, sid: 'stale' }]) {
    await assert.rejects(list(user), /session_replaced/);
  }
  assert.equal((await db.admin.query("select has_function_privilege('anon', 'public.weekly_league_roster()', 'execute') as allowed")).rows[0].allowed, false);
});

test('the older accuracy endpoint returns only the caller’s own published fields', async () => {
  for (const user of [viewer, beginner]) {
    await db.rpc(user, 'select public.save_progress($1::jsonb)', [JSON.stringify({ answersCorrect: 15, answersTotal: 20 })]);
  }
  const rows = await db.rpc(viewer, 'select jsonb_agg(row_to_json(t)) from public.leaderboard_accuracy() t');
  assert.deepEqual(rows, [{ name: viewer.username, accuracy: 75, answers: 20, is_me: true }]);
});

test('a complete roster is not capped at the older accuracy board limit', async () => {
  await db.admin.query("insert into public.allowed_users (username, status) select 'extra_' || n, 'active' from generate_series(1, 110) n");
  assert.equal((await list(viewer)).players.length, 113);
});
