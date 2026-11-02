// Конфіг рівнів: модуль → сцена (повноекранний фон-світ) + назва локації + ціль + поза Гріндіка. Заповнюється за модулями 01–10.
// goal це ЧАСТКИ зображення плити (0..1 по ширині й висоті файла). Кадр на портретному екрані підбирається автоматично: фон
// масштабується «cover» по висоті й зсувається так, щоб ціль опинилась правіше від Гріндіка (див. LevelScene).
// calibrate: координату цілі поставлено «на око»; уточнюється простим редагуванням цього файла.
import type { ArtKey } from './index';
import type { PoseName } from '../data/poses';

export type LevelScene = {
  plate: ArtKey; // worlds/locations/* (ландшафтна) або worlds/acts/* (портретна): ПОВНОЕКРАННИЙ фон; без вбудованих персонажів
  title: string; // назва локації для заголовка екрана
  goal: { x: number; y: number }; // де світиться зелений пін цілі
  pose: PoseName; // поза Гріндіка (прозорий cutout, повний зріст ліворуч)
  calibrate?: boolean;
};

// Ключ = номер модуля (1..10)
export const LEVEL_SCENES: Record<number, LevelScene> = {
  1: { plate: 'worlds/locations/cafe', title: 'Кафе «Своя чашка»', goal: { x: 0.4, y: 0.52 }, pose: 'point' }, // каса
  2: { plate: 'worlds/locations/yard', title: 'Двір', goal: { x: 0.4, y: 0.58 }, pose: 'wave' }, // двері під'їзду
  3: { plate: 'worlds/locations/metro', title: 'Метро', goal: { x: 0.66, y: 0.55 }, pose: 'point' }, // двері вагона
  4: { plate: 'worlds/locations/bank', title: 'Банк', goal: { x: 0.63, y: 0.6 }, pose: 'laptop' }, // операційна стійка
  5: { plate: 'worlds/acts/act2_coworking', title: 'Коворкінг', goal: { x: 0.5, y: 0.6 }, pose: 'laptop', calibrate: true },
  6: { plate: 'worlds/locations/street_night', title: 'Нічна вулиця', goal: { x: 0.5, y: 0.57 }, pose: 'phone', calibrate: true },
  7: { plate: 'worlds/locations/mall', title: 'Торговий центр', goal: { x: 0.62, y: 0.62 }, pose: 'think', calibrate: true }, // ескалатор
  8: { plate: 'worlds/locations/rooftop', title: 'Дах', goal: { x: 0.31, y: 0.42 }, pose: 'cheer', calibrate: true }, // висотка
  9: { plate: 'worlds/locations/embankment', title: 'Набережна', goal: { x: 0.5, y: 0.6 }, pose: 'shrug', calibrate: true },
  10: { plate: 'worlds/acts/act4_lux', title: 'Пентхаус', goal: { x: 0.5, y: 0.6 }, pose: 'cheer', calibrate: true },
};

// Рівень (модуль) за id уроку: беремо перший модуль, де цей урок є серед уроків
export function levelOf(lessonId: string, modules: { lessons: { id: string }[]; checkpoint: { id: string }; quizzes: { id: string }[] }[]): number | null {
  const i = modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId) || m.checkpoint.id === lessonId || m.quizzes.some((q) => q.id === lessonId));
  return i < 0 ? null : i + 1;
}
