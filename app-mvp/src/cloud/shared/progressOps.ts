// Надійне збереження прогресу (ТЗ-01): чиста логіка операцій. Без імпортів, перевіряється автотестами (supabase/tests/progressOps.test.ts).
// Правила дзеркалять SQL-функцію save_progress_v2 (supabase/migrations/0007_progress_v2.sql): клієнт цими ж правилами
// показує результат учневі одразу, а після відповіді сервера бере серверне ядро й заново накладає операції, що ще в черзі.

// ───────── Серверне ядро ─────────
export type Core = {
  completed: string[];
  coins: number;
  xp: number;
  totalCoinsEarned: number;
  answersTotal: number;
  answersCorrect: number;
  energy: number;
  energyAt: number;
  hints: number;
  comboShields: number;
  doubleCoins: number;
  frames: string[];
  streakFreezes: number;
  purchases: number;
};
export const CORE_KEYS = ['completed', 'coins', 'xp', 'totalCoinsEarned', 'answersTotal', 'answersCorrect', 'energy', 'energyAt', 'hints', 'comboShields', 'doubleCoins', 'frames', 'streakFreezes', 'purchases'] as const;

const int = (v: unknown, def: number, lo: number, hi: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,15}(\.\d+)?$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : def;
};
const texts = (v: unknown): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x.length >= 1 && x.length <= 64 && !out.includes(x)) out.push(x);
  return out;
};
const union = (a: string[], b: string[]): string[] => [...a, ...b.filter((x, i) => !a.includes(x) && b.indexOf(x) === i)];

// Ядро з повного знімка стану (ті самі межі, що в progress_core_from_state)
export function coreOf(state: Record<string, unknown> | null | undefined): Core {
  const s = state ?? {};
  const answersTotal = int(s.answersTotal, 0, 0, 99999999);
  return {
    completed: texts(s.completed),
    coins: int(s.coins, 0, 0, 1e9),
    xp: int(s.xp, 0, 0, 1e9),
    totalCoinsEarned: int(s.totalCoinsEarned, 0, 0, 1e9),
    answersTotal,
    answersCorrect: Math.min(int(s.answersCorrect, 0, 0, 99999999), answersTotal),
    energy: int(s.energy, 50, 0, 50),
    energyAt: int(s.energyAt, 0, 0, 9e15),
    hints: int(s.hints, 0, 0, 100000),
    comboShields: int(s.comboShields, 0, 0, 100000),
    doubleCoins: int(s.doubleCoins, 0, 0, 1),
    frames: texts(s.frames),
    streakFreezes: int(s.streakFreezes, 0, 0, 2),
    purchases: int(s.purchases, 0, 0, 1e8),
  };
}

// ───────── Операції ─────────
export type OpKind = 'lesson' | 'answers' | 'energy' | 'spend' | 'quest' | 'sim' | 'use' | 'skip' | 'init';
export type Op = {
  opId: string; // унікальний; для перенесення постійний: legacy:<учётка>:<урок>, legacy-init:<учётка>
  kind: OpKind;
  at: number; // мс: коли створено на пристрої (для sync_queue_stale)
  lessonId?: string;
  xp?: number;
  coins?: number;
  doubled?: boolean; // витрачено бустер X2
  freezeUsed?: boolean; // стрік врятувала заморозка
  repeatable?: boolean; // тренування / надолуження помилок: не урок курсу, нараховується щоразу
  total?: number;
  correct?: number;
  energy?: number;
  energyAt?: number;
  cost?: number;
  item?: string;
  lessons?: string[];
  state?: Record<string, unknown>;
};
export type OpStatus = 'applied' | 'already_rewarded' | 'rejected_no_coins' | 'rejected_invalid' | 'rejected_exists';
export type OpResult = { opId: string | null; status: OpStatus; duplicate: boolean };

