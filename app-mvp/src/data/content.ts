// Перетворює згенеровані scripts/import-modules.mjs дані (src/data/generated/mNN.json) на уроки застосунку.
import { buildCrown, buildQuiz, isQuizzable, type Lesson, type Question, type Step } from './lessons';
import { INCLUDE_RESTRICTED, isRestricted } from './restricted';

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

function toStep(t: RawTask, layer: 1 | 2, scenario?: string): Question {
  const base = { layer, q: t.q, scenario: scenario || undefined, explain: t.explain, okMsg: 'Вірно!' };
  switch (t.type) {
    case 'choice':
      return { type: 'choice', ...base, options: t.options, answer: t.answer, noMsg: `Не зовсім. Правильно: ${t.options[t.answer]}` };
    case 'multi':
      return {
        type: 'multi',
        ...base,
        options: t.options,
        answers: t.answers,
        noMsg: `Не зовсім. Правильно: ${t.answers.map((i) => t.options[i]).join('; ')}`,
      };
    case 'order':
      return { type: 'order', ...base, items: t.items, noMsg: 'Не зовсім. Правильний порядок показано нижче.' };
    case 'match':
      return {
        type: 'match',
        ...base,
        pairs: t.pairs.map((p) => [p[0], p[1]] as [string, string]),
        noMsg: 'Не зовсім. Правильні пари показано нижче.',
      };
    case 'numeric':
      return { type: 'numeric', ...base, fields: t.fields, noMsg: 'Не зовсім. Перевір розрахунок.' };
  }
}

function buildLesson(raw: RawLesson): Lesson | null {
  if (raw.restricted && !INCLUDE_RESTRICTED) return null;
  const teach = raw.teach.filter((t) => INCLUDE_RESTRICTED || !t.restricted);
  if (!teach.length) return null;
  const l2 = raw.l2 && !raw.l2.isFinal && (INCLUDE_RESTRICTED || !raw.l2.situationRestricted) ? raw.l2 : null;

  const steps: Step[] = [
    ...teach.map((t) => ({ type: 'teach' as const, title: t.title, body: t.body })),
    ...raw.l1.filter(ok).map((t) => toStep(t, 1)),
    ...(l2 ? l2.questions.filter(ok).map((t) => toStep(t, 2, l2.situation)) : []),
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

export function buildModule(raw: RawModule): BuiltModule | null {
  if (raw.restricted && !INCLUDE_RESTRICTED) return null;
  const lessons = raw.lessons.map(buildLesson).filter((l): l is Lesson => l !== null);
  if (lessons.length < 2) return null;
  const n = Number(raw.number);

  const finalRaw = raw.lessons.find((l) => l.l2?.isFinal)?.l2 ?? null;
  const finalQs =
    finalRaw && (INCLUDE_RESTRICTED || (!raw.finalRestricted && !finalRaw.situationRestricted))
      ? finalRaw.questions.filter(ok).map((t) => toStep(t, 2, finalRaw.situation))
      : [];

  const summaryLines = (raw.summary ?? '').split('\n').filter((l) => INCLUDE_RESTRICTED || !isRestricted(l));
  const checkpoint = buildCrown({
    id: `checkpoint${n}`,
    title: `Тест на корону · Модуль ${raw.number}`,
    intro: {
      title: `Підсумок Модуля ${raw.number}`,
      body: `${summaryLines.join('\n').trim()}\n\nТепер тест на корону: потрібно щонайменше 80% правильних відповідей.`,
    },
    final: finalQs,
    source: lessons,
  });

  // Два квізи на час: перша та друга половини модуля
  const half = Math.ceil(lessons.length / 2);
  const quizzes: Lesson[] = [];
  [lessons.slice(0, half), lessons.slice(half)].forEach((group, gi) => {
    if (!group.length) return;
    const title = `Квіз ${gi + 1} · ${group[0].code}–${group[group.length - 1].code}`;
    const quiz = buildQuiz(`m${n}q${gi + 1}`, title, group.map((l) => l.id), group);
    if (quiz.steps.filter(isQuizzable).length >= 3) quizzes.push(quiz);
  });

  return {
    id: raw.id,
    title: `Модуль ${raw.number} · ${raw.title}`,
    lessons,
    checkpoint,
    quizzes,
  };
}
