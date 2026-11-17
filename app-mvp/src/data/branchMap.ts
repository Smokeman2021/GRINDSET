// Карта Києва гілки (ТЗ 004, етап E): кожна одиниця гілки — точка на карті. Порядок: уроки 1–5, практика, фінал.
// Локації — з подорожі Києвом (src/art/levels.ts, LOCS); тут лише ID, щоб файл лишався чистим для автотестів.
import { finalOpen, lessonIds, nextUnit, type BranchProg } from './branchRules.ts';

// Локація кожної точки гілки: L01…L05, практика, фінал (тематично під вертикаль)
export const BRANCH_ROUTE: Record<string, string[]> = {
  TOV: ['grocery', 'kiosk', 'mall', 'metro', 'yard', 'cafe', 'act1_room'],
  SRV: ['cafe', 'lobby', 'act2_coworking', 'bank', 'restaurant', 'metro', 'act2_coworking'],
  INF: ['act2_coworking', 'lobby', 'cafe', 'rooftop', 'restaurant', 'mall', 'lobby'],
  NUT: ['pharmacy', 'gym', 'grocery', 'mall', 'kiosk', 'yard', 'pharmacy'],
  DAT: ['bar', 'restaurant', 'embankment', 'street_night', 'cafe', 'nightclub', 'rooftop'],
  GAM: ['street_night', 'kiosk', 'bar', 'nightclub', 'metro', 'embankment', 'lobby'],
  CRY: ['bank', 'lobby', 'act2_coworking', 'street_night', 'rooftop', 'metro', 'bank'],
  ADT: ['street_night', 'nightclub', 'bar', 'act3_apartment', 'lobby', 'embankment', 'act3_apartment'],
};

export type PinState = 'done' | 'next' | 'open' | 'locked';
export type MapPin = { id: string; n: number; kind: 'lesson' | 'practice' | 'final'; locId: string; state: PinState; why?: string };

// Стан точок: уроки відкриті завжди (пропущені лишаються непройденими); практика — після зарахованої самоперевірки;
// фінал — після практики або всіх 5 уроків. «next» — та сама наступна одиниця, що й на екрані гілки.
export function branchPins(code: string, completed: string[], prog: BranchProg | undefined, readyLessons: string[], hasFinal: boolean): MapPin[] {
  const route = BRANCH_ROUTE[code] ?? BRANCH_ROUTE.TOV;
  // наступне завдання: як на екрані гілки; якщо його немає (напр. практика й фінал пройдені, а уроки ні) — перший непройдений урок
  const firstOpen = lessonIds(code).find((id) => readyLessons.includes(id) && !completed.includes(id)) ?? null;
  const next = nextUnit(code, completed, prog, readyLessons, hasFinal) ?? firstOpen;
  const st = (id: string, open: boolean): PinState => (completed.includes(id) ? 'done' : id === next ? 'next' : open ? 'open' : 'locked');
  const pins: MapPin[] = lessonIds(code).map((id, i) => ({ id, n: i + 1, kind: 'lesson', locId: route[i], state: st(id, readyLessons.includes(id)), why: readyLessons.includes(id) ? undefined : 'урок ще не готовий' }));
  const pr = `BR-${code}-PR`;
  pins.push({ id: pr, n: 6, kind: 'practice', locId: route[5], state: st(pr, prog?.sc === 'pass'), why: prog?.sc === 'pass' ? undefined : 'відкриється після самоперевірки' });
  const fin = `BR-${code}-FINAL`;
  pins.push({ id: fin, n: 7, kind: 'final', locId: route[6], state: hasFinal ? st(fin, finalOpen(code, completed, prog)) : 'locked', why: hasFinal ? (finalOpen(code, completed, prog) ? undefined : 'відкриється після 5 уроків або практики') : 'фінал ще не готовий' });
  return pins;
}

// Що відкрилось після одиниці: точки, які були закриті до неї і відкриті після
export function newlyOpened(before: MapPin[], after: MapPin[]): MapPin[] {
  return after.filter((a) => {
    const b = before.find((x) => x.id === a.id);
    return b && b.state === 'locked' && a.state !== 'locked';
  });
}
