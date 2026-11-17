// Синхронізація прогресу (ТЗ-01): підсумковий стан формує СЕРВЕР, клієнт надсилає операції.
//  • Кожна зміна серверного ядра (урок, відповіді, енергія, покупка, завдання дня, симулятор) це операція з унікальним opId.
//    Операція спершу записується в чергу на пристрої (окрему для кожної учётки) і лише потім відправляється.
//  • З черги операція знімається ЛИШЕ за відповіддю сервера. Повтор: одразу, при події online, поверненні у вкладку,
//    запуску, повторному вході й за таймером. Відправка при згортанні це додаткова спроба.
//  • Черга йде порціями (shared/progressOps.syncQueue: межі BATCH_MAX_OPS / BATCH_MAX_BYTES), послідовно, кожна з актуальною версією.
//  • Після відповіді беремо серверне ядро й заново накладаємо операції, що лишилися в черзі (створені, поки запит був у дорозі).
//  • Решта стану (налаштування, персонаж, історія…) йде клієнтським знімком з останньою порцією; при конфлікті знімки обʼєднуються.
//  • Поки сервер у режимі старого запису (або міграції ще немає), відповідь not_active: операції чекають у черзі.
import { create } from 'zustand';
import { useStore } from '../store';
import { levelForXp } from '../data/levels';
import { POINTS_PER_LEVEL } from '../data/stats';
import { setOpSink } from './opBus';
import { legacyOps, mergeClientState, replay, staleInfo, syncQueue } from './shared/progressOps';
import type { Op, SyncBase, SyncState } from './shared/progressOps';
import { localKv } from './storage';
import type { CloudBackend, CloudUser } from './types';

const META_KEY = 'grindset-cloud-meta'; // чиї дані лежать на пристрої (мітка власника)
const queueKey = (uid: string) => `grindset-opq:${uid}`;
const deadKey = (uid: string) => `grindset-opq-dead:${uid}`; // операції, які сервер не може прийняти через ліміт розміру
const syncKey = (uid: string) => `grindset-sync:${uid}`;

type SyncMeta = { rev: number; dirty: boolean; migrated: boolean; base: SyncBase | null };
const FRESH_META: SyncMeta = { rev: 0, dirty: false, migrated: false, base: null };

async function readJson<T>(key: string, def: T): Promise<T> {
  try {
    const raw = await localKv.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // пошкоджений запис: беремо типове значення
  }
  return def;
}

// Стан без функцій і без службового прапора hydrated
function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(useStore.getState())) if (typeof v !== 'function' && k !== 'hydrated') out[k] = v;
  return out;
}

function whenHydrated(): Promise<void> {
  if (useStore.getState().hydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const un = useStore.subscribe((s) => {
      if (s.hydrated) {
        un();
        resolve();
      }
    });
  });
}

// Готовність прогресу після входу: стартовий екран чекає на неї, щоб чистий пристрій не відкрив онбординг як новий користувач,
// коли на сервері вже є прогрес (ТЗ 004, CS2). Без мережі або при довгій відповіді готовність настає за READY_TIMEOUT_MS.
export const useSyncReady = create<{ ready: boolean }>(() => ({ ready: false }));
const READY_TIMEOUT_MS = 8000;
let readyTimer: ReturnType<typeof setTimeout> | null = null;
function markReady() {
  if (readyTimer) clearTimeout(readyTimer);
  readyTimer = null;
  useSyncReady.setState({ ready: true });
}

type Ctx = { backend: CloudBackend; user: CloudUser; onReplaced: () => void };
let ctx: Ctx | null = null;
// S: черга, версія й останнє серверне ядро (спільний обʼєкт із циклом відправки syncQueue)
let S: SyncState = { queue: [], rev: 0, base: null, dead: [] };
let dirty = false; // клієнтський знімок змінився й ще не збережений на сервері
let migrated = false;
let busy = false;
let again = false;
let applying = false; // ми самі пишемо у стор: це не зміна від гравця
let stateSeq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubStore: (() => void) | null = null;
let detach: (() => void) | null = null;
let writes: Promise<void> = Promise.resolve();
const lastEvent: Record<string, number> = {};

// Записи черги йдуть строго по порядку; проміс відхиляється, якщо сховище пристрою відмовило
function persistQueue(uid: string): Promise<void> {
  const body = JSON.stringify(S.queue);
  const next = writes.catch(() => undefined).then(() => localKv.set(queueKey(uid), body));
  writes = next;
  return next;
}
const persistMeta = (uid: string) => {
  const meta: SyncMeta = { rev: S.rev, dirty, migrated, base: S.base };
  return localKv.set(syncKey(uid), JSON.stringify(meta)).catch(() => undefined);
};

