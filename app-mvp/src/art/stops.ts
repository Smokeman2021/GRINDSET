// Логіка подорожі: шлях курсу (PATH) → зупинки у Києві. Одна зупинка = один урок (або скриня золота модуля).
import { PATH } from '../data/modules';
import type { Lesson } from '../data/lessons';
import { LOCS, MODULE_HUB, MODULE_ROUTE, actOfModule, travelMode, type Act, type Loc, type LocId, type TravelMode } from './levels';

export type JStop = {
  index: number; // індекс у PATH
  moduleNo: number; // 1..10
  k: number; // номер уроку в модулі (для скрині = кількість уроків)
  isChest: boolean;
  lesson: Lesson;
  locId: LocId;
  loc: Loc;
  act: Act;
};

export function stopAt(index: number): JStop {
  const i = Math.max(0, Math.min(PATH.length - 1, index));
  const it = PATH[i];
  const moduleNo = it.moduleIndex + 1;
  const first = PATH.findIndex((p) => p.moduleIndex === it.moduleIndex);
  const k = i - first;
  const route = MODULE_ROUTE[moduleNo] ?? MODULE_ROUTE[1];
  const locId: LocId = it.isCrown ? MODULE_HUB[moduleNo] ?? route[0] : route[k % route.length];
  return { index: i, moduleNo, k, isChest: it.isCrown, lesson: it.lesson, locId, loc: LOCS[locId], act: actOfModule(moduleNo) };
}

// Перша зупинка, яку гравець ще не пройшов (кінець курсу = остання)
export function currentStopIndex(completed: string[]): number {
  const i = PATH.findIndex((p) => !completed.includes(p.lesson.id));
  return i < 0 ? PATH.length - 1 : i;
}

export const allDone = (completed: string[]) => PATH.every((p) => completed.includes(p.lesson.id));

export function travelBetween(from: JStop, to: JStop): { mode: TravelMode; act: Act; actChanged: boolean; moduleChanged: boolean } {
  return { mode: travelMode(to.moduleNo, to.k), act: to.act, actChanged: from.act.n !== to.act.n, moduleChanged: from.moduleNo !== to.moduleNo };
}

// Зупинки модуля (для вибору в виді-карті)
export function stopsOfModule(moduleNo: number): JStop[] {
  const out: JStop[] = [];
  PATH.forEach((p, i) => {
    if (p.moduleIndex === moduleNo - 1) out.push(stopAt(i));
  });
  return out;
}
