// Перемішування варіантів питання (копія логіки зі старого курсу, щоб рушій гілок не тягнув файли модулів 01–10 у бандл)
import type { Question } from './lessons';

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleQuestion<Q extends Question>(q: Q): Q {
  if (q.type === 'choice' || q.type === 'fill' || q.type === 'multi') {
    const order = shuffled(q.options.map((_, i) => i));
    const options = order.map((i) => q.options[i]);
    const extra = q as unknown as { blockLaunch?: number[] };
    const blockLaunch = extra.blockLaunch?.map((b) => order.indexOf(b));
    if (q.type === 'multi') return { ...q, options, answers: q.answers.map((a) => order.indexOf(a)), ...(blockLaunch ? { blockLaunch } : {}) };
    return { ...q, options, answer: order.indexOf(q.answer), ...(blockLaunch ? { blockLaunch } : {}) };
  }
  if (q.type === 'bundle') {
    return {
      ...q,
      slots: q.slots.map((sl) => {
        const o = shuffled(sl.options.map((_, i) => i));
        return { ...sl, options: o.map((i) => sl.options[i]), answer: o.indexOf(sl.answer) };
      }),
    };
  }
  if (q.type === 'story') return { ...q, scenes: q.scenes.map((sc) => ({ ...sc, options: shuffled(sc.options) })) };
  return q;
}
