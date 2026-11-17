// Режим-імітація (EXPO_PUBLIC_CLOUD=mock): «сервер» живе в localStorage браузера й спільний для всіх вкладок, а сеанс клієнта зберігається
// в sessionStorage, тож дві вкладки поводяться як два пристрої. Перевірка коду з лімітом спроб і один активний сеанс виконуються
// тією самою логікою (shared/access.ts), що й на справжньому сервері. У збірці зі справжнім Supabase цей код не викликається.
import { InviteRow, accuracyBoard, checkInvite, formatInviteCode, generateInviteCode, hashInvite, newSid, normalizeInviteCode, normalizeUsername, sessionState } from './shared/access';
import { UI_BUILD } from '../version';
import { feedbackContext } from './shared/feedbackQueue';
import type { AccuracyRow, CloudBackend, CloudUser, FeedbackInput, FeedbackStatus, EventRow, FeedbackRow, LoginInput, LoginResult, SessionCheck, TesterRow } from './types';
import { localKv, sessionKv } from './storage';

const DB_KEY = 'grindset-mock-server-v2';
import { coreOf, simLegacySave, simLoad, simSave, simSwitchToV2 } from './shared/progressOps';
import type { Core, LoadV2, Op, OpStatus, SaveV2, SimRow } from './shared/progressOps';

const toSim = (p: Db['progress'][string]): SimRow => ({ state: p.state, rev: p.rev ?? 1, core: p.core ?? coreOf(p.state), rewarded: p.rewarded ?? coreOf(p.state).completed, journal: p.journal ?? {} });

const SID_KEY = 'grindset-mock-sid';
const UID_KEY = 'grindset-mock-uid';

