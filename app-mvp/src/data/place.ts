// «Продовжити» (ТЗ 004, етап E): останнє місце гравця — урок і крок, крок тренажера, стаття «Бази» з поверненням.
// Місце живе на пристрої (persist) і в клієнтському знімку; між пристроями перемагає новіший запис. Чисті функції — під автотести.
import { branchCodeOf, nextUnit, type BranchProg } from './branchRules.ts';

export type LessonPlace = {
  kind: 'lesson';
  id: string; // ID одиниці гілки (урок, практика, фінал, самоперевірка)
  idx: number; // крок, з якого продовжити
  total: number;
  results: { lessonId: string; idx: number; ok: boolean }[]; // відповіді до цього кроку (для оцінки фіналу й точності)
  chosen: Record<number, number>; // обрані варіанти (блок «запускати» у фіналі)
  correct: number;
  errors: number;
  title: string;
  at: number;
};
export type SimPlace = { kind: 'sim'; id: string; step: number; total: number; title: string; at: number };
export type KbPlace = { kind: 'kb'; id: string; title: string; back?: LessonPlace | SimPlace; at: number };
export type Place = LessonPlace | SimPlace | KbPlace;


// Злиття між пристроями: новіший запис перемагає; null («місця немає») з новішою позначкою теж перемагає
export type PlaceBox = { place: Place | null; lastBranch: string | null; at: number };
export const PLACE_FRESH: PlaceBox = { place: null, lastBranch: null, at: 0 };

export function mergePlace(local: unknown, server: unknown): PlaceBox {
  const ok = (v: unknown): v is PlaceBox => !!v && typeof v === 'object' && typeof (v as PlaceBox).at === 'number';
  const l = ok(local) ? local : undefined;
  const s = ok(server) ? server : undefined;
  if (!l) return s ?? PLACE_FRESH;
  if (!s) return l;
  return l.at >= s.at ? l : s;
}

// Збереження кроку уроку, практики, фіналу й самоперевірки (ТЗ 006, 2.2: самоперевірка теж — гілка, питання й відповіді).
// Нагород і зарахування місце не дає: їх рахує лише завершення одиниці.
export function lessonPlace(p: Omit<LessonPlace, 'kind' | 'at'>, now: number): LessonPlace | null {
  if (p.idx <= 0 || p.idx >= p.total) return null;
  return { kind: 'lesson', ...p, at: now };
}

// Чи відновлювати урок з місця (той самий ID і крок у межах уроку)
export function resumeFor(box: PlaceBox | undefined, id: string, total: number): LessonPlace | null {
  const p = box?.place;
  if (!p || p.kind !== 'lesson' || p.id !== id) return null;
  if (p.idx < 0 || p.idx >= total) return null;
  return p;
}

// Що показати на кнопці «Продовжити»: місце, або наступна одиниця останньої гілки
export type ContinueTarget =
  | { kind: 'lesson'; id: string; label: string; step?: string }
  | { kind: 'sim'; label: string; step: string }
  | { kind: 'kb'; id: string; label: string; back?: string }
  | { kind: 'branch'; code: string; label: string };

export function continueTarget(
  box: PlaceBox | undefined,
  ctx: { completed: string[]; branchProg: Record<string, BranchProg | undefined>; ready: (code: string) => string[]; hasFinal: (code: string) => boolean; title: (id: string) => string | undefined; branchTitle: (code: string) => string | undefined }
): ContinueTarget | null {
  const p = box?.place;
  if (p?.kind === 'lesson') return { kind: 'lesson', id: p.id, label: p.title, step: `крок ${p.idx + 1} з ${p.total}` };
  if (p?.kind === 'sim') return { kind: 'sim', label: p.title, step: `крок ${p.step + 1} з ${p.total}` };
  if (p?.kind === 'kb') return { kind: 'kb', id: p.id, label: p.title, back: p.back ? p.back.title : undefined };
  const code = box?.lastBranch;
  if (!code) return null;
  // наступна одиниця гілки; якщо практика й фінал уже пройдені — перший непройдений урок (гілку не вважаємо пройденою)
  const next = nextUnit(code, ctx.completed, ctx.branchProg[code], ctx.ready(code), ctx.hasFinal(code)) ?? ctx.ready(code).find((id) => !ctx.completed.includes(id)) ?? null;
  if (next) return { kind: 'lesson', id: next, label: ctx.title(next) ?? next };
  return { kind: 'branch', code, label: ctx.branchTitle(code) ?? code };
}

export const placeBranch = (p: Place | null): string | null => (p && p.kind !== 'kb' ? branchCodeOf(p.id) : p?.back ? branchCodeOf(p.back.id) : null);
