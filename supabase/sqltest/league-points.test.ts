import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { HANDBOOK } from '../../app-mvp/src/data/academy/handbookCourses.ts';
import { startDb, type Db, type TestUser } from './harness.ts';

type Roster = { week_start: string; players: { name: string; points: number; is_me: boolean }[] };
type Operation = { opId: string; kind: string; lessonId: string; xp: number; coins: number; at?: number; epoch?: number; repeatable?: boolean };

let db: Db;
let alice: TestUser;
const lessons = HANDBOOK.flatMap((branch) => branch.lessons.filter((u) => u.ready).map((u) => u.id)).sort();

before(async () => {
  db = await startDb({ upTo: 13 });
  await db.admin.query("select public.set_progress_write_mode('v2')");
  alice = await db.newUser('scoring');
});
after(async () => { await db?.stop(); });

const submit = async (user: TestUser, operations: Operation[], epoch = 0) => {
  const { rev } = await db.rpc<{ rev: number }>(user, 'select public.load_progress_v2()');
  const result = await db.rpc<{ status: string; ops: { status: string }[] }>(user,
    'select public.save_progress_v2($1::bigint, $2::jsonb, null, $3::integer)', [rev, JSON.stringify(operations), epoch]);
  assert.equal(result.status, 'ok');
  return result.ops.map(({ status }) => status);
};
const op = (id: string, lessonId: string, extra: Partial<Operation> = {}): Operation =>
  ({ opId: id, kind: 'lesson', lessonId, xp: 9999, coins: 25, epoch: 0, ...extra });

const roster = (user: TestUser) => db.rpc<Roster>(user, 'select public.weekly_league_roster()');
const myPoints = async (user: TestUser) => (await roster(user)).players.find(({ is_me }) => is_me)?.points;

async function verify(user: TestUser, operationId: string, epoch = 0) {
  const conn = await db.connect();
  await conn.query('begin');
  try {
    await conn.query('set local role service_role');
    const result = await conn.query('select public.record_verified_league_lesson($1, $2, $3) as credited', [user.id, epoch, operationId]);
    await conn.query('commit');
    return result.rows[0].credited as boolean;
  } catch (error) {
    await conn.query('rollback');
    throw error;
  }
}

test('only playable b35 lessons are eligible, and the account and anonymous roles cannot issue points', async () => {
  const eligible = (await db.admin.query('select lesson_id from public.league_eligible_lessons order by lesson_id collate "C"')).rows.map(({ lesson_id }) => lesson_id);
  assert.deepEqual(eligible, lessons);
  await assert.rejects(() => db.rpc(alice, 'select public.record_verified_league_lesson($1, 0, $2)', [alice.id, 'test']), /permission denied/);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const grants = await db.admin.query(`select has_table_privilege($1, 'public.league_lesson_credits', 'INSERT') as can_insert,
      has_table_privilege($1, 'public.league_lesson_credits', 'SELECT') as can_read`, [role]);
    assert.deepEqual(grants.rows[0], { can_insert: false, can_read: false });
  }
  const anonymous = await db.admin.query("select has_function_privilege('anon', 'public.record_verified_league_lesson(uuid,integer,text)', 'execute') as allowed");
  assert.equal(anonymous.rows[0].allowed, false);
});

test('client claims contribute zero, while a trusted completion grants exactly one point under parallel retries', async () => {
  assert.deepEqual(await submit(alice, [op('first', lessons[0])]), ['applied']);
  assert.equal(await myPoints(alice), 0);
  assert.deepEqual((await Promise.all([verify(alice, 'first'), verify(alice, 'first')])).sort(), [false, true]);
  assert.equal(await myPoints(alice), 1);
  assert.deepEqual(await submit(alice, [op('repeat', lessons[0])]), ['already_rewarded']);
  assert.equal(await verify(alice, 'repeat'), false);
  assert.equal(await myPoints(alice), 1);
  assert.equal((await roster(alice)).players[0].is_me, true);
});

test('legacy imports, invalid operations, repeatable practice and missing or stale epochs are ineligible', async () => {
  const member = await db.newUser('practice');
  const operations = [
    op('legacy:sync', lessons[0]), op('unknown', 'BR-TOV-A2-HB-UNKNOWN'), op('practice', lessons[1], { repeatable: true }),
    op('no-epoch', lessons[2], { epoch: undefined }), op('stale', lessons[3], { epoch: 99 }),
    op('selfcheck', 'BR-TOV-A2-SC'), op('final', 'BR-TOV-A2-FINAL'), op('invalid', lessons[4], { coins: -1 }),
  ];
  await submit(member, operations);
  for (const operation of operations) assert.equal(await verify(member, operation.opId), false, operation.opId);
  assert.equal(await verify(member, 'first'), false, 'an operation from another participant cannot be used');
  assert.equal(await myPoints(member), 0);

  await submit(member, [op('service', lessons[5])]);
  await db.admin.query('update public.allowed_users set is_service = true where id = $1', [member.id]);
  assert.equal(await verify(member, 'service'), false);
  await db.admin.query("update public.allowed_users set is_service = false, status = 'blocked' where id = $1", [member.id]);
  assert.equal(await verify(member, 'service'), false);
});

test('Kyiv Monday boundary uses server receipt, not device time or the moment when a worker verifies', async () => {
  const member = await db.newUser('boundary');
  await submit(member, [op('before', lessons[0], { at: 0 }), op('at-boundary', lessons[1], { at: 0 })]);
  const { week_start: week } = await roster(member);
  await db.admin.query(`update public.progress_ops set created_at =
    ($2::date::timestamp at time zone 'Europe/Kyiv') - case when op_id = 'before' then interval '1 millisecond' else interval '0 seconds' end
    where user_id = $1 and op_id in ('before', 'at-boundary')`, [member.id, week]);
  assert.equal(await verify(member, 'before'), true);
  assert.equal(await verify(member, 'at-boundary'), true);
  assert.equal(await myPoints(member), 1);
});

test('a reset hides old points and restored operations cannot be credited against the new epoch', async () => {
  await db.admin.query('select public.reset_progress($1, array[$2::uuid])', ['league-reset-rehearsal', alice.id]);
  assert.equal(await myPoints(alice), 0);
  assert.equal(await verify(alice, 'first', 0), false);
  await db.admin.query('select public.restore_progress($1, $2)', ['league-reset-rehearsal', alice.id]);
  assert.equal(await verify(alice, 'first', 2), false);
  assert.equal(await myPoints(alice), 0);
  assert.deepEqual(await submit(alice, [op('after-restore', lessons[1], { epoch: 2 })], 2), ['applied']);
  assert.equal(await verify(alice, 'after-restore', 2), true);
  assert.equal(await myPoints(alice), 1);
});
