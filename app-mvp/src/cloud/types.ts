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

// Відгук тестера (кнопка «Повідомити про помилку / запропонувати»)
export type FeedbackKind = 'bug' | 'idea';
export type FeedbackInput = { kind: FeedbackKind; body: string; screen?: string; lessonId?: string; stepIdx?: number };
export type FeedbackRow = { id: number; username: string; kind: FeedbackKind; screen: string; lessonId: string; stepIdx: number | null; body: string; build: number | null; createdAt: number };

// Подія мініаналітики (див. shared/analytics.ts)
export type EventRow = { id: number; username: string; name: string; props: Record<string, unknown> | null; build: number | null; createdAt: number };

// Рядок списку тестерів для екрана /admin (без хеша коду)
export type TesterRow = { id: string; username: string; name: string; status: 'invited' | 'active' | 'blocked'; isAdmin: boolean; lastLoginAt: number | null; inviteIssuedAt: number | null };

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
  trackEvent(name: string, props?: Record<string, unknown>): Promise<void>; // мовчки ігнорує помилки: аналітика не повинна ламати урок
  sendFeedback(input: FeedbackInput): Promise<void>; // кидає Error('replaced'), якщо сеанс замінено
  // Лише для адміна (на сервері перевіряє is_admin_user; для не-адміна кидають Error('forbidden'))
  adminFeedback(): Promise<FeedbackRow[]>;
  adminTesters(): Promise<TesterRow[]>;
  adminEvents(): Promise<EventRow[]>; // останні 5000 подій
  adminAddTester(username: string, name: string): Promise<void>; // Error('already_exists' | 'bad_username')
  adminSetStatus(id: string, status: 'active' | 'blocked'): Promise<void>; // 'blocked' одразу вибиває тестера з сеансу
  adminIssueInvite(username: string): Promise<string>; // новий код (показується один раз), старий скасовується
}
