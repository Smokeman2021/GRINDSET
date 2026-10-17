// Справжній бекенд: Supabase (Auth + Postgres + Edge Function telegram-auth). Схема й функції: supabase/migrations/0001_closed_test.sql.
// УВАГА: наскрізно (з реальним Supabase і Telegram) цей файл ще не перевірявся; перевіряємо разом після того, як піднято бота й проєкт.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TelegramPayload } from './shared/telegramAuth';
import type { CloudBackend, CloudUser, LoginFailure, LoginResult, ServerProgress, SessionCheck } from './types';

const SID_KEY = 'grindset-cloud-sid';

type MeRow = { id: string; telegram_id: number | null; username: string; display_name: string | null; is_admin: boolean; session_ok: boolean };

const toUser = (m: MeRow): CloudUser => ({
  id: m.id,
  telegramId: m.telegram_id ?? 0,
  username: m.username,
  name: m.display_name || m.username,
  isAdmin: m.is_admin,
});

export class SupabaseBackend implements CloudBackend {
  mode = 'supabase' as const;
  private sid: string | null = null;
  private client: SupabaseClient;

  constructor(private url: string, private anon: string) {
    this.client = createClient(url, anon, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      // Кожен запит несе sid поточного сеансу: правила RLS порівнюють його з активним, тож старий пристрій не може оновити токен і лишитися «живим»
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (this.sid) headers.set('x-sid', this.sid);
          return fetch(input, { ...init, headers });
        },
      },
    });
  }

  private async me(): Promise<MeRow | null> {
    const { data, error } = await this.client.rpc('session_me');
    if (error || !data) return null;
    return data as MeRow;
  }

  async restore(): Promise<CloudUser | null> {
    this.sid = await AsyncStorage.getItem(SID_KEY);
    const { data } = await this.client.auth.getSession();
    if (!data.session || !this.sid) return null;
    const m = await this.me();
    return m ? toUser(m) : null;
  }

  async login(payload: TelegramPayload): Promise<LoginResult> {
    let json: { ok?: boolean; reason?: LoginFailure; token_hash?: string; sid?: string } | null = null;
    try {
      const res = await fetch(`${this.url}/functions/v1/telegram-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.anon, Authorization: `Bearer ${this.anon}` },
        body: JSON.stringify(payload),
      });
      json = await res.json().catch(() => null);
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (!json?.ok || !json.token_hash || !json.sid) return { ok: false, reason: json?.reason ?? 'error' };
    this.sid = json.sid;
    await AsyncStorage.setItem(SID_KEY, json.sid);
    const { error } = await this.client.auth.verifyOtp({ token_hash: json.token_hash, type: 'magiclink' });
    if (error) return { ok: false, reason: 'error' };
    const m = await this.me();
    return m ? { ok: true, user: toUser(m) } : { ok: false, reason: 'error' };
  }

  async logout(): Promise<void> {
    try {
      await this.client.rpc('end_session');
    } catch {
      // без мережі просто виходимо локально
    }
    await this.client.auth.signOut({ scope: 'local' });
    this.sid = null;
    await AsyncStorage.removeItem(SID_KEY);
  }

  async checkSession(): Promise<SessionCheck> {
    const m = await this.me();
    if (!m) return 'signed_out';
    return m.session_ok ? 'ok' : 'replaced';
  }

  private fail(error: { message?: string } | null): never {
    throw new Error(error?.message?.includes('session_replaced') ? 'replaced' : error?.message ?? 'error');
  }

  async loadProgress(): Promise<ServerProgress | null> {
    const { data, error } = await this.client.rpc('load_progress');
    if (error) this.fail(error);
    if (!data) return null;
    return { state: data.state as Record<string, unknown>, updatedAt: Number(data.updated_ms) };
  }

  async saveProgress(state: Record<string, unknown>): Promise<{ updatedAt: number }> {
    const { data, error } = await this.client.rpc('save_progress', { p_state: state });
    if (error) this.fail(error);
    return { updatedAt: Number(data) };
  }
}
