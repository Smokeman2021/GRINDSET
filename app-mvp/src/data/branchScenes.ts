// Сцени подорожі Києвом у гілках (ТЗ 006, 3.1). Чисті правила без React — під автотести й таблицю звіту.
// Етап гілки → заклад Києва (BRANCH_ROUTE з етапу E) і «акт» подорожі за просуванням у гілці:
// вступ і уроки 1–2 — околиця (пішки / маршрутка / метро), уроки 3–4 — перші гроші (стара тачка), урок 5 і практика — свій рух (своє авто),
// фінал — свій рух (своє авто; Печерськ — після рішення щодо карти). moduleNo — номер «модуля» подорожі, з якого StopScene / Travel беруть акт і транспорт.
import { branchLocations, BRANCH_ROUTE } from './branchMap.ts';
import { lessonIds, unitKind } from './branchRules.ts';

export const INTRO_LOC = 'act1_room_b'; // вступ і самоперевірка: кімната на околиці — початок подорожі
export type SceneStage = 'intro' | 'lesson' | 'practice' | 'final';
export type BranchScene = { unitId: string; stage: SceneStage; n: number; label: string; locId: string; moduleNo: number; k: number };

// «модуль» подорожі для кожної позиції гілки: SC, L01…L05, PR, FINAL
const MODULE_OF = [1, 1, 2, 4, 5, 6, 7, 8]; // фінал — «Свій рух»: заклад фіналу поки з маршруту етапу E (Печерськ і золотий сектор — після рішення щодо карти)

export function branchScene(code: string, unitId: string): BranchScene | null {
  if (!BRANCH_ROUTE[code.slice(0, 3)]) return null;
  const route = branchLocations(code);
  const order = [`BR-${code}-SC`, ...lessonIds(code), `BR-${code}-PR`, `BR-${code}-FINAL`];
  const i = order.indexOf(unitId);
  const kind = unitKind(unitId);
  if (i < 0 || !kind) return null;
  const stage: SceneStage = kind === 'selfcheck' ? 'intro' : kind === 'practice' ? 'practice' : kind === 'final' ? 'final' : 'lesson';
  const locId = i === 0 ? INTRO_LOC : route[i - 1];
  const label = stage === 'intro' ? 'Вступ і самоперевірка' : stage === 'lesson' ? `Урок ${i}` : stage === 'practice' ? 'Практика' : 'Фінал';
  const moduleNo = MODULE_OF[Math.round(i * (MODULE_OF.length - 1) / (order.length - 1))];
  return { unitId, stage, n: i, label, locId, moduleNo, k: i };
}

export function branchScenes(code: string): BranchScene[] {
  return [`BR-${code}-SC`, ...lessonIds(code), `BR-${code}-PR`, `BR-${code}-FINAL`].map((id) => branchScene(code, id)!).filter(Boolean);
}

// Перегляд сцен: перший раз — повна сцена перед одиницею й переїзд після неї; повторно — одразу завдання (можна пропустити)
export const sceneKey = (unitId: string) => `scene:${unitId}`;
export const travelKey = (unitId: string) => `travel:${unitId}`;
export function shouldShow(seen: string[] | undefined, key: string): boolean {
  return !(seen ?? []).includes(key);
}

// Підпис переїзду: який навик освоєно й що відкрилось
export function travelCaption(doneTitle: string, opened: string[], nextTitle: string | null): { skill: string; opened: string } {
  const list = opened.length ? opened.join(', ') : nextTitle ? `далі — ${nextTitle}` : 'гілку пройдено';
  return { skill: `Освоєно: ${doneTitle}`, opened: opened.length ? `Відкрилось: ${list}` : list[0].toUpperCase() + list.slice(1) };
}
