// Правила гілок: тип одиниці, нагорода й відкриття фіналу.
// (supabase/tests/branches.test.ts). Сервер (save_progress_v2) окремо гарантує «один урок — одна нагорода» за lessonId.

import { academyModuleCount, academyUnits, isAcademyCode, moduleLessonId, moduleOverviewId } from './academyIds.ts';

export type UnitKind = 'selfcheck' | 'practice' | 'lesson' | 'final';
export type FinalPart = 'decision' | 'data' | 'next';
export const FINAL_PARTS: FinalPart[] = ['decision', 'data', 'next'];
export const PART_LABEL: Record<FinalPart, string> = { decision: 'Рішення', data: 'Дані для обґрунтування', next: 'Наступний крок' };

// Версія в ID відокремлює нові зарахування від історичних одиниць.
export function unitKind(id: string): UnitKind | null {
  const m = /^BR-([A-Z]{3}(?:-A1)?)-(SC|PR|(?:M\d{2}-)?L\d{2}|FINAL)$/.exec(id);
  if (!m) return null;
  const [, code, suffix] = m;
  if (code.endsWith('-A1') && !isAcademyCode(code)) return null;
  if (code === 'STA-A1' && (suffix === 'PR' || suffix === 'FINAL')) return null;
  if (suffix === 'SC') return 'selfcheck';
  if (suffix === 'PR') return 'practice';
  if (suffix === 'FINAL') return 'final';
  return lessonIds(code).includes(id) ? 'lesson' : null;
}
export const branchCodeOf = (id: string): string | null => /^BR-([A-Z]{3}(?:-A1)?)-/.exec(id)?.[1] ?? null;
export function lessonIds(code: string): string[] {
  if (!isAcademyCode(code)) return Array.from({ length: 5 }, (_, index) => moduleOverviewId(code, index));
  return Array.from({ length: academyModuleCount(code) }, (_, index) => [
    moduleOverviewId(code, index),
    ...academyUnits(code, index).map((lesson) => moduleLessonId(code, lesson.key)),
  ]).flat();
}

// Нагорода за одиницю гілки. Чотири правила (рішення 17.11):
// 1) запис, де не відрізнити пропуск від проходження (урок уже є в completed без нашого проходження), — 0 XP і 0 монет;
// 2) самоперевірка, практика й пропуск уроків не позначають урок завершеним і не дають нагороди за урок
//    (практика — окрема одиниця BR-<код>-PR зі своєю нагородою за перше реальне проходження);
// 3) перше реальне проходження уроку, практики, фіналу — повна нагорода один раз;
// 4) свідомий повтор — 0 XP і 0 монет.
export function branchReward(o: {
  kind: UnitKind;
  passed: boolean;
  alreadyDone: boolean; // id уже в completed (повтор або старий запис)
  base: { coins: number; xp: number };
}): { coins: number; xp: number; complete: boolean } {
  if (o.kind === 'selfcheck') return { coins: 0, xp: 0, complete: false };
  if (!o.passed) return { coins: 0, xp: 0, complete: false };
  if (o.alreadyDone) return { coins: 0, xp: 0, complete: true };
  return { coins: Math.max(0, Math.round(o.base.coins)), xp: Math.max(0, Math.round(o.base.xp)), complete: true };
}

// Прогрес гілки на пристрої (іде в клієнтський знімок). Уроки завершені — лише в core.completed.
export type BranchProg = {
  sc?: 'pass' | 'fail';
  scSee?: string; // урок із розбору самоперевірки (місце зберігається)
  scWhy?: string;
  practice?: 'pass' | 'fail';
  prSee?: string;
  prWhy?: string;
  finalGaps?: { part: FinalPart; why: string; see?: string }[];
  blocked?: boolean; // регульована гілка: рішення «запускати» без допуску
  started?: boolean;
};