export function newOpId(prefix = 'op'): string {
  const rnd = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

const nat = (v: unknown, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
const ITEM_RE = /^(energy10|energy20|energyFull|freeze|shield3|hint3|double|frame_[A-Za-z0-9_-]{1,40})$/;

// Одна операція поверх ядра. pristine: на сервері ще нічого не було (лише тоді дозволено init).
export function applyOp(core: Core, rewarded: string[], op: Op, pristine = false): { core: Core; rewarded: string[]; status: OpStatus } {
  const c: Core = { ...core };
  let rw = rewarded;
  let status: OpStatus = 'applied';
  const bad = () => ({ core, rewarded, status: 'rejected_invalid' as OpStatus });
  switch (op.kind) {
    case 'lesson': {
      const xp = nat(op.xp, 10000);
      const coins = nat(op.coins, 100000);
      if (typeof op.lessonId !== 'string' || !/^[A-Za-z0-9_:.-]{1,64}$/.test(op.lessonId) || xp === null || coins === null) return bad();
      if (op.repeatable === true) {
        c.xp += xp;
        c.coins += coins;
        c.totalCoinsEarned += coins;
      } else if (rw.includes(op.lessonId)) {
        status = 'already_rewarded';
        if (!c.completed.includes(op.lessonId)) c.completed = [...c.completed, op.lessonId];
      } else {
        rw = [...rw, op.lessonId];
        if (!c.completed.includes(op.lessonId)) c.completed = [...c.completed, op.lessonId];
        c.xp += xp;
        c.coins += coins;
        c.totalCoinsEarned += coins;
        if (op.doubled === true) c.doubleCoins = Math.max(0, c.doubleCoins - 1);
        if (op.freezeUsed === true) c.streakFreezes = Math.max(0, c.streakFreezes - 1);
      }
      break;
    }
    case 'answers': {
      const total = nat(op.total, 1000);
      const correct = nat(op.correct, 1000);
      if (total === null || correct === null || correct > total) return bad();
      c.answersTotal = Math.min(99999999, c.answersTotal + total);
      c.answersCorrect = Math.min(99999999, c.answersCorrect + correct);
      break;
    }
    case 'energy': {
      const energy = nat(op.energy, 50);
      const energyAt = nat(op.energyAt, 9e15);
      if (energy === null || energyAt === null) return bad();
      c.energy = energy;
      c.energyAt = energyAt;
      break;
    }
    case 'spend': {
      const cost = nat(op.cost, 1e7);
      if (cost === null || typeof op.item !== 'string' || !ITEM_RE.test(op.item)) return bad();
      if (c.coins < cost) return { core, rewarded, status: 'rejected_no_coins' };
      c.coins -= cost;
      c.purchases += 1;
      if (op.item === 'energy10') c.energy = Math.min(50, c.energy + 10);
      else if (op.item === 'energy20') c.energy = Math.min(50, c.energy + 20);
      else if (op.item === 'energyFull') c.energy = 50;
      else if (op.item === 'freeze') c.streakFreezes = Math.min(2, c.streakFreezes + 1);
      else if (op.item === 'shield3') c.comboShields += 3;
      else if (op.item === 'hint3') c.hints += 3;
      else if (op.item === 'double') c.doubleCoins = 1;
      else c.frames = union(c.frames, [op.item.slice(6)]);
      break;
    }
    case 'quest': {
      const coins = nat(op.coins, 100000);
      if (coins === null) return bad();
      c.coins += coins;
      c.totalCoinsEarned += coins;
      break;
    }
    case 'sim': {
      const xp = nat(op.xp, 10000);
      const coins = nat(op.coins, 100000);
      if (xp === null || coins === null) return bad();
      c.xp += xp;
      c.coins += coins;
      c.totalCoinsEarned += coins;
      break;
    }
    case 'use':
      if (op.item === 'hint') c.hints = Math.max(0, c.hints - 1);
      else if (op.item === 'shield') c.comboShields = Math.max(0, c.comboShields - 1);
      else return bad();
      break;
    case 'skip':
      if (!Array.isArray(op.lessons) || op.lessons.length > 400) return bad();
      c.completed = union(c.completed, texts(op.lessons));
      break;
    case 'init': {
      if (!op.state || typeof op.state !== 'object' || Array.isArray(op.state)) return bad();
      if (!pristine) return { core, rewarded, status: 'rejected_exists' };
      const fresh = coreOf(op.state);
      return { core: fresh, rewarded: [...fresh.completed], status: 'applied' };
    }
    default:
      return bad();
  }
  return { core: c, rewarded: rw, status };
}

// Серверне ядро + операції, що ще в черзі (створені, поки запит був у дорозі): це те, що бачить учень
export function replay(core: Core, rewarded: string[], ops: Op[], pristine = false): { core: Core; rewarded: string[] } {
  let c = core;
  let rw = rewarded;
  let first = pristine;
  for (const op of ops) {
    const r = applyOp(c, rw, op, first);
    c = r.core;
    rw = r.rewarded;
    first = false;
  }
  return { core: c, rewarded: rw };
}

// Операція знімається з черги ЛИШЕ за відповіддю сервера з остаточним підсумком
export function settle(queue: Op[], results: OpResult[]): Op[] {
  const done = new Set(results.filter((r) => r.opId).map((r) => r.opId as string));
  return queue.filter((op) => !done.has(op.opId));
}

export const STALE_MS = 10 * 60 * 1000;
export function staleInfo(queue: Op[], now: number): { stale: boolean; ops: number; oldestMin: number } {
  const oldest = queue.reduce((m, op) => Math.min(m, op.at || now), now);
  return { stale: queue.length > 0 && now - oldest > STALE_MS, ops: queue.length, oldestMin: Math.round((now - oldest) / 60000) };
}

// ───────── Відповіді сервера ─────────
export type LoadV2 = { mode: 'legacy' | 'v2'; exists: boolean; rev: number; core: Core; rewarded: string[]; state: Record<string, unknown> | null };
export type SaveV2 =
  | { status: 'not_active' } // старий спосіб ще активний (або міграції ще немає): операції лишаються в черзі
  | { status: 'ok'; rev: number; core: Core; rewarded: string[]; clientState: Record<string, unknown>; clientStateStatus: 'none' | 'saved' | 'client_state_conflict' | 'rejected_invalid'; ops: OpResult[] };

// ───────── Перенесення даних, створених до оновлення (розділ 3 ТЗ) ─────────
// ownerId: чия мітка стоїть на локальних даних. Без мітки або з чужою міткою нічого не переноситься й не відправляється.
// Сервер порожній → одна операція legacy-init:<учётка> (початковий стан створюється один раз: другий пристрій отримає той самий підсумок).
// Далі для кожного локально пройденого уроку операція legacy:<учётка>:<урок> з нагородою з локальної історії (перше проходження);
// немає запису в історії → урок переноситься без нагороди. Постійні opId: два пристрої однієї учётки не нарахують нагороду двічі.
export function legacyOps(userId: string, ownerId: string | null, local: Record<string, unknown>, server: { exists: boolean; core: Core }, now: number): Op[] {
  if (!ownerId || ownerId !== userId) return [];
  const mine = coreOf(local);
  const ops: Op[] = [];
  if (!server.exists) {
    if (mine.completed.length === 0 && mine.xp === 0 && mine.coins === 0 && mine.answersTotal === 0) return [];
    ops.push({ opId: `legacy-init:${userId}`, kind: 'init', at: now, state: { ...mine } });
  }
  const history = Array.isArray(local.history) ? (local.history as { id?: unknown; xp?: unknown; coins?: unknown }[]) : [];
  for (const lessonId of mine.completed) {
    if (server.exists && server.core.completed.includes(lessonId)) continue;
    if (!/^[A-Za-z0-9_:.-]{1,64}$/.test(lessonId)) continue;
    let first: { xp?: unknown; coins?: unknown } | null = null;
    for (const h of history) if (h && h.id === lessonId) first = h; // історія йде від нових до старих: останній збіг = перше проходження
    ops.push({ opId: `legacy:${userId}:${lessonId}`, kind: 'lesson', at: now, lessonId, xp: int(first?.xp, 0, 0, 10000), coins: int(first?.coins, 0, 0, 100000) });
  }
  return ops;
}

// ───────── Конфлікт клієнтського знімка ─────────
// Скалярні налаштування: останній запис (локальний, бо саме його щойно змінили на цьому пристрої); списки й словники: обʼєднання.
// Поля ядра не чіпаємо: їх накладає сервер.
export function mergeClientState(local: Record<string, unknown>, server: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...server, ...local };
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const byKey = (a: Record<string, unknown>[], b: Record<string, unknown>[], key: (x: Record<string, unknown>) => string) => {
    const seen = new Set<string>();
    return [...a, ...b].filter((x) => x && typeof x === 'object' && !seen.has(key(x)) && !!seen.add(key(x)));
  };
  out.history = byKey(arr(local.history), arr(server.history), (h) => `${h.id}|${h.date}`)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 60);
  out.mistakes = byKey(arr(local.mistakes), arr(server.mistakes), (m) => `${m.lessonId}|${m.idx}`).slice(0, 80);
  out.campaigns = byKey(arr(local.campaigns), arr(server.campaigns), (c) => String(c.id));
  out.unlocked = union(texts(local.unlocked), texts(server.unlocked));
  if (local.questsDate === server.questsDate) out.questsClaimed = union(texts(local.questsClaimed), texts(server.questsClaimed));
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  out.srs = { ...obj(server.srs), ...obj(local.srs) };
  out.quiz = { ...obj(server.quiz), ...obj(local.quiz) };
  return out;
}

