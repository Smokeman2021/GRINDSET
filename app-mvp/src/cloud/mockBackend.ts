// Режим-імітація (EXPO_PUBLIC_CLOUD=mock): «сервер» живе в localStorage браузера й спільний для всіх вкладок, а сеанс клієнта зберігається
// в sessionStorage, тож дві вкладки поводяться як два пристрої. Перевірка коду з лімітом спроб і один активний сеанс виконуються
// тією самою логікою (shared/access.ts), що й на справжньому сервері. У збірці зі справжнім Supabase цей код не викликається.
import { InviteRow, accuracyBoard, checkInvite, formatInviteCode, generateInviteCode, hashInvite, newSid, normalizeInviteCode, normalizeUsername, sessionState } from './shared/access';
import { UI_BUILD } from '../version';
import type { AccuracyRow, CloudBackend, CloudUser, FeedbackInput, FeedbackRow, LoginInput, LoginResult, ServerProgress, SessionCheck, TesterRow } from './types';
import { sessionKv } from './storage';

const DB_KEY = 'grindset-mock-server-v2';
const SID_KEY = 'grindset-mock-sid';
const UID_KEY = 'grindset-mock-uid';

type Row = InviteRow & { display_name: string; is_admin: boolean; active_sid: string | null; last_login_at?: number | null; invite_issued_at?: number | null };
type Db = { allowed: Row[]; progress: Record<string, { state: Record<string, unknown>; updated_at: number }>; feedback?: FeedbackRow[] };

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
    row.status = 'active'; // перший вхід: invited → active (як на сервері)
    row.last_login_at = Date.now();
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

  async accuracyBoard(): Promise<AccuracyRow[]> {
    const me = await this.mustBeActive();
    const db = await readDb();
    return accuracyBoard(
      db.allowed.map((r) => {
        const st = db.progress[r.id]?.state ?? {};
        return { name: r.display_name || r.username, status: r.status, isAdmin: r.is_admin, correct: Number(st.answersCorrect) || 0, total: Number(st.answersTotal) || 0, isMe: r.id === me.id };
      })
    );
  }

  async sendFeedback(input: FeedbackInput): Promise<void> {
    const me = await this.mustBeActive();
    const db = await readDb();
    const list = (db.feedback ??= []);
    list.push({
      id: list.length + 1,
      username: me.username,
      kind: input.kind,
      screen: input.screen ?? '',
      lessonId: input.lessonId ?? '',
      stepIdx: input.stepIdx ?? null,
      body: input.body.trim().slice(0, 2000),
      build: UI_BUILD,
      createdAt: Date.now(),
    });
    writeDb(db);
  }

  private async mustBeAdmin(): Promise<Row> {
    const me = await this.mustBeActive();
    if (!me.is_admin) throw new Error('forbidden');
    return me;
  }

  async adminFeedback(): Promise<FeedbackRow[]> {
    await this.mustBeAdmin();
    return [...((await readDb()).feedback ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  }

  async adminTesters(): Promise<TesterRow[]> {
    await this.mustBeAdmin();
    return (await readDb()).allowed.map((r) => ({
      id: r.id,
      username: r.username,
      name: r.display_name || r.username,
      status: r.status,
      isAdmin: r.is_admin,
      lastLoginAt: r.last_login_at ?? null,
      inviteIssuedAt: r.invite_issued_at ?? null,
    }));
  }

  async adminAddTester(username: string, name: string): Promise<void> {
    await this.mustBeAdmin();
    const uname = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,32}$/.test(uname)) throw new Error('bad_username');
    const db = await readDb();
    if (db.allowed.some((r) => r.username === uname)) throw new Error('already_exists');
    db.allowed.push({ id: `mock-${uname}`, username: uname, display_name: name.trim(), status: 'invited', is_admin: false, invite_salt: null, invite_hash: null, failed_attempts: 0, locked_until: null, active_sid: null });
    writeDb(db);
  }

  async adminSetStatus(id: string, status: 'active' | 'blocked'): Promise<void> {
    const me = await this.mustBeAdmin();
    if (id === me.id) throw new Error('cannot_change_self');
    const db = await readDb();
    const row = db.allowed.find((r) => r.id === id);
    if (!row) throw new Error('user_not_found');
    row.status = status;
    if (status === 'blocked') row.active_sid = null;
    writeDb(db);
  }

  async adminIssueInvite(username: string): Promise<string> {
    await this.mustBeAdmin();
    const db = await readDb();
    const row = db.allowed.find((r) => r.username === normalizeUsername(username));
    if (!row) throw new Error('user_not_found');
    const code = generateInviteCode();
    row.invite_salt = `salt-${Math.random().toString(36).slice(2)}`;
    row.invite_hash = await hashInvite(row.invite_salt, normalizeInviteCode(code));
    row.invite_issued_at = Date.now();
    row.failed_attempts = 0;
    row.locked_until = null;
    writeDb(db);
    return code;
  }
}

export { formatInviteCode };
