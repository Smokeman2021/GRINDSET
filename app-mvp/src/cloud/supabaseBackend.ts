// Справжній бекенд: Supabase (Auth + Postgres + Edge Function invite-login). Схема й функції: supabase/migrations/0001_closed_test.sql і 0002_invite_codes.sql.
// УВАГА: наскрізно (з реальним Supabase) цей файл ще не перевірявся; перевіряємо разом після того, як піднято проєкт.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UI_BUILD } from '../version';
import { coreOf } from './shared/progressOps';
import type { Core, LoadV2, Op, OpResult, SaveV2 } from './shared/progressOps';
import { feedbackContext, legacyPayload } from './shared/feedbackQueue';
import type { AccuracyRow, CloudBackend, CloudUser, FeedbackInput, FeedbackStatus, EventRow, FeedbackRow, LoginFailure, LoginInput, LoginResult, ServerProgress, SessionCheck, TesterRow } from './types';

const SID_KEY = 'grindset-cloud-sid';

type MeRow = { id: string; username: string; display_name: string | null; is_admin: boolean; session_ok: boolean };

const toUser = (m: MeRow): CloudUser => ({ id: m.id, username: m.username, name: m.display_name || m.username, isAdmin: m.is_admin });

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

  async login(input: LoginInput): Promise<LoginResult> {
    let json: { ok?: boolean; reason?: LoginFailure; attemptsLeft?: number; lockedSeconds?: number; token_hash?: string; sid?: string } | null = null;
    try {
      const res = await fetch(`${this.url}/functions/v1/invite-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.anon, Authorization: `Bearer ${this.anon}` },
        body: JSON.stringify(input),
      });
      json = await res.json().catch(() => null);
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (!json?.ok || !json.token_hash || !json.sid) {
      return { ok: false, reason: json?.reason ?? 'error', attemptsLeft: json?.attemptsLeft, lockedSeconds: json?.lockedSeconds };
    }
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

  // Функції ще немає (міграцію 0007 не застосовано): для нової збірки це тимчасовий стан, а не помилка
  private missing(error: { code?: string; message?: string } | null): boolean {
    return error?.code === 'PGRST202' || /Could not find the function|does not exist/i.test(error?.message ?? '');
  }

  async loadProgressV2(): Promise<LoadV2> {
    const { data, error } = await this.client.rpc('load_progress_v2');
    if (error) {
      if (!this.missing(error)) this.fail(error);
      const old = await this.loadProgress(); // лише читання старим способом; запису старим способом у новій збірці немає
      const core = coreOf(old?.state);
      return { mode: 'legacy', epoch: 0, exists: !!old, rev: 0, core, rewarded: [...core.completed], state: old?.state ?? null };
    }
    const d = data as { mode: string; epoch?: number; exists: boolean; rev: number; core: Core; rewarded: string[]; state: Record<string, unknown> | null };
    // epoch (ТЗ 005): до міграції 0009 її немає — 0
    return { mode: d.mode === 'v2' ? 'v2' : 'legacy', epoch: Number(d.epoch ?? 0) || 0, exists: !!d.exists, rev: Number(d.rev), core: d.core, rewarded: d.rewarded ?? [], state: d.state ?? null };
  }

  async saveProgressV2(baseRev: number, ops: Op[], clientState: Record<string, unknown> | null, epoch: number): Promise<SaveV2> {
    // p_epoch є в save_progress_v2 з 0007 (там ігнорується), перевіряється з 0009
    const { data, error } = await this.client.rpc('save_progress_v2', { p_base_rev: baseRev, p_ops: ops, p_client_state: clientState, p_epoch: epoch });
    if (error) {
      if (this.missing(error)) return { status: 'not_active' };
      this.fail(error);
    }
    const d = data as { status: string; epoch?: number; rev: number; core: Core; rewarded: string[]; client_state: Record<string, unknown>; client_state_status: string; ops: OpResult[] };
    if (d.status === 'epoch_mismatch') return { status: 'epoch_mismatch', epoch: Number(d.epoch ?? 0) || 0 };
    if (d.status !== 'ok') return { status: 'not_active' };
    const cs = d.client_state_status;
    return {
      status: 'ok',
      rev: Number(d.rev),
      core: d.core,
      rewarded: d.rewarded ?? [],
      clientState: d.client_state ?? {},
      clientStateStatus: cs === 'saved' || cs === 'client_state_conflict' || cs === 'rejected_invalid' ? cs : 'none',
      ops: d.ops ?? [],
    };
  }

  // Рейтинг точності: SECURITY DEFINER-функція leaderboard_accuracy() віддає лише імʼя, %, кількість відповідей і позначку «це я»
  async accuracyBoard(): Promise<AccuracyRow[]> {
    const { data, error } = await this.client.rpc('leaderboard_accuracy');
    if (error) this.fail(error);
    return ((data ?? []) as { name: string; accuracy: number | string; answers: number; is_me: boolean }[]).map((r) => ({
      name: r.name,
      accuracy: Number(r.accuracy),
      answers: Number(r.answers),
      isMe: !!r.is_me,
    }));
  }

  // Відгук: автора й нік підставляє тригер feedback_fill на сервері (migrations/0004), тож їх тут не передаємо
  async sendFeedback(input: FeedbackInput): Promise<void> {
    const ctx = feedbackContext({ screen: input.screen ?? '', lessonId: input.lessonId, stepIdx: input.stepIdx, branch: input.branch, simStep: input.simStep }, UI_BUILD);
    const base = { screen: ctx.screen, lesson_id: ctx.lessonId ?? null, step_idx: ctx.stepIdx ?? null, build: UI_BUILD };
    const { error } = await this.client.from('feedback').insert({ ...base, kind: input.kind, body: input.body, branch: ctx.branch ?? null, sim_step: ctx.simStep ?? null });
    if (!error) return;
    // 0008 ще не застосовано (вікно викладки): нових колонок і видів сервер не знає — пишемо старим форматом, контекст у тексті
    if (error.code === '42703' || error.code === '23514' || error.code === 'PGRST204' || /column|check constraint/i.test(error.message ?? '')) {
      const old = legacyPayload(input.kind === 'idea' ? 'proposal' : input.kind, input.body, ctx);
      const r = await this.client.from('feedback').insert({ ...base, kind: old.kind, body: old.body });
      if (r.error) this.fail(r.error);
      return;
    }
    this.fail(error);
  }

  // Далі лише для адміна: читання відгуків дозволяє RLS (feedback_admin_read), решта це SECURITY DEFINER-функції 0004 / 0002
  async adminFeedback(): Promise<FeedbackRow[]> {
    // черга з помітками власника (0008); якщо функції ще немає — старе читання без поміток
    const q = await this.client.rpc('admin_feedback_queue');
    if (!q.error) {
      return ((q.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        username: String(r.username ?? ''),
        kind: (['bug', 'idea', 'comment', 'proposal'].includes(String(r.kind)) ? r.kind : 'bug') as FeedbackRow['kind'],
        screen: String(r.screen ?? ''),
        lessonId: String(r.lesson_id ?? ''),
        stepIdx: r.step_idx == null ? null : Number(r.step_idx),
        branch: r.branch == null ? null : String(r.branch),
        simStep: r.sim_step == null ? null : Number(r.sim_step),
        body: String(r.body ?? ''),
        build: r.build == null ? null : Number(r.build),
        createdAt: Number(r.created_ms),
        note: r.note == null ? null : String(r.note),
        status: (r.status ?? 'new') as FeedbackRow['status'],
        useful: !!r.useful,
      }));
    }
    if (!this.missing(q.error)) this.fail(q.error);
    const { data, error } = await this.client.from('feedback').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) this.fail(error);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      username: String(r.username ?? ''),
      kind: r.kind === 'idea' ? 'idea' : 'bug',
      screen: String(r.screen ?? ''),
      lessonId: String(r.lesson_id ?? ''),
      stepIdx: r.step_idx == null ? null : Number(r.step_idx),
      body: String(r.body ?? ''),
      build: r.build == null ? null : Number(r.build),
      createdAt: Date.parse(String(r.created_at)),
    }));
  }

  async adminFeedbackReview(id: number, note: string, status: FeedbackStatus, useful: boolean): Promise<void> {
    const { error } = await this.client.rpc('admin_feedback_review', { p_id: id, p_note: note, p_status: status, p_useful: useful });
    if (error) {
      if (this.missing(error)) throw new Error('not_ready');
      this.fail(error);
    }
  }

  // Автора й нік події підставляє тригер events_fill (migrations/0005); помилки глушимо: аналітика не повинна ламати урок
  async trackEvent(name: string, props?: Record<string, unknown>): Promise<void> {
    try {
      await this.client.from('events').insert({ name, props: props ?? null, build: UI_BUILD });
    } catch {
      // без мережі подію просто втрачаємо
    }
  }

  async adminEvents(): Promise<EventRow[]> {
    const { data, error } = await this.client.from('events').select('*').order('created_at', { ascending: false }).limit(5000);
    if (error) this.fail(error);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      username: String(r.username ?? ''),
      name: String(r.name),
      props: (r.props as Record<string, unknown> | null) ?? null,
      build: r.build == null ? null : Number(r.build),
      createdAt: Date.parse(String(r.created_at)),
    }));
  }

  async adminTesters(): Promise<TesterRow[]> {
    const { data, error } = await this.client.rpc('admin_testers');
    if (error) this.fail(error);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      username: String(r.username),
      name: String(r.display_name || r.username),
      status: r.status as TesterRow['status'],
      isAdmin: !!r.is_admin,
      lastLoginAt: r.last_login_ms == null ? null : Number(r.last_login_ms),
      inviteIssuedAt: r.invite_issued_ms == null ? null : Number(r.invite_issued_ms),
    }));
  }

  async adminAddTester(username: string, name: string): Promise<void> {
    const { error } = await this.client.rpc('admin_add_tester', { p_username: username, p_name: name });
    if (error) this.fail(error);
  }

  async adminSetStatus(id: string, status: 'active' | 'blocked'): Promise<void> {
    const { error } = await this.client.rpc('admin_set_status', { p_id: id, p_status: status });
    if (error) this.fail(error);
  }

  async adminIssueInvite(username: string): Promise<string> {
    const { data, error } = await this.client.rpc('issue_invite', { p_username: username });
    if (error) this.fail(error);
    return String(data);
  }
}
