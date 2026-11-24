import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startDb, type Db, type TestUser } from './harness.ts';

type Roster = { scoring_enabled: boolean; players: { points: number; is_me: boolean }[] };
type Entry = { opId: string; kind: string; lessonId: string; xp: number; coins: number; repeatable?: boolean };
let db: Db;
let user: TestUser;
const first = 'BR-STA-A2-HB-0.1';
const second = 'BR-STA-A2-HB-0.2';
const third = 'BR-STA-A2-HB-0.3';

const roster = (member: TestUser) => db.rpc<Roster>(member, 'select public.weekly_league_roster()');
const points = async (member: TestUser) => (await roster(member)).players.find(({ is_me }) => is_me)?.points;
const complete = (opId: string, lessonId: string, extra: Partial<Entry> = {}): Entry =>
  ({ opId, kind: 'lesson', lessonId, xp: 9999, coins: 50, ...extra });
const save = (member: TestUser, entries: Entry[], epoch = 0, conn?: Awaited<ReturnType<Db['connect']>>) =>
  db.rpc<{ status: string; ops: { status: string; duplicate: boolean }[] }>(member,
    'select public.save_progress_v2(0, $1::jsonb, null, $2)', [JSON.stringify(entries), epoch], conn);

before(async () => {
  db = await startDb({ upTo: 13 });
  await db.admin.query("select public.set_progress_write_mode('v2')");
  user = await db.newUser('pilot');
  await save(user, [complete('before-opening', first)]);
  assert.equal((await roster(user)).scoring_enabled, false);
  await db.applyMigration('0014_pilot_weekly_points.sql');
});
after(async () => { await db?.stop(); });

test('enabling the pilot preserves zero scores and starts with new accepted completions without an app upgrade', async () => {
  assert.equal((await roster(user)).scoring_enabled, true);
  assert.equal(await points(user), 0);
  assert.equal((await save(user, [complete('replay-before-opening', first)])).ops[0].status, 'already_rewarded');
  assert.equal(await points(user), 0);
  assert.equal((await save(user, [complete('after-opening', second)])).ops[0].status, 'applied');
  assert.equal(await points(user), 1);
});

test('parallel duplicates award one point while unlisted activities advance no league score', async () => {
  const [a, b] = await Promise.all([db.connect(), db.connect()]);
  const results = await Promise.all([save(user, [complete('third-a', third)], 0, a), save(user, [complete('third-b', third)], 0, b)]);
  assert.deepEqual(results.map((result) => result.ops[0].status).sort(), ['already_rewarded', 'applied']);
  await save(user, [
    complete('repeat-skill', 'BR-STA-A2-HB-0.4', { repeatable: true }),
    complete('legacy:prior', 'BR-STA-A2-HB-0.5'),
    complete('selfcheck', 'BR-STA-A2-SC'),
    complete('unknown', 'BR-STA-A2-HB-DOES-NOT-EXIST'),
    complete('invalid', 'BR-STA-A2-HB-0.6', { xp: -1 }),
  ]);
  assert.equal(await points(user), 2);
  assert.equal((await roster(user)).players[0].is_me, true);
});

test('a reset and restore do not replay old credits, and a new accepted lesson earns points in the current epoch', async () => {
  await db.admin.query('select public.reset_progress($1, array[$2::uuid])', ['pilot-test-reset', user.id]);
  assert.equal(await points(user), 0);
  assert.equal((await save(user, [complete('stale', 'BR-STA-A2-HB-0.6')])).status, 'epoch_mismatch');
  await db.admin.query('select public.restore_progress($1, $2)', ['pilot-test-reset', user.id]);
  assert.equal(await points(user), 0);
  assert.equal((await save(user, [complete('after-restore', 'BR-STA-A2-HB-0.6')], 2)).ops[0].status, 'applied');
  assert.equal(await points(user), 1);
});

test('pause disables the displayed scoring flag and subsequent completions add no points', async () => {
  await db.admin.query('alter table public.progress_ops disable trigger credit_pilot_league_lesson');
  assert.equal((await roster(user)).scoring_enabled, false);
  const member = await db.newUser('pause');
  assert.equal((await save(member, [complete('while-paused', first)])).ops[0].status, 'applied');
  assert.equal(await points(member), 0);
});