type Row = InviteRow & { display_name: string; is_admin: boolean; active_sid: string | null; telegram_id?: number | null; last_login_at?: number | null; invite_issued_at?: number | null };
type Db = { mode?: 'legacy' | 'v2'; allowed: Row[]; progress: Record<string, { state: Record<string, unknown>; updated_at: number; rev?: number; core?: Core; rewarded?: string[]; journal?: Record<string, OpStatus> }>; feedback?: FeedbackRow[]; events?: EventRow[] };

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
    // імітація Telegram: initData виду "mock:<id>" (справжній підпис перевіряє Edge Function)
    const tgId = input.initData?.startsWith('mock:') ? Number(input.initData.slice(5)) : null;
    if (!input.username && !input.code) {
      const tgRow = tgId ? db.allowed.find((r) => r.telegram_id === tgId) : null;
      if (!tgRow) return { ok: false, reason: 'not_linked' };
      if (tgRow.status === 'blocked') return { ok: false, reason: 'blocked' };
      const sid = newSid();
      tgRow.active_sid = sid;
      tgRow.status = 'active';
      tgRow.last_login_at = Date.now();
      writeDb(db);
      sessionKv.set(SID_KEY, sid);
      sessionKv.set(UID_KEY, tgRow.id);
      return { ok: true, user: toUser(tgRow) };
    }
    const row = db.allowed.find((r) => r.username === normalizeUsername(input.username ?? '')) ?? null;
    const verdict = await checkInvite(row, input.code ?? '', Date.now());
    if (row && verdict.patch) Object.assign(row, verdict.patch);
    if (!verdict.ok || !row) {
      writeDb(db);
      return { ok: false, reason: verdict.ok ? 'wrong' : verdict.reason, attemptsLeft: verdict.ok ? undefined : verdict.attemptsLeft, lockedSeconds: verdict.ok ? undefined : verdict.lockedSeconds };
    }
    const sid = newSid();
    row.active_sid = sid; // новий вхід замінює старий сеанс
    row.status = 'active'; // перший вхід: invited → active (як на сервері)
    if (tgId && !row.telegram_id && !db.allowed.some((r) => r.telegram_id === tgId)) row.telegram_id = tgId; // привʼязка Telegram разом із кодом
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

  // Імітація сервера ТЗ-01: ті самі правила, що в save_progress_v2 (shared/progressOps.simSave). Режим запису перемикається (типово v2).
  async loadProgressV2(): Promise<LoadV2> {
    const row = await this.mustBeActive();
    const db = await readDb();
    const p = db.progress[row.id];
    return simLoad(db.mode ?? 'v2', p ? { state: p.state, rev: p.rev ?? 1, core: p.core ?? coreOf(p.state), rewarded: p.rewarded ?? coreOf(p.state).completed, journal: p.journal ?? {} } : null);
  }

  async saveProgressV2(baseRev: number, ops: Op[], clientState: Record<string, unknown> | null): Promise<SaveV2> {
    const row = await this.mustBeActive();
    const db = await readDb();
    const p = db.progress[row.id];
    const cur = p ? { state: p.state, rev: p.rev ?? 1, core: p.core ?? coreOf(p.state), rewarded: p.rewarded ?? coreOf(p.state).completed, journal: p.journal ?? {} } : null;
    const out = simSave(db.mode ?? 'v2', cur, baseRev, ops, clientState);
    if (out.row) {
      db.progress[row.id] = { ...out.row, updated_at: Date.now() };
      writeDb(db);
    }
    return out.res;
  }

  // ───────── Керування імітацією (лише режим mock): режим запису і «стара збірка» ─────────
  // З консолі браузера: __grindsetMock.mode(), __grindsetMock.setMode('legacy' | 'v2'), __grindsetMock.legacySaveLocal()
  async mockMode(): Promise<'legacy' | 'v2'> {
    return (await readDb()).mode ?? 'v2';
  }

  // Як set_progress_write_mode: у v2 ядро кожного рядка збирається з поточного state; у legacy лише зміна режиму
  async mockSetMode(mode: 'legacy' | 'v2'): Promise<void> {
    const db = await readDb();
    if ((db.mode ?? 'v2') === mode) return;
    if (mode === 'v2') for (const [id, p] of Object.entries(db.progress)) db.progress[id] = { ...simSwitchToV2(toSim(p)), updated_at: p.updated_at };
    db.mode = mode;
    writeDb(db);
  }

  // Те, що робила стара збірка: зберегти весь стан одним знімком (правила захищеної save_progress). У режимі v2 нічого не пише.
  async mockLegacySave(state: Record<string, unknown>): Promise<{ written: boolean }> {
    const row = await this.mustBeActive();
    const db = await readDb();
    const p = db.progress[row.id];
    const out = simLegacySave(db.mode ?? 'v2', p ? toSim(p) : null, state);
    if (out.written && out.row) {
      db.progress[row.id] = { ...out.row, updated_at: Date.now() };
      writeDb(db);
    }
    return { written: out.written };
  }

  // «Стара збірка» зберігає те, що зараз лежить на пристрої
  async mockLegacySaveLocal(): Promise<{ written: boolean }> {
    const raw = await localKv.get('grindset-state');
    const state = raw ? ((JSON.parse(raw) as { state?: Record<string, unknown> }).state ?? {}) : {};
    return this.mockLegacySave(state);
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
    const ctx = feedbackContext({ screen: input.screen ?? '', lessonId: input.lessonId, stepIdx: input.stepIdx, branch: input.branch, simStep: input.simStep }, UI_BUILD);
    list.push({
      id: list.length + 1,
      username: me.username,
      kind: input.kind,
      screen: ctx.screen,
      lessonId: ctx.lessonId ?? '',
      stepIdx: ctx.stepIdx ?? null,
      branch: ctx.branch ?? null,
      simStep: ctx.simStep ?? null,
      status: 'new',
      useful: false,
      note: null,
      body: input.body.trim().slice(0, 2000),
      build: UI_BUILD,
      createdAt: Date.now(),
    });
    writeDb(db);
  }

  async trackEvent(name: string, props?: Record<string, unknown>): Promise<void> {
    try {
      const me = await this.mustBeActive();
      const db = await readDb();
      const list = (db.events ??= []);
      list.push({ id: list.length + 1, username: me.username, name, props: props ?? null, build: UI_BUILD, createdAt: Date.now() });
      if (list.length > 5000) list.splice(0, list.length - 5000);
      writeDb(db);
    } catch {
      // аналітика не повинна ламати застосунок
    }
  }

  async adminEvents(): Promise<EventRow[]> {
    await this.mustBeAdmin();
    return [...((await readDb()).events ?? [])].sort((a, b) => b.createdAt - a.createdAt);
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

  async adminFeedbackReview(id: number, note: string, status: FeedbackStatus, useful: boolean): Promise<void> {
    await this.mustBeAdmin();
    if (!['new', 'queued', 'done', 'skip'].includes(status)) throw new Error('bad_status');
    const db = await readDb();
    const f = (db.feedback ?? []).find((x) => x.id === id);
    if (!f) throw new Error('not_found');
    f.note = note.trim() || null;
    f.status = status;
    f.useful = useful;
    writeDb(db);
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
