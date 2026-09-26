// Розумні повтори (система Лейтнера): питання, на які відповів правильно, повертаються через 1, 2, 4, 8, 16 днів;
// помилка повертає питання на перший рівень. Ключ: `${lessonId}#${idx}`.
export type SrsItem = { box: number; due: number };
export type SrsMap = Record<string, SrsItem>;

const DAY = 86400000;
export const BOX_DAYS = [1, 2, 4, 8, 16];
export const srsKey = (lessonId: string, idx: number) => `${lessonId}#${idx}`;

export function reviewed(prev: SrsItem | undefined, ok: boolean, now: number): SrsItem {
  const box = ok ? Math.min(BOX_DAYS.length, (prev?.box ?? 0) + 1) : 1;
  return { box, due: now + BOX_DAYS[box - 1] * DAY };
}

// Питання, які пора повторити (від найпростроченіших)
export function dueKeys(srs: SrsMap, now = Date.now()): string[] {
  return Object.entries(srs)
    .filter(([, v]) => v.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}

export function parseKey(key: string): { lessonId: string; idx: number } {
  const at = key.lastIndexOf('#');
  return { lessonId: key.slice(0, at), idx: Number(key.slice(at + 1)) };
}

// Скільки питань засвоєно міцно (вищий рівень) для показу прогресу
export const masteredCount = (srs: SrsMap) => Object.values(srs).filter((v) => v.box >= 4).length;
