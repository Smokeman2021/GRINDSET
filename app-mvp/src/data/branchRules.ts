// Правила гілок (ТЗ 004, C1): тип одиниці, нагорода, відкриття фіналу. Чиста логіка без імпортів, перевіряється автотестами
// (supabase/tests/branches.test.ts). Сервер (save_progress_v2) окремо гарантує «один урок — одна нагорода» за lessonId.

export type UnitKind = 'selfcheck' | 'practice' | 'lesson' | 'final';
export type FinalPart = 'decision' | 'data' | 'next';
export const FINAL_PARTS: FinalPart[] = ['decision', 'data', 'next'];
export const PART_LABEL: Record<FinalPart, string> = { decision: 'Рішення', data: 'Дані для обґрунтування', next: 'Наступний крок' };

// ID одиниць: BR-<код>-SC самоперевірка, -PR практика, -L01…L05 уроки, -FINAL фінал
export function unitKind(id: string): UnitKind | null {
  const m = /^BR-([A-Z]{3})-(SC|PR|L0[1-5]|FINAL)$/.exec(id);
  if (!m) return null;
  return m[2] === 'SC' ? 'selfcheck' : m[2] === 'PR' ? 'practice' : m[2] === 'FINAL' ? 'final' : 'lesson';
}
export const branchCodeOf = (id: string): string | null => /^BR-([A-Z]{3})-/.exec(id)?.[1] ?? null;
export const lessonIds = (code: string): string[] => [1, 2, 3, 4, 5].map((n) => `BR-${code}-L0${n}`);

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

// Фінал відкрито: пройдено всі 5 уроків або зараховано практику (після самоперевірки)
export function finalOpen(code: string, completed: string[], prog: BranchProg | undefined): boolean {
  if (prog?.practice === 'pass') return true;
  return lessonIds(code).every((id) => completed.includes(id));
}

// Наступна одиниця для кнопки «Далі» в гілці
export function nextUnit(code: string, completed: string[], prog: BranchProg | undefined, readyLessons: string[], hasFinal: boolean): string | null {
  for (const id of lessonIds(code)) if (readyLessons.includes(id) && !completed.includes(id)) {
    if (prog?.practice === 'pass') break; // після практики головна дія — фінал
    return id;
  }
  if (hasFinal && finalOpen(code, completed, prog) && !completed.includes(`BR-${code}-FINAL`)) return `BR-${code}-FINAL`;
  return null;
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
export function branchCrowns(completed: string[], codes: string[]): number {
  let n = 0;
  for (const c of codes) {
    if (lessonIds(c).every((id) => completed.includes(id)) || completed.includes(`BR-${c}-PR`)) n++;
    if (completed.includes(`BR-${c}-FINAL`)) n++;
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
