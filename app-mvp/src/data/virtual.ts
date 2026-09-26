// «Віртуальні» уроки, зібрані на льоту: надолуження помилок і діагностичний тест.
// Кожен крок пам'ятає, з якого уроку й місця він узятий (refs), щоб правильна відповідь могла прибрати помилку.
import { isQuizzable, Lesson, Step } from './lessons';
import { ALL_LESSONS, MODULES } from './modules';
import type { MistakeRef } from '../store';

export type VirtualLesson = { lesson: Lesson; refs: MistakeRef[] };

export const MISTAKES_ID = 'mistakes';
export const DIAGNOSTIC_ID = 'diagnostic';
export const PRACTICE_ID = 'practice';
export const isVirtualId = (id: string) => id === MISTAKES_ID || id === DIAGNOSTIC_ID || id === PRACTICE_ID;

export function buildMistakes(mistakes: MistakeRef[], max = 8): VirtualLesson {
  const steps: Step[] = [];
  const refs: MistakeRef[] = [];
  for (const m of mistakes) {
    const l = ALL_LESSONS.find((x) => x.id === m.lessonId);
    const st = l?.steps[m.idx];
    if (!st || st.type === 'teach') continue;
    steps.push(st);
    refs.push(m);
    if (steps.length >= max) break;
  }
  return {
    lesson: { id: MISTAKES_ID, code: '🩹', title: 'Надолуження помилок', minutes: 5, steps },
    refs,
  };
}

// Діагностика: по одному питанню першого шару з кожного модуля (до 10), випадково
export function buildDiagnostic(): VirtualLesson {
  const steps: Step[] = [];
  const refs: MistakeRef[] = [];
  for (const m of MODULES) {
    const pool: MistakeRef[] = [];
    for (const l of m.lessons) {
      l.steps.forEach((st, idx) => {
        if (isQuizzable(st) && st.layer === 1) pool.push({ lessonId: l.id, idx });
      });
    }
    if (!pool.length) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const st = ALL_LESSONS.find((x) => x.id === pick.lessonId)!.steps[pick.idx];
    steps.push(st);
    refs.push(pick);
  }
  return {
    lesson: { id: DIAGNOSTIC_ID, code: '🧪', title: 'Діагностичний тест', minutes: 5, steps },
    refs,
  };
}

// Скільки модулів можна пропустити за результатом діагностики: список id уроків для позначки «пройдено»
export function skippableUpTo(moduleCount: number): string[] {
  return MODULES.slice(0, moduleCount).flatMap((m) => [...m.lessons.map((l) => l.id), m.checkpoint.id]);
}

// Швидке тренування: випадкові питання першого шару з уже пройдених уроків
export function buildPractice(completed: string[], count = 8): VirtualLesson {
  const pool: MistakeRef[] = [];
  for (const l of ALL_LESSONS) {
    if (l.kind || !completed.includes(l.id)) continue;
    l.steps.forEach((st, idx) => {
      if (isQuizzable(st)) pool.push({ lessonId: l.id, idx });
    });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const refs = pool.slice(0, count);
  const steps = refs.map((r) => ALL_LESSONS.find((x) => x.id === r.lessonId)!.steps[r.idx]);
  return { lesson: { id: PRACTICE_ID, code: '🏋️', title: 'Швидке тренування', minutes: 4, steps }, refs };
}
