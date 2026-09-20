import { LESSONS, QUIZZES, buildQuiz, type Lesson } from './lessons';
import { M2_LESSONS, M2_CHECKPOINT } from './module02';

export type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
  checkpoint: Lesson; // корона в кінці модуля
  quizzes: Lesson[]; // бонусні квізи на час
};

const M1_CHECKPOINT = LESSONS.find((l) => l.kind === 'checkpoint') as Lesson;

// Нові модулі додаємо сюди: шлях, замки й квізи на головній підхоплять їх самі.
export const MODULES: Module[] = [
  {
    id: 'm1',
    title: 'Модуль 01 · Що таке арбітраж',
    lessons: LESSONS.filter((l) => l.kind !== 'checkpoint'),
    checkpoint: M1_CHECKPOINT,
    quizzes: QUIZZES,
  },
  {
    id: 'm2',
    title: 'Модуль 02 · Facebook: знайомство та фундамент',
    lessons: M2_LESSONS,
    checkpoint: M2_CHECKPOINT,
    quizzes: [
      buildQuiz('m2q1', 'Квіз 1 · Екосистема й кабінет', ['m2l1', 'm2l2', 'm2l3', 'm2l4'], M2_LESSONS),
      buildQuiz('m2q2', 'Квіз 2 · Гроші, траст, метрики', ['m2l5', 'm2l6', 'm2l7', 'm2l8'], M2_LESSONS),
    ],
  },
];

export const ALL_LESSONS: Lesson[] = MODULES.flatMap((m) => [...m.lessons, m.checkpoint, ...m.quizzes]);

// Один безперервний шлях: уроки модуля, корона, далі наступний модуль
export type PathItem = { lesson: Lesson; moduleIndex: number; isCrown: boolean };

export const PATH: PathItem[] = MODULES.flatMap((m, moduleIndex) => [
  ...m.lessons.map((lesson) => ({ lesson, moduleIndex, isCrown: false })),
  { lesson: m.checkpoint, moduleIndex, isCrown: true },
]);

export function nextAfter(id: string): Lesson | undefined {
  const i = PATH.findIndex((p) => p.lesson.id === id);
  return i >= 0 ? PATH[i + 1]?.lesson : undefined;
}

export function isQuizId(id: string): boolean {
  return MODULES.some((m) => m.quizzes.some((q) => q.id === id));
}
