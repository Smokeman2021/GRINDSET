// Гілки вертикалей (ТЗ 004, C1/C2): типи даних, конструктори кроків і реєстр. Кожна гілка — окремий файл даних у ./branches/,
// рушій кроків спільний (екран app/lesson/[id].tsx). Старий курс (модулі 01–10) сюди не імпортується.
import type { Step } from './lessons';
import type { FinalPart } from './branchRules.ts';

export type BranchCode = 'TOV' | 'SRV' | 'INF' | 'NUT' | 'DAT' | 'GAM' | 'CRY' | 'ADT';

// Додаткові поля кроку гілки
export type StepExtra = {
  hint?: string; // підказка Гріндіка: за запитом або після помилки
  see?: string; // урок, де розбирається навичка (куди веде помилка)
  part?: FinalPart; // частина фіналу
  blockLaunch?: number[]; // варіанти «запускати» без допуску: блокують зарахування фіналу регульованої гілки
  src?: string; // формулювання завдання 023 (для звіту «023 → форма → відповідь»)
  explainField?: boolean; // показати необовʼязкове поле «твоє пояснення» (не оцінюється)
};
export type BStep = Step & StepExtra;

export type Unit = {
  id: string;
  title: string;
  steps: BStep[];
  kb: string[]; // картки «Бази» за ID
  ready: boolean; // конвертовано у форми з перевіркою
};

export type Branch = {
  code: BranchCode;
  title: string;
  emoji: string;
  kbCard: string; // повна картка вертикалі з 018 у «Базі»
  regulated: boolean;
  scenario: string;
  intro: string;
  wgb: string; // білий / сірий / чорний
  selfcheck: BStep[]; // рівно 2 завдання
  practice: Unit;
  lessons: Unit[];
  final: Unit | null; // TOV: фінал = тренажер «Ліди» (етап D)
};

// ───────── конструктори кроків ─────────
const OK = 'Вірно.';
const NO = 'Не зовсім.';
export function brief(title: string, body: string, extra: StepExtra = {}): BStep {
  return { type: 'teach', title, body, ...extra };
}
export function choice(q: string, options: string[], answer: number, explain: string, extra: StepExtra & { scenario?: string } = {}): BStep {
  return { type: 'choice', layer: 2, q, options, answer, okMsg: OK, noMsg: NO, explain, ...extra };
}
export function multi(q: string, options: string[], answers: number[], explain: string, extra: StepExtra & { scenario?: string } = {}): BStep {
  return { type: 'multi', layer: 2, q, options, answers, okMsg: OK, noMsg: NO, explain, ...extra };
}
export function numeric(q: string, fields: { label: string; answer: number; unit?: string; tolerance?: number }[], explain: string, extra: StepExtra & { scenario?: string } = {}): BStep {
  return { type: 'numeric', layer: 2, q, fields, okMsg: OK, noMsg: NO, explain, ...extra };
}
export function order(q: string, items: string[], explain: string, extra: StepExtra & { scenario?: string } = {}): BStep {
  return { type: 'order', layer: 2, q, items, okMsg: OK, noMsg: NO, explain, ...extra };
}
export function match(q: string, pairs: [string, string][], explain: string, extra: StepExtra & { scenario?: string } = {}): BStep {
  return { type: 'match', layer: 2, q, pairs, okMsg: OK, noMsg: NO, explain, ...extra };
}
// Урок / фінал у формах з перевіркою
export function unit(id: string, title: string, kb: string[], steps: BStep[]): Unit {
  return { id, title, kb, steps, ready: true };
}
// Плашка для правил майданчика без запису в content/policy-facts.json (REVIEWER-EDITS п. 2)
export const POLICY_PENDING = '⚠️ Вимога майданчика (Meta Advertising Standards): до звірки. Конкретні правила не стверджуємо, поки немає підтвердженого запису.';

// Урок, ще не конвертований у форми: на екрані сірий, без «скоро»
export function pending(id: string, title: string, kb: string[] = []): Unit {
  return { id, title, steps: [], kb, ready: false };
}
