// Розміщення кнопки відгуку 🐞 (ТЗ 006, 4.2). Чиста функція — під автотести.
// На вкладках — унизу над панеллю вкладок (вгорі показники й бульбашка Гріндіка), на інших екранах — угорі.
// Завжди в межах колонки: 600 px по центру; на широкому вебі з бічною навігацією (190 px) — колонка 680 px праворуч від неї.
export type FabPlace = { placement: 'top' | 'bottom'; offset: number; column: { left: number; maxWidth: number } };
export const TAB_PATHS = ['/home', '/library', '/shop', '/league'];
export const TAB_BAR_H = 62;
export function fabPlace(pathname: string, winW: number, web: boolean): FabPlace {
  const sidebar = web && winW > 1024;
  const tab = TAB_PATHS.includes(pathname);
  const column = tab && sidebar ? { left: 190, maxWidth: 680 } : { left: 0, maxWidth: 600 };
  // сцена подорожі: угорі рядок HUD (карта, стрік, XP, коїни, енергія) — кнопка під ним
  if (pathname.startsWith('/scene/')) return { placement: 'top', offset: 54, column };
  if (!tab) return { placement: 'top', offset: 8, column };
  return { placement: 'bottom', offset: sidebar ? 16 : TAB_BAR_H + 12, column };
}
