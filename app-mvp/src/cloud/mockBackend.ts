// Режим-імітація (EXPO_PUBLIC_CLOUD=mock): «сервер» живе в localStorage браузера й спільний для всіх вкладок, а сеанс клієнта зберігається
// в sessionStorage, тож дві вкладки поводяться як два пристрої. Рішення про допуск, перевірка підпису й один активний сеанс виконуються
// тією самою логікою (shared/telegramAuth.ts), що й на справжньому сервері. У збірці зі справжнім Supabase цей код не викликається.
import {
  AllowedRow,
  TelegramPayload,
  checkTelegramPayload,
  decideAccess,
  newSid,
  normalizeUsername,
  sessionState,
  telegramHash,
} from './shared/telegramAuth';
import type { CloudBackend, CloudUser, LoginResult, ServerProgress, SessionCheck } from './types';
import { sessionKv } from './storage';

const BOT_TOKEN = 'mock-bot-token-not-a-secret';
const DB_KEY = 'grindset-mock-server';
const SID_KEY = 'grindset-mock-sid';
const UID_KEY = 'grindset-mock-uid';

type Row = AllowedRow & { active_sid?: string | null };
type Db = { allowed: Row[]; progress: Record<string, { state: Record<string, unknown>; updated_at: number }> };

const seedRow = (username: string, name: string, status: Row['status'] = 'active', isAdmin = false): Row => ({
  id: `mock-${username}`,
  username,
  display_name: name,
  telegram_id: null,
  status,
  is_admin: isAdmin,
  active_sid: null,
});

// Тестові облікові записи імітації
export const MOCK_SEED: Db = {
  allowed: [
    seedRow('admin_me', 'Адмін (я)', 'active', true),
    seedRow('tester_one', 'Тестер Один'),
    seedRow('tester_two', 'Тестер Два'),
    seedRow('blocked_guy', 'Заблокований', 'blocked'),
  ],
  progress: {},
};

const memDb: { v: Db | null } = { v: null };

function readDb(): Db {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw) as Db;
      const fresh = JSON.parse(JSON.stringify(MOCK_SEED)) as Db;
      localStorage.setItem(DB_KEY, JSON.stringify(fresh));
      return fresh;
    }
  } catch {
    // нижче запасний варіант у памʼяті
  }
  if (!memDb.v) memDb.v = JSON.parse(JSON.stringify(MOCK_SEED)) as Db;
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

// Формує підписаний Telegram-подібний пакет, як віджет (лише для імітації)
export async function mockSignPayload(p: { id: number; username?: string; first_name?: string }): Promise<TelegramPayload> {
  const base: Record<string, unknown> = { id: p.id, auth_date: Math.floor(Date.now() / 1000) };
  if (p.username) base.username = p.username;
  if (p.first_name) base.first_name = p.first_name;
  const hash = await telegramHash(base, BOT_TOKEN);
  return { ...(base as Omit<TelegramPayload, 'hash'>), hash } as TelegramPayload;
}

function toUser(row: Row): CloudUser {
  return { id: row.id, telegramId: row.telegram_id ?? 0, username: row.username, name: row.display_name || row.username, isAdmin: row.is_admin };
}

export class MockBackend implements CloudBackend {
  mode = 'mock' as const;

  async restore(): Promise<CloudUser | null> {
    const uid = sessionKv.get(UID_KEY);
    if (!uid || !sessionKv.get(SID_KEY)) return null;
    const row = readDb().allowed.find((r) => r.id === uid);
    return row ? toUser(row) : null;
  }

  async login(payload: TelegramPayload): Promise<LoginResult> {
    const check = await checkTelegramPayload(payload, BOT_TOKEN, Math.floor(Date.now() / 1000));
    if (check !== 'ok') return { ok: false, reason: check };
    const db = readDb();
    const uname = normalizeUsername(payload.username);
    const byId = db.allowed.find((r) => r.telegram_id === payload.id) ?? null;
    const byUsername = uname ? db.allowed.find((r) => r.username === uname) ?? null : null;
    const d = decideAccess({ id: payload.id, username: payload.username }, byId, byUsername);
    if (!d.allow) return { ok: false, reason: d.reason };
    const row = db.allowed.find((r) => r.id === d.row.id)!;
    if (d.bindTelegramId) row.telegram_id = payload.id;
    if (d.syncUsername) row.username = d.syncUsername;
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
      const db = readDb();
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
    const row = readDb().allowed.find((r) => r.id === uid);
    if (!row || row.status === 'blocked') return 'signed_out';
    return sessionState(sid, row.active_sid);
  }

  private async mustBeActive(): Promise<Row> {
    const uid = sessionKv.get(UID_KEY);
    const row = readDb().allowed.find((r) => r.id === uid);
    if (!row || (await this.checkSession()) !== 'ok') throw new Error('replaced');
    return row;
  }

  async loadProgress(): Promise<ServerProgress | null> {
    const row = await this.mustBeActive();
    const p = readDb().progress[row.id];
    return p ? { state: p.state, updatedAt: p.updated_at } : null;
  }

  async saveProgress(state: Record<string, unknown>): Promise<{ updatedAt: number }> {
    const row = await this.mustBeActive();
    const db = readDb();
    const updatedAt = Date.now();
    db.progress[row.id] = { state, updated_at: updatedAt };
    writeDb(db);
    return { updatedAt };
  }
}