// Оцінка фіналу: рішення, дані й наступний крок окремо; у регульованій гілці вибір «запускати» без допуску блокує зарахування
type GradableStep = { type: string; part?: FinalPart; blockLaunch?: number[]; explain?: string; see?: string };
export function gradeFinal(steps: GradableStep[], ok: (i: number) => boolean, chosen: Record<number, number>): { passed: boolean; gaps: NonNullable<BranchProg['finalGaps']>; blocked: boolean } {
  const q = steps.map((s, i) => (s.type === 'teach' || s.type === 'reflect' ? -1 : i)).filter((i) => i >= 0);
  const gaps: NonNullable<BranchProg['finalGaps']> = [];
  for (const p of FINAL_PARTS) {
    const bad = q.find((i) => steps[i].part === p && !ok(i));
    if (bad !== undefined) gaps.push({ part: p, why: steps[bad].explain ?? PART_LABEL[p], see: steps[bad].see });
  }
  const blocked = q.some((i) => (steps[i].blockLaunch ?? []).includes(chosen[i] ?? -1));
  return { passed: gaps.length === 0 && !blocked, gaps, blocked };
}

// Фінал відкрито після уроків цієї редакції або зарахованої практики цієї редакції.
export function finalOpen(code: string, completed: string[], prog: BranchProg | undefined): boolean {
  if (isAcademyCode(code) && completed.includes(`BR-${code}-FINAL`)) return true;
  if (prog?.practice === 'pass' && (!isAcademyCode(code) || prog.sc === 'pass')) return true;
  return lessonIds(code).every((id) => completed.includes(id));
}

export function canOpenBranchUnit(code: string, kind: UnitKind, completed: string[], prog: BranchProg | undefined): boolean {
  if (kind === 'practice') return prog?.sc === 'pass';
  if (kind === 'final') return finalOpen(code, completed, prog);
  return true;
}

// Наступна одиниця для кнопки «Далі» в гілці
export function nextUnit(code: string, completed: string[], prog: BranchProg | undefined, readyLessons: string[], hasFinal: boolean): string | null {
  const pending = lessonIds(code).find((id) => readyLessons.includes(id) && !completed.includes(id));
  const finalId = `BR-${code}-FINAL`;
  const openFinal = hasFinal && !completed.includes(finalId) && finalOpen(code, completed, prog);
  if (openFinal && (prog?.practice === 'pass' || !pending)) return finalId;
  if (pending && (isAcademyCode(code) || prog?.practice !== 'pass')) return pending;
  return openFinal ? finalId : null;
}

// Злиття прогресу гілок двох пристроїв: зарахування «pass» не відкочується; решта — свіжіше локальне
export function mergeBranchProg(local: unknown, server: unknown): Record<string, BranchProg> {
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, BranchProg>) : {});
  const a = obj(local);
  const b = obj(server);
  const out: Record<string, BranchProg> = {};
  for (const code of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const l = a[code] ?? {};
    const s = b[code] ?? {};
    const m: BranchProg = { ...s, ...l };
    if (l.sc === 'pass' || s.sc === 'pass') m.sc = 'pass';
    if (l.practice === 'pass' || s.practice === 'pass') m.practice = 'pass';
    if (l.started || s.started) m.started = true;
    out[code] = m;
  }
  return out;
}

// «Корони» для стадій аватара (замість контрольних старого курсу): за кожну гілку до двох —
// усі 5 уроків або зарахована практика; зарахований фінал
export function branchCrowns(completed: string[], codes: string[], progress?: Record<string, BranchProg>): number {
  let n = 0;
  for (const c of codes) {
    const prefix = `${c}-A1`;
    if (lessonIds(c).every((id) => completed.includes(id)) || completed.includes(`BR-${c}-PR`) ||
      (isAcademyCode(prefix) && finalOpen(prefix, completed, progress?.[prefix]))) n++;
    if (completed.includes(`BR-${c}-FINAL`) || completed.includes(`BR-${prefix}-FINAL`)) n++;
  }
  return n;
}

// Відмінювання «урок»
export function lessonsWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return `${n} урок`;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return `${n} уроки`;
  return `${n} уроків`;
}
