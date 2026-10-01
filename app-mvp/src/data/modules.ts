import { LESSONS, QUIZZES, buildQuiz, type Lesson } from './lessons';
import { M2_LESSONS, M2_CHECKPOINT } from './module02';
import { buildModule, type RawModule } from './content';
import type { Lang } from '../i18n/strings';
import m03 from './generated/m03.json';
import m04 from './generated/m04.json';
import m05 from './generated/m05.json';
import m06 from './generated/m06.json';
import m07 from './generated/m07.json';
import m08 from './generated/m08.json';
import m09 from './generated/m09.json';
import m10 from './generated/m10.json';
import m03en from './generated/m03.en.json';
import m04en from './generated/m04.en.json';
import m05en from './generated/m05.en.json';
import m06en from './generated/m06.en.json';
import m07en from './generated/m07.en.json';
import m08en from './generated/m08.en.json';
import m09en from './generated/m09.en.json';
import m10en from './generated/m10.en.json';
import m03ru from './generated/m03.ru.json';
import m04ru from './generated/m04.ru.json';
import m05ru from './generated/m05.ru.json';
import m06ru from './generated/m06.ru.json';
import m07ru from './generated/m07.ru.json';
import m08ru from './generated/m08.ru.json';
import m09ru from './generated/m09.ru.json';
import m10ru from './generated/m10.ru.json';

export type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
  checkpoint: Lesson; // корона в кінці модуля
  quizzes: Lesson[]; // бонусні квізи на час
};

const M1_CHECKPOINT = LESSONS.find((l) => l.kind === 'checkpoint') as Lesson;

// Нові модулі додаємо сюди: шлях, замки й квізи на головній підхоплять їх самі.
// Модулі 03-10 збираються з content/modules/*.md (node scripts/import-modules.mjs),
// переклади en/ru робить scripts/translate-content.mjs. Модулі 01-02 поки лише українською.
const RAW: Record<Lang, RawModule[]> = {
  uk: [m03, m04, m05, m06, m07, m08, m09, m10] as unknown as RawModule[],
  en: [m03en, m04en, m05en, m06en, m07en, m08en, m09en, m10en] as unknown as RawModule[],
  ru: [m03ru, m04ru, m05ru, m06ru, m07ru, m08ru, m09ru, m10ru] as unknown as RawModule[],
};

function build(lang: Lang): Module[] {
  const generated = RAW[lang].map((r) => buildModule(r, lang)).filter((m): m is Module => m !== null);
  return [
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
    ...generated,
  ];
}

// Масиви нижче змінюються «на місці» при зміні мови, щоб усі імпорти бачили актуальний контент
export const MODULES: Module[] = build('uk');

export const ALL_LESSONS: Lesson[] = [];

// Один безперервний шлях: уроки модуля, корона, далі наступний модуль
export type PathItem = { lesson: Lesson; moduleIndex: number; isCrown: boolean };

export const PATH: PathItem[] = [];

function refill() {
  ALL_LESSONS.splice(0, ALL_LESSONS.length, ...MODULES.flatMap((m) => [...m.lessons, m.checkpoint, ...m.quizzes]));
  PATH.splice(
    0,
    PATH.length,
    ...MODULES.flatMap((m, moduleIndex) => [
      ...m.lessons.map((lesson) => ({ lesson, moduleIndex, isCrown: false })),
      { lesson: m.checkpoint, moduleIndex, isCrown: true },
    ])
  );
}
refill();

let currentLang: Lang = 'uk';

export function setContentLang(lang: Lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  MODULES.splice(0, MODULES.length, ...build(lang));
  refill();
}

export function nextAfter(id: string): Lesson | undefined {
  const i = PATH.findIndex((p) => p.lesson.id === id);
  return i >= 0 ? PATH[i + 1]?.lesson : undefined;
}

export function isQuizId(id: string): boolean {
  return MODULES.some((m) => m.quizzes.some((q) => q.id === id));
}

// скільки коронок модулів вже пройдено — визначає стадію еволюції аватара
export function crownsCompleted(completed: string[]): number {
  return MODULES.filter((m) => completed.includes(m.checkpoint.id)).length;
}
