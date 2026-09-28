// Перетворює згенеровані scripts/import-modules.mjs дані (src/data/generated/mNN.json) на уроки застосунку.
import { buildCrown, buildQuiz, isQuizzable, type Lesson, type Question, type Step } from './lessons';
import { INCLUDE_RESTRICTED, isRestricted } from './restricted';
import type { Lang } from '../i18n/strings';

type RawTask =
  | { type: 'choice'; q: string; options: string[]; answer: number; explain?: string; restricted?: boolean }
  | { type: 'multi'; q: string; options: string[]; answers: number[]; explain?: string; restricted?: boolean }
  | { type: 'order'; q: string; items: string[]; explain?: string; restricted?: boolean }
  | { type: 'match'; q: string; pairs: string[][]; explain?: string; restricted?: boolean }
  | {
      type: 'numeric';
      q: string;
      fields: { label: string; answer: number; unit?: string; tolerance?: number }[];
      explain?: string;
      restricted?: boolean;
    };

export type RawLesson = {
  id: string;
  code: string;
  title: string;
  restricted: boolean;
  teach: { title: string; body: string; restricted?: boolean }[];
  l1: RawTask[];
  l2: { situation: string; situationRestricted?: boolean; isFinal: boolean; questions: RawTask[] } | null;
};

export type RawModule = {
  id: string;
  number: string;
  title: string;
  restricted: boolean;
  finalRestricted: boolean;
  lessons: RawLesson[];
  summary: string | null;
};

const ok = (t: RawTask) => INCLUDE_RESTRICTED || !t.restricted;

// Рядки, які збираються в коді (не з JSON), тому перекладаються тут
const TXT: Record<Lang, Record<'ok' | 'wrong' | 'order' | 'pairs' | 'calc' | 'crown' | 'summary' | 'pass' | 'quiz' | 'module', string>> = {
  uk: {
    ok: 'Вірно!',
    wrong: 'Не зовсім. Правильно:',
    order: 'Не зовсім. Правильний порядок показано нижче.',
    pairs: 'Не зовсім. Правильні пари показано нижче.',
    calc: 'Не зовсім. Перевір розрахунок.',
    crown: 'Тест на корону · Модуль',
    summary: 'Підсумок Модуля',
    pass: 'Тепер тест на корону: потрібно щонайменше 80% правильних відповідей.',
    quiz: 'Квіз',
    module: 'Модуль',
  },
  en: {
    ok: 'Correct!',
    wrong: 'Not quite. Correct answer:',
    order: 'Not quite. The correct order is shown below.',
    pairs: 'Not quite. The correct pairs are shown below.',
    calc: 'Not quite. Check your calculation.',
    crown: 'Crown test · Module',
    summary: 'Module summary',
    pass: 'Now the crown test: you need at least 80% correct answers.',
    quiz: 'Quiz',
    module: 'Module',
  },
  ru: {
    ok: 'Верно!',
    wrong: 'Не совсем. Правильно:',
    order: 'Не совсем. Правильный порядок показан ниже.',
    pairs: 'Не совсем. Правильные пары показаны ниже.',
    calc: 'Не совсем. Проверь расчёт.',
    crown: 'Тест на корону · Модуль',
    summary: 'Итог модуля',
    pass: 'Теперь тест на корону: нужно не менее 80% правильных ответов.',
    quiz: 'Квиз',
    module: 'Модуль',
  },
};