// ───────── Імітація сервера (режим mock і автотести клієнтської логіки) ─────────
export type SimRow = { state: Record<string, unknown>; rev: number; core: Core; rewarded: string[]; journal: Record<string, OpStatus> };

export function simLoad(mode: 'legacy' | 'v2', row: SimRow | null): LoadV2 {
  if (!row) return { mode, exists: false, rev: 0, core: coreOf({}), rewarded: [], state: null };
  const core = mode === 'v2' ? row.core : coreOf(row.state);
  return { mode, exists: true, rev: row.rev, core, rewarded: mode === 'v2' ? row.rewarded : union(row.rewarded, core.completed), state: row.state };
}

export function simSave(mode: 'legacy' | 'v2', row: SimRow | null, baseRev: number, ops: Op[], clientState: Record<string, unknown> | null): { row: SimRow | null; res: SaveV2 } {
  if (mode !== 'v2') return { row, res: { status: 'not_active' } };
  const pristine = !row;
  const cur: SimRow = row ? { ...row, journal: { ...row.journal } } : { state: {}, rev: 0, core: coreOf({}), rewarded: [], journal: {} };
  let changed = false;
  const results: OpResult[] = [];
  for (const op of ops) {
    if (!op || typeof op.opId !== 'string' || op.opId.length < 1 || op.opId.length > 160) {
      results.push({ opId: null, status: 'rejected_invalid', duplicate: false });
      continue;
    }
    const prev = cur.journal[op.opId];
    if (prev) {
      results.push({ opId: op.opId, status: prev, duplicate: true });
      continue;
    }
    const r = applyOp(cur.core, cur.rewarded, op, pristine && !changed);
    cur.core = r.core;
    cur.rewarded = r.rewarded;
    cur.journal[op.opId] = r.status;
    changed = true;
    results.push({ opId: op.opId, status: r.status, duplicate: false });
  }
  let clientStateStatus: 'none' | 'saved' | 'client_state_conflict' = 'none';
  let state = cur.state;
  if (clientState) {
    if (baseRev === cur.rev) {
      state = clientState;
      clientStateStatus = 'saved';
      changed = true;
    } else clientStateStatus = 'client_state_conflict';
  }
  if (changed) {
    cur.rev += 1;
    cur.state = { ...state, ...cur.core };
  }
  return { row: changed || row ? cur : null, res: { status: 'ok', rev: cur.rev, core: cur.core, rewarded: cur.rewarded, clientState: cur.state, clientStateStatus, ops: results } };
}
