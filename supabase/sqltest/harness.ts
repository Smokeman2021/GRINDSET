// Локальний Postgres для автотестів функцій бази (ТЗ-01). Справжній сервер (кілька зʼєднань, блокування), без Docker.
// Сервер стартує через pg_ctl: на Windows він сам скидає права адміністратора, з якими Postgres запускатись відмовляється.
// Поверх порожньої бази ставиться мінімальна імітація Supabase (ролі, auth.uid(), auth.role(), заголовки запиту) і міграції 0001–0007.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(here, 'node_modules', '@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native', 'bin');
const exe = (n: string) => path.join(BIN, process.platform === 'win32' ? `${n}.exe` : n);
const MIGRATIONS = path.join(here, '..', 'migrations');

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'app' noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid());
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role' $$;
`;

export type TestUser = { id: string; authId: string; sid: string; username: string };

export type Db = {
  admin: pg.Client;
  newUser(name?: string): Promise<TestUser>;
  /** окреме зʼєднання застосунку (роль authenticator); закривати через end() */
  connect(): Promise<pg.Client>;
  /** один RPC-виклик = одна транзакція, як у PostgREST */
  rpc<T = unknown>(u: TestUser, sql: string, params?: unknown[], client?: pg.Client): Promise<T>;
  /** відкрити транзакцію від імені користувача й лишити її відкритою (для перевірки блокувань) */
  begin(u: TestUser, client: pg.Client): Promise<void>;
  applyMigration(file: string): Promise<void>;
  stop(): Promise<void>;
};

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'ignore', windowsHide: true });
    p.on('exit', (code) => resolve(code ?? 1));
    p.on('error', () => resolve(1));
  });
}

export async function startDb(opts: { upTo?: number } = {}): Promise<Db> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tz01-pg-'));
  const data = path.join(dir, 'data');
  const pw = path.join(dir, 'pw');
  const port = 54100 + Math.floor(Math.random() * 800);
  fs.writeFileSync(pw, 'postgres\n');
  const init = spawnSync(exe('initdb'), ['-D', data, '-U', 'postgres', `--pwfile=${pw}`, '-A', 'password', '-E', 'UTF8', '--locale=C'], { stdio: 'ignore', windowsHide: true });
  if (init.status !== 0) throw new Error('initdb failed');
  const started = await run(exe('pg_ctl'), ['-D', data, '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off`, '-l', path.join(dir, 'log.txt'), '-w', 'start']);
  if (started !== 0) throw new Error(`pg_ctl start failed: ${fs.existsSync(path.join(dir, 'log.txt')) ? fs.readFileSync(path.join(dir, 'log.txt'), 'utf8').slice(-600) : ''}`);

  const conn = (user: string, password: string) => new pg.Client({ host: '127.0.0.1', port, user, password, database: 'postgres' });
  const admin = conn('postgres', 'postgres');
  await admin.connect();
  await admin.query(SHIM);
  try {
    await admin.query('create extension if not exists pgcrypto with schema extensions');
  } catch {
    // без pgcrypto: міграція 0002 (коди запрошень) потребує лише двох функцій, для тестів прогресу досить заглушок
    await admin.query(`create function extensions.gen_random_bytes(int) returns bytea language sql as $$ select decode(md5(random()::text), 'hex') $$;
      create function extensions.digest(text, text) returns bytea language sql as $$ select decode(md5($1), 'hex') $$;`);
  }

  const applyMigration = async (file: string) => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/create extension if not exists pgcrypto with schema extensions;/g, '');
    await admin.query(sql);
  };
  const files = fs.readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  for (const f of files) if (Number(f.slice(0, 4)) <= (opts.upTo ?? 9999)) await applyMigration(f);

  const clients: pg.Client[] = [];
  const connect = async () => {
    const c = conn('authenticator', 'app');
    await c.connect();
    clients.push(c);
    return c;
  };
  const shared = await connect();
  let seq = 0;

  const begin = async (u: TestUser, client: pg.Client) => {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query('select set_config($1, $2, true), set_config($3, $4, true)', [
      'request.jwt.claims', JSON.stringify({ sub: u.authId, role: 'authenticated' }),
      'request.headers', JSON.stringify({ 'x-sid': u.sid }),
    ]);
  };

  return {
    admin,
    connect,
    begin,
    applyMigration,
    async newUser(name) {
      seq += 1;
      const username = `${name ?? 'u'}${seq}_${Math.random().toString(36).slice(2, 7)}`;
      const authId = (await admin.query('insert into auth.users default values returning id')).rows[0].id as string;
      const sid = `sid-${username}`;
      const id = (await admin.query("insert into public.allowed_users (username, status, auth_user_id, active_sid) values ($1, 'active', $2, $3) returning id", [username, authId, sid])).rows[0].id as string;
      return { id, authId, sid, username };
    },
    async rpc<T>(u: TestUser, sql: string, params: unknown[] = [], client: pg.Client = shared): Promise<T> {
      await begin(u, client);
      try {
        const res = await client.query(sql, params);
        await client.query('commit');
        return (res.rows[0] ? Object.values(res.rows[0])[0] : null) as T;
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    },
    async stop() {
      for (const c of clients) await c.end().catch(() => {});
      await admin.end().catch(() => {});
      await run(exe('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows може ще тримати файли: тимчасова тека, не критично
      }
    },
  };
}