function toStep(t: RawTask, layer: 1 | 2, scenario: string | undefined, lang: Lang): Question {
  const x = TXT[lang];
  const base = { layer, q: t.q, scenario: scenario || undefined, explain: t.explain, okMsg: x.ok };
  switch (t.type) {
    case 'choice':
      return { type: 'choice', ...base, options: t.options, answer: t.answer, noMsg: `${x.wrong} ${t.options[t.answer]}` };
    case 'multi':
      return {
        type: 'multi',
        ...base,
        options: t.options,
        answers: t.answers,
        noMsg: `${x.wrong} ${t.answers.map((i) => t.options[i]).join('; ')}`,
      };
    case 'order':
      return { type: 'order', ...base, items: t.items, noMsg: x.order };
    case 'match':
      return {
        type: 'match',
        ...base,
        pairs: t.pairs.map((p) => [p[0], p[1]] as [string, string]),
        noMsg: x.pairs,
      };
    case 'numeric':
      return { type: 'numeric', ...base, fields: t.fields, noMsg: x.calc };
  }
}

function buildLesson(raw: RawLesson, lang: Lang): Lesson | null {
  if (raw.restricted && !INCLUDE_RESTRICTED) return null;
  const teach = raw.teach.filter((t) => INCLUDE_RESTRICTED || !t.restricted);
  if (!teach.length) return null;
  const l2 = raw.l2 && !raw.l2.isFinal && (INCLUDE_RESTRICTED || !raw.l2.situationRestricted) ? raw.l2 : null;

  const steps: Step[] = [
    ...teach.map((t) => ({ type: 'teach' as const, title: t.title, body: t.body })),
    ...raw.l1.filter(ok).map((t) => toStep(t, 1, undefined, lang)),
    ...(l2 ? l2.questions.filter(ok).map((t) => toStep(t, 2, l2.situation, lang)) : []),
  ];
  const words = teach.reduce((s, t) => s + t.body.split(/\s+/).length, 0);
  const questions = steps.length - teach.length;
  return {
    id: raw.id,
    code: raw.code,
    title: raw.title,
    minutes: Math.max(5, Math.round(words / 200 + questions * 0.5)),
    steps,
  };
}

export type BuiltModule = {
  id: string;
  title: string;
  lessons: Lesson[];
  checkpoint: Lesson;
  quizzes: Lesson[];
};

export function buildModule(raw: RawModule, lang: Lang = 'uk'): BuiltModule | null {
  if (raw.restricted && !INCLUDE_RESTRICTED) return null;
  const x = TXT[lang];
  const lessons = raw.lessons.map((l) => buildLesson(l, lang)).filter((l): l is Lesson => l !== null);
  if (lessons.length < 2) return null;
  const n = Number(raw.number);

  const finalRaw = raw.lessons.find((l) => l.l2?.isFinal)?.l2 ?? null;
  const finalQs =
    finalRaw && (INCLUDE_RESTRICTED || (!raw.finalRestricted && !finalRaw.situationRestricted))
      ? finalRaw.questions.filter(ok).map((t) => toStep(t, 2, finalRaw.situation, lang))
      : [];

  const summaryLines = (raw.summary ?? '').split('\n').filter((l) => INCLUDE_RESTRICTED || !isRestricted(l));
  const checkpoint = buildCrown({
    id: `checkpoint${n}`,
    title: `${x.crown} ${raw.number}`,
    intro: {
      title: `${x.summary} ${raw.number}`,
      body: `${summaryLines.join('\n').trim()}\n\n${x.pass}`,
    },
    final: finalQs,
    source: lessons,
  });

  // Два квізи на час: перша та друга половини модуля
  const half = Math.ceil(lessons.length / 2);
  const quizzes: Lesson[] = [];
  [lessons.slice(0, half), lessons.slice(half)].forEach((group, gi) => {
    if (!group.length) return;
    const title = `${x.quiz} ${gi + 1} · ${group[0].code}–${group[group.length - 1].code}`;
    const quiz = buildQuiz(`m${n}q${gi + 1}`, title, group.map((l) => l.id), group, lang);
    if (quiz.steps.filter(isQuizzable).length >= 3) quizzes.push(quiz);
  });

  return {
    id: raw.id,
    title: `${x.module} ${raw.number} · ${raw.title}`,
    lessons,
    checkpoint,
    quizzes,
  };
}
