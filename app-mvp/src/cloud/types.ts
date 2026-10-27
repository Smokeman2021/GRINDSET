export type CloudMode = 'off' | 'mock' | 'supabase';

export type CloudUser = {
  id: string; // id запису в білому списку (стабільний; не залежить від ніка)
  username: string; // @нік без @: лише для показу й водяного знака
  name: string;
  isAdmin: boolean;
};

// wrong — хибний нік/код (однакова відповідь, щоб не підказувати, чи існує нік); locked — забагато хибних спроб;
// blocked — доступ вимкнено; too_many — забагато спроб з однієї адреси
export type LoginFailure = 'wrong' | 'locked' | 'blocked' | 'too_many' | 'error';
export type LoginInput = { username: string; code: string };
export type LoginResult = { ok: true; user: CloudUser } | { ok: false; reason: LoginFailure; attemptsLeft?: number; lockedSeconds?: number };

export type SessionCheck = 'ok' | 'replaced' | 'signed_out';

// Рядок рейтингу точності: лише публічне (імʼя, відсоток, кількість відповідей, позначка «це я»)
export type AccuracyRow = { name: string; accuracy: number; answers: number; isMe: boolean };

export type ServerProgress = { state: Record<string, unknown>; updatedAt: number };

// Один інтерфейс для імітації (локальної) і справжнього Supabase: решта застосунку про різницю не знає
export interface CloudBackend {
  mode: CloudMode;
  restore(): Promise<CloudUser | null>; // локальна сесія, якщо є (без перевірки на сервері)
  login(input: LoginInput): Promise<LoginResult>;
  logout(): Promise<void>;
  checkSession(): Promise<SessionCheck>;
  loadProgress(): Promise<ServerProgress | null>;
  saveProgress(state: Record<string, unknown>): Promise<{ updatedAt: number }>; // кидає Error('replaced'), якщо сеанс замінено
  accuracyBoard(): Promise<AccuracyRow[]>; // рейтинг точності реальних гравців; кидає Error('replaced'), якщо сеанс замінено
}