function event(name: 'sync_error' | 'sync_queue_stale', key: string, props: Record<string, unknown>, gapMs: number) {
  const now = Date.now();
  if (!ctx || now - (lastEvent[key] ?? 0) < gapMs) return;
  lastEvent[key] = now;
  void ctx.backend.trackEvent(name, props); // без персональних даних: лише код і лічильники (збірку додає бекенд)
}

// Серверне ядро + черга = те, що бачить учень. Рівень і очки характеристик рахуються із серверного XP.
function applyVisible(clientState: Record<string, unknown> | null) {
  if (!S.base) return;
  const v = replay(S.base.core, S.base.rewarded, S.queue, S.base.pristine);
  applying = true;
  try {
    if (clientState) {
      useStore.setState({ ...(clientState as object), hydrated: true });
      const lang = clientState.lang;
      if (lang === 'uk' || lang === 'en' || lang === 'ru') useStore.getState().setLang(lang);
    }
    const s = useStore.getState();
    const level = levelForXp(v.core.xp);
    const spent = Object.values(s.stats).reduce((a, b) => a + (b ?? 0), 0);
    useStore.setState({ ...v.core, level, statPoints: Math.max(0, (level - 1) * POINTS_PER_LEVEL - spent) });
  } finally {
    applying = false;
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

async function enqueue(op: Op): Promise<void> {
  if (!ctx) return;
  S.queue.push(op);
  await persistQueue(ctx.user.id); // урок вважається записаним лише після цього
  void flush();
}

// Повторити запис черги (кнопка «Повторити» на екрані результату)
export async function retryLocalWrite(): Promise<void> {
  if (!ctx) return;
  await persistQueue(ctx.user.id);
  void flush();
}

export async function flush(): Promise<void> {
  const my = ctx;
  if (!my) return;
  if (busy) {
    again = true;
    return;
  }
  if (S.queue.length === 0 && !dirty) return;
  busy = true;
  const uid = my.user.id;
  const live = S; // вихід з акаунта підміняє S: цей запит тоді працює зі своїм знімком і нічого спільного не чіпає
  try {
    const st = staleInfo(live.queue, Date.now());
    if (st.stale) event('sync_queue_stale', 'stale', { ops: st.ops, minutes: st.oldestMin }, 10 * 60 * 1000);
    let seq = stateSeq;
    const out = await syncQueue(live, {
      send: (baseRev, ops, clientState) => my.backend.saveProgressV2(baseRev, ops, clientState),
      snapshot: () => {
        if (!dirty || ctx !== my) return null;
        seq = stateSeq;
        return snapshot();
      },
      afterPortion: async () => {
        if (ctx !== my || S !== live) return;
        await persistQueue(uid);
        applyVisible(null); // серверне ядро + те, що ще в черзі
        await persistMeta(uid);
      },
    });
    if (ctx !== my || S !== live) return; // вийшли з акаунта, поки запит був у дорозі: черга лишилась на пристрої, повтор безпечний
    if (out.quarantined) {
      await localKv.set(deadKey(uid), JSON.stringify(live.dead)).catch(() => undefined);
      event('sync_error', 'quarantine', { code: 'op_too_large', ops: out.quarantined }, 5 * 60 * 1000);
    }
    if (out.status === 'not_active') {
      schedule(60000);
      return;
    }
    if (out.snapshot === 'conflict' && out.conflictState) {
      // знімок зі старою версією нічого не затер: обʼєднуємо й відправляємо знову вже з новою версією
      applyVisible(mergeClientState(snapshot(), out.conflictState));
      dirty = true;
      again = true;
    } else if (out.snapshot === 'saved' && seq === stateSeq) {
      dirty = false;
    } else if (out.snapshot === 'too_large') {
      // знімок завеликий для сервера: операції пішли, знімок чекає, поки стан зменшиться (напр. фото профілю)
      event('sync_error', 'snapshot', { code: 'state_too_large' }, 30 * 60 * 1000);
      dirty = false;
    }
    await persistMeta(uid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    if (msg === 'replaced') {
      my.onReplaced();
      return;
    }
    event('sync_error', `err:${msg.slice(0, 20)}`, { code: msg.replace(/[^A-Za-z0-9_ .:-]/g, '').slice(0, 40) }, 5 * 60 * 1000);
    if (ctx === my) schedule(20000);
  } finally {
    busy = false;
    if (again && ctx === my) {
      again = false;
      void flush();
    } else if (ctx === my && S.queue.length > 0 && !timer) schedule(20000);
  }
}

export async function startProgressSync(backend: CloudBackend, user: CloudUser, onReplaced: () => void): Promise<void> {
  await stopProgressSync();
  useSyncReady.setState({ ready: false });
  readyTimer = setTimeout(markReady, READY_TIMEOUT_MS);
  const my: Ctx = { backend, user, onReplaced };
  await whenHydrated();
  const owner = (await readJson<{ userId: string | null }>(META_KEY, { userId: null })).userId;
  const mine = owner === user.id;
  const preLogin = setOpSink(null); // операції, створені до входу
  // Чужі дані на пристрої (інша учётка або дані без мітки з прогресом): локальний стан прибираємо.
  // Черга попередньої учётки лежить під ЇЇ ключем і не чіпається: відправиться, коли та учётка повернеться.
  if (!mine && (owner || useStore.getState().completed.length > 0)) {
    applying = true;
    useStore.getState().reset();
    applying = false;
  }
  const meta = { ...FRESH_META, ...(await readJson<Partial<SyncMeta>>(syncKey(user.id), {})) };
  S = {
    queue: await readJson<Op[]>(queueKey(user.id), []),
    rev: meta.rev,
    base: meta.base,
    dead: await readJson<Op[]>(deadKey(user.id), []),
  };
  dirty = meta.dirty;
  migrated = meta.migrated;
  if (mine && preLogin.length) S.queue.push(...preLogin);
  ctx = my;
  setOpSink(enqueue);
  try {
    await persistQueue(user.id);
    await localKv.set(META_KEY, JSON.stringify({ userId: user.id }));
  } catch {
    // сховище недоступне: працюємо з памʼяті, запис уроку повідомить про помилку окремо
  }

  try {
    const srv = await backend.loadProgressV2();
    if (ctx !== my) return;
    if (!migrated) {
      // один раз на учётку й пристрій: перенесення даних, створених до оновлення
      if (S.queue.length === 0) {
        const ops = legacyOps(user.id, owner, snapshot(), srv, Date.now());
        if (ops.length) {
          S.queue.push(...ops);
          await persistQueue(user.id);
          dirty = true; // на пристрої є новіше за серверне: клієнтський знімок теж відправимо
        }
      }
      migrated = true;
    }
    S.base = { core: srv.core, rewarded: srv.rewarded, pristine: !srv.exists };
    S.rev = srv.rev;
    // клієнтську частину беремо із сервера, якщо на пристрої немає невідправлених змін цієї учётки
    applyVisible(mine && dirty ? null : srv.state);
    markReady();
    await persistMeta(user.id);
  } catch (e) {
    if (ctx !== my) return;
    if (e instanceof Error && e.message === 'replaced') {
      onReplaced();
      return;
    }
    // немає мережі при запуску: показуємо локальний стан, черга відправиться пізніше
    if (S.base && mine) applyVisible(null);
    markReady();
    event('sync_error', 'load', { code: 'load_failed' }, 5 * 60 * 1000);
  }

  unsubStore = useStore.subscribe(() => {
    if (applying) return;
    stateSeq += 1;
    dirty = true;
    if (!timer) schedule(1500);
  });
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof document !== 'undefined') {
    const kick = () => void flush();
    window.addEventListener('online', kick);
    window.addEventListener('pagehide', kick);
    document.addEventListener('visibilitychange', kick); // і повернення у вкладку, і згортання (додаткова спроба)
    detach = () => {
      window.removeEventListener('online', kick);
      window.removeEventListener('pagehide', kick);
      document.removeEventListener('visibilitychange', kick);
    };
  }
  void flush();
}

// flushFirst = true: перед виходом спробувати відправити чергу. Невідправлене лишається на пристрої під ключем учётки.
export async function stopProgressSync(flushFirst = false): Promise<void> {
  useSyncReady.setState({ ready: false });
  if (readyTimer) clearTimeout(readyTimer);
  readyTimer = null;
  if (flushFirst && ctx) {
    if (timer) clearTimeout(timer);
    timer = null;
    await flush().catch(() => undefined);
  }
  if (unsubStore) unsubStore();
  unsubStore = null;
  if (detach) detach();
  detach = null;
  if (timer) clearTimeout(timer);
  timer = null;
  if (ctx) {
    await persistMeta(ctx.user.id);
    setOpSink(null);
  }
  ctx = null;
  S = { queue: [], rev: 0, base: null, dead: [] };
  dirty = false;
  migrated = false;
  again = false;
}
