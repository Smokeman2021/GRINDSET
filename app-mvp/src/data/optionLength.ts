// Правило довжини варіантів (ТЗ 006, 5.2; REVIEW-CONTENT-b26 §6): правильний варіант не довший за 1,2 × найдовшого з інших.
// Для multi — кожен правильний проти найдовшого неправильного. Чиста логіка без React: збирає всі вибори гілок, вправ «Бази»
// й тренажера «Ліди» для автотесту й скрипта scripts/check-option-length.ts.
import { BRANCHES } from './branches/index.ts';
import { SIM_STEPS, VARIANT_B_CHECK } from './simLeads.ts';
import type { BStep } from './branch.ts';

export const LENGTH_RATIO = 1.2;
export type ChoiceItem = { where: string; q: string; options: string[]; correct: number[]; exception?: string };

// Задокументовані винятки: варіанти природно різної довжини (поле з числом проти фрази тощо). Порожніх слів для вирівнювання не додаємо.
export const LENGTH_EXCEPTIONS: Record<string, string> = {};

const len = (s: string) => s.replace(/\s+/g, ' ').trim().length;
export function ratioOf(c: ChoiceItem): number {
  const wrong = c.options.filter((_, i) => !c.correct.includes(i));
  if (!wrong.length) return 0;
  const maxWrong = Math.max(...wrong.map(len));
  return Math.max(...c.correct.map((i) => len(c.options[i]))) / Math.max(1, maxWrong);
}

function fromStep(where: string, s: BStep, out: ChoiceItem[]) {
  if (s.type === 'choice') out.push({ where, q: s.q, options: s.options, correct: [s.answer] });
  else if (s.type === 'multi') out.push({ where, q: s.q, options: s.options, correct: s.answers });
  else if (s.type === 'bundle') s.slots.forEach((sl, k) => out.push({ where: `${where}#${k + 1}`, q: `${s.q} · ${sl.label}`, options: sl.options, correct: [sl.answer] }));
}

type ExField = { id: string; type: string; label: string; options?: string[]; correct?: number | number[] };
export function collectChoices(exercises: Record<string, Record<string, { fields: ExField[] }>>): ChoiceItem[] {
  const out: ChoiceItem[] = [];
  for (const b of BRANCHES) {
    b.selfcheck.forEach((s, i) => fromStep(`BR-${b.code}-SC/${i + 1}`, s, out));
    for (const u of [...b.lessons, b.practice, ...(b.final && !b.final.sim ? [b.final] : [])]) u.steps.forEach((s, i) => fromStep(`${u.id}/${i + 1}`, s, out));
  }
  for (const [id, langs] of Object.entries(exercises)) {
    if (id.startsWith('_')) continue;
    const uk = langs.uk;
    if (!uk) continue;
    for (const f of uk.fields) {
      if (f.type === 'choice' && f.options) out.push({ where: `${id}/${f.id}`, q: f.label, options: f.options, correct: [f.correct as number] });
      if (f.type === 'multi' && f.options) out.push({ where: `${id}/${f.id}`, q: f.label, options: f.options, correct: f.correct as number[] });
    }
  }
  for (const s of SIM_STEPS) if (s.kind === 'step') fromStep(`BR-TOV-FINAL/${s.id}`, s.step, out);
  out.push({ where: 'BR-TOV-FINAL/variant-B', q: VARIANT_B_CHECK.q, options: VARIANT_B_CHECK.options, correct: [VARIANT_B_CHECK.answer] });
  for (const c of out) if (LENGTH_EXCEPTIONS[c.where]) c.exception = LENGTH_EXCEPTIONS[c.where];
  return out;
}
