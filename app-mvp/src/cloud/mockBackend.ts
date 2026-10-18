// Режим-імітація (EXPO_PUBLIC_CLOUD=mock): «сервер» живе в localStorage браузера й спільний для всіх вкладок, а сеанс клієнта зберігається
// в sessionStorage, тож дві вкладки поводяться як два пристрої. Перевірка коду з лімітом спроб і один активний сеанс виконуються
// тією самою логікою (shared/access.ts), що й на справжньому сервері. У збірці зі справжнім Supabase цей код не викликається.
import { InviteRow, checkInvite, formatInviteCode, hashInvite, newSid, normalizeInviteCode, normalizeUsername, sessionState } from './shared/access';
import type { CloudBackend, CloudUser, LoginInput, LoginResult, ServerProgress, SessionCheck } from './types';
import { sessionKv } from './storage';

const DB_KEY = 'grindset-mock-server-v2';
const SID_KEY = 'grindset-mock-sid';
const UID_KEY = 'grindset-mock-uid';

type Row = InviteRow & { display_name: string; is_admin: boolean; active_sid: string | null };
type Db = { allowed: Row[]; progress: Record<string, { state: Record<string, unknown>; updated_at: number }> };

// Тестові облікові записи імітації та їхні коди (лише для розробки; справжні коди видає автор через SQL issue_invite)
export const MOCK_ACCOUNTS: { username: string; name: string; code: string; status: Row['status']; admin?: boolean }[] = [
  { username: 'admin_me', name: 'Адмін (я)', code: 'ADMN-2222-3333', status: 'active', admin: true },
  { username: 'tester_one', name: 'Тестер Один', code: 'TEST-ONE2-4444', status: 'invited' },
  { username: 'tester_two', name: 'Тестер Два', code: 'TEST-TWO3-5555', status: 'invited' },
  { username: 'blocked_guy', name: 'Заблокований', code: 'BLCK-6666-7777', status: 'blocked' },
];

const memDb: { v: Db | null } = { v: null };

async function seed(): Promise<Db> {
  const allowed: Row[] = [];
  for (const a of MOCK_ACCOUNTS) {
    const salt = `salt-${a.username}`;
    allowed.push({
      id: `mock-${a.username}`,
      username: a.username,
      display_name: a.name,
      status: a.status,
      is_admin: !!a.admin,
      invite_salt: salt,
      invite_hash: await hashInvite(salt, normalizeInviteCode(a.code)),
      failed_attempts: 0,
      locked_until: null,
      active_sid: null,
    });
  }
  return { allowed, progress: {} };
}

async function readDb(): Promise<Db> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as Db;
      const fresh = await seed();
      localStorage.setItem(DB_KEY, JSON.stringify(fresh));
      return fresh;
    }
  } catch {
    // нижче запасний варіант у памʼяті
  }
  if (!memDb.v) memDb.v = await seed();
  return memDb.v;
}

function writeDb(db: Db) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return;
    }
  } catch {
    // нижче
  }
  memDb.v = db;
}

const toUser = (row: Row): CloudUser => ({ id: row.id, username: row.username, name: row.display_name || row.username, isAdmin: row.is_admin });

export class MockBackend implements CloudBackend {
  mode = 'mock' as const;

  async restore(): Promise<CloudUser | null> {
    const uid = sessionKv.get(UID_KEY);
    if (!uid || !sessionKv.get(SID_KEY)) return null;
    const row = (await readDb()).allowed.find((r) => r.id === uid);
    return row ? toUser(row) : null;
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const db = await readDb();
    const row = db.allowed.find((r) => r.username === normalizeUsername(input.username)) ?? null;
    const verdict = await checkInvite(row, input.code, Date.now());
    if (row && verdict.patch) Object.assign(row, verdict.patch);
    if (!verdict.ok || !row) {
      writeDb(db);
      return { ok: false, reason: verdict.ok ? 'wrong' : verdict.reason, attemptsLeft: verdict.ok ? undefined : verdict.attemptsLeft, lockedSeconds: verdict.ok ? undefined : verdict.lockedSeconds };
    }
    const sid = newSid();
    row.active_sid = sid; // новий вхід замінює старий сеанс
    writeDb(db);
    sessionKv.set(SID_KEY, sid);
    sessionKv.set(UID_KEY, row.id);
    return { ok: true, user: toUser(row) };
  }

  async logout(): Promise<void> {
    const sid = sessionKv.get(SID_KEY);
    const uid = sessionKv.get(UID_KEY);
    if (sid && uid) {
      const db = await readDb();
      const row = db.allowed.find((r) => r.id === uid);
      if (row && row.active_sid === sid) {
        row.active_sid = null;
        writeDb(db);
      }
    }
    sessionKv.del(SID_KEY);
    sessionKv.del(UID_KEY);
  }

  async checkSession(): Promise<SessionCheck> {
    const sid = sessionKv.get(SID_KEY);
    const uid = sessionKv.get(UID_KEY);
    if (!sid || !uid) return 'signed_out';
    const row = (await readDb()).allowed.find((r) => r.id === uid);
    if (!row || row.status === 'blocked') return 'signed_out';
    return sessionState(sid, row.active_sid);
  }

  private async mustBeActive(): Promise<Row> {
    const uid = sessionKv.get(UID_KEY);
    const row = (await readDb()).allowed.find((r) => r.id === uid);
    if (!row || (await this.checkSession()) !== 'ok') throw new Error('replaced');
    return row;
  }

  async loadProgress(): Promise<ServerProgress | null> {
    const row = await this.mustBeActive();
    const p = (await readDb()).progress[row.id];
    return p ? { state: p.state, updatedAt: p.updated_at } : null;
  }

  async saveProgress(state: Record<string, unknown>): Promise<{ updatedAt: number }> {
    const row = await this.mustBeActive();
    const db = await readDb();
    const updatedAt = Date.now();
    db.progress[row.id] = { state, updated_at: updatedAt };
    writeDb(db);
    return { updatedAt };
  }
}

export { formatInviteCode };
