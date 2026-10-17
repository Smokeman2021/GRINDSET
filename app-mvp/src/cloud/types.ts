import type { TelegramPayload } from './shared/telegramAuth';

export type CloudMode = 'off' | 'mock' | 'supabase';

export type CloudUser = {
  id: string; // id запису в білому списку (стабільний; не залежить від @username)
  telegramId: number;
  username: string; // лише для показу
  name: string;
  isAdmin: boolean;
};

export type LoginFailure = 'invite_only' | 'blocked' | 'id_mismatch' | 'no_username' | 'bad_hash' | 'expired' | 'malformed' | 'error';
export type LoginResult = { ok: true; user: CloudUser } | { ok: false; reason: LoginFailure };

export type SessionCheck = 'ok' | 'replaced' | 'signed_out';

export type ServerProgress = { state: Record<string, unknown>; updatedAt: number };

// Один інтерфейс для імітації (локальної) і справжнього Supabase: решта застосунку про різницю не знає
export interface CloudBackend {
  mode: CloudMode;
  restore(): Promise<CloudUser | null>; // локальна сесія, якщо є (без перевірки на сервері)
  login(payload: TelegramPayload): Promise<LoginResult>;
  logout(): Promise<void>;
  checkSession(): Promise<SessionCheck>;
  loadProgress(): Promise<ServerProgress | null>;
  saveProgress(state: Record<string, unknown>): Promise<{ updatedAt: number }>; // кидає Error('replaced'), якщо сеанс замінено
}
