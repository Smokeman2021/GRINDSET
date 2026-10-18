// Синхронізація прогресу гравця: увесь стан одним JSON. Зберігаємо на сервері при кожному завершенні уроку (з коротким відкладенням),
// при вході вирішуємо, чию версію брати (shared/access.chooseProgress). Нарахування (коїни, XP) лишаються на клієнті.
import { useStore } from '../store';
import { chooseProgress } from './shared/access';
import { localKv } from './storage';
import type { CloudBackend, CloudUser } from './types';

const META_KEY = 'grindset-cloud-meta';
type Meta = { userId: string | null; updatedAt: number | null };

async function readMeta(): Promise<Meta> {
  try {
    const raw = await localKv.get(META_KEY);
    if (raw) return JSON.parse(raw) as Meta;
  } catch {
    // ігноруємо пошкоджену мітку
  }
  return { userId: null, updatedAt: null };
}

const writeMeta = (m: Meta) => localKv.set(META_KEY, JSON.stringify(m));

// Стан без функцій і без службового прапора hydrated
function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(useStore.getState())) if (typeof v !== 'function' && k !== 'hydrated') out[k] = v;
  return out;
}

function whenHydrated(): Promise<void> {
  if (useStore.getState().hydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useStore.subscribe((s) => {
      if (s.hydrated) {
        unsub();
        resolve();
      }
    });
  });
}

function applyServer(state: Record<string, unknown>) {
  useStore.setState({ ...(state as object), hydrated: true });
  const lang = state.lang;
  if (lang === 'uk' || lang === 'en' || lang === 'ru') useStore.getState().setLang(lang);
}

let unsub: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let ctx: { backend: CloudBackend; user: CloudUser; onReplaced: () => void } | null = null;

async function push() {
  if (!ctx) return;
  const { backend, user, onReplaced } = ctx;
  try {
    const { updatedAt } = await backend.saveProgress(snapshot());
    await writeMeta({ userId: user.id, updatedAt });
  } catch (e) {
    if (e instanceof Error && e.message === 'replaced') onReplaced();
    // інші збої (нема мережі) мовчки: повторимо при наступному завершенні уроку
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void push();
  }, 1200);
}

export async function startProgressSync(backend: CloudBackend, user: CloudUser, onReplaced: () => void): Promise<void> {
  stopProgressSync();
  ctx = { backend, user, onReplaced };
  await whenHydrated();
  try {
    const server = await backend.loadProgress();
    const meta = await readMeta();
    const completedOf = (s: Record<string, unknown> | undefined) => (Array.isArray(s?.completed) ? (s!.completed as unknown[]).length : 0);
    const choice = chooseProgress({
      localUserId: meta.userId,
      localUpdatedAt: meta.updatedAt,
      userId: user.id,
      serverUpdatedAt: server?.updatedAt ?? null,
      localCompleted: useStore.getState().completed.length,
      serverCompleted: completedOf(server?.state),
    });
    if (choice === 'pull_reset') {
      useStore.getState().reset();
      if (server) applyServer(server.state);
      await writeMeta({ userId: user.id, updatedAt: server?.updatedAt ?? null });
    } else if (choice === 'pull' && server) {
      applyServer(server.state);
      await writeMeta({ userId: user.id, updatedAt: server.updatedAt });
    } else if (choice === 'push') {
      await push();
    } else {
      await writeMeta({ userId: user.id, updatedAt: meta.updatedAt });
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'replaced') {
      onReplaced();
      return;
    }
  }
  unsub = useStore.subscribe((s, prev) => {
    if (s.completed.length > prev.completed.length) schedule();
  });
}

// flush = true: перед виходом відправити відкладену зміну
export async function stopProgressSync(flush = false): Promise<void> {
  if (unsub) unsub();
  unsub = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
    if (flush) await push();
  }
  ctx = null;
}
