// Зупинка подорожі для одиниці гілки (ТЗ 006, 3.1): ті самі StopScene і Travel, що в курсі, але заклад і акт — за етапом гілки.
import type { Lesson } from '../data/lessons';
import { branchScene } from '../data/branchScenes';
import { LOCS, actOfModule, travelMode, type LocId, type TravelMode, type Act } from './levels';
import type { JStop } from './stops';

export function branchStop(code: string, unitId: string, title: string): JStop | null {
  const sc = branchScene(code, unitId);
  if (!sc || !LOCS[sc.locId]) return null;
  const lesson = { id: unitId, code: String(sc.n), title, minutes: 5, steps: [] } as unknown as Lesson;
  return { index: sc.n, moduleNo: sc.moduleNo, k: sc.k, isChest: false, lesson, locId: sc.locId as LocId, loc: LOCS[sc.locId], act: actOfModule(sc.moduleNo) };
}

export function branchTravel(from: JStop, to: JStop): { mode: TravelMode; act: Act; actChanged: boolean } {
  // новий акт показуємо лише при русі вперед (з фіналу назад до пропущеного уроку — без «Акт 1»)
  return { mode: travelMode(to.moduleNo, to.k), act: to.act, actChanged: to.act.n > from.act.n };
}
