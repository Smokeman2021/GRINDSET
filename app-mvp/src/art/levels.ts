// Конфіг рівнів: модуль → локація (плита) + ціль + точка старту + поза Гріндіка. Заповнюється за модулями 01–10.
// Координати goal/start це ЧАСТКИ зображення плити (0..1 по ширині й висоті файла), тож вони не залежать від розміру екрана.
// Позначка calibrate: координати поставлено «на око» за плитою; уточнюються простим редагуванням цього файла.
import type { ArtKey } from './index';
import type { PoseName } from '../data/poses';

export type LevelScene = {
  plate: ArtKey; // worlds/splashes/* (портретна заставка зі своїм Гріндіком) або worlds/locations/* (ландшафтна)
  hasGrindik: boolean; // true: Гріндік уже намальований на плиті, окремо його не додаємо
  goal: { x: number; y: number; r: number }; // ціль: де світиться зелений ореол; r: радіус у частках ширини
  start: { x: number; y: number }; // точка старту маршруту
  pose: PoseName; // поза Гріндіка, якщо його додаємо поверх плити
  calibrate?: boolean;
};

// Ключ = номер модуля (1..10)
export const LEVEL_SCENES: Record<number, LevelScene> = {
  1: { plate: 'worlds/splashes/splash_cafe', hasGrindik: true, goal: { x: 0.3, y: 0.45, r: 0.2 }, start: { x: 0.56, y: 0.74 }, pose: 'point' },
  2: { plate: 'worlds/locations/yard', hasGrindik: false, goal: { x: 0.5, y: 0.55, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'wave', calibrate: true },
  3: { plate: 'worlds/splashes/splash_metro', hasGrindik: true, goal: { x: 0.43, y: 0.46, r: 0.2 }, start: { x: 0.56, y: 0.72 }, pose: 'point' },
  4: { plate: 'worlds/locations/lobby', hasGrindik: false, goal: { x: 0.5, y: 0.55, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'laptop', calibrate: true },
  5: { plate: 'worlds/splashes/splash_coworking', hasGrindik: true, goal: { x: 0.24, y: 0.37, r: 0.2 }, start: { x: 0.56, y: 0.72 }, pose: 'laptop' },
  6: { plate: 'worlds/locations/street_night', hasGrindik: false, goal: { x: 0.5, y: 0.5, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'phone', calibrate: true },
  7: { plate: 'worlds/locations/mall', hasGrindik: false, goal: { x: 0.5, y: 0.55, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'think', calibrate: true },
  8: { plate: 'worlds/locations/rooftop', hasGrindik: false, goal: { x: 0.5, y: 0.5, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'cheer', calibrate: true },
  9: { plate: 'worlds/locations/embankment', hasGrindik: false, goal: { x: 0.5, y: 0.55, r: 0.16 }, start: { x: 0.5, y: 0.78 }, pose: 'shrug', calibrate: true },
  10: { plate: 'worlds/splashes/splash_office', hasGrindik: true, goal: { x: 0.48, y: 0.37, r: 0.2 }, start: { x: 0.52, y: 0.72 }, pose: 'cheer' },
};

// Рівень (модуль) за id уроку: беремо перший модуль, де цей урок є серед уроків, чекпойнта чи квізів
export function levelOf(lessonId: string, modules: { lessons: { id: string }[]; checkpoint: { id: string }; quizzes: { id: string }[] }[]): number | null {
  const i = modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId) || m.checkpoint.id === lessonId || m.quizzes.some((q) => q.id === lessonId));
  return i < 0 ? null : i + 1;
}

// Заставка показується перед ПЕРШИМ уроком модуля (при першому проходженні)
export function isLevelOpener(lessonId: string, modules: { lessons: { id: string }[] }[]): boolean {
  return modules.some((m) => m.lessons[0]?.id === lessonId);
}
