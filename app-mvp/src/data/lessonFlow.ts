// Головна кнопка екрана уроку (ТЗ 007, п. 3). Чиста функція — під автотест.
// Послідовність завдання з власною перевіркою (пари, кілька варіантів, порядок, поля, число, історія):
// скласти відповідь → «Перевірити» (кнопка всередині завдання) → розбір → «Далі». До перевірки «Далі» немає — обійти завдання не можна.
// Вибір одного варіанта: «Перевірити» — це сама головна кнопка, після неї «Далі».
export type MainButton = { kind: 'hidden' } | { kind: 'start' | 'got' | 'check' | 'next' | 'finish'; enabled: boolean };

const OWN_CHECK = new Set(['match', 'multi', 'order', 'bundle', 'story', 'numeric']);
export const hasOwnCheck = (type: string) => OWN_CHECK.has(type);

export function mainButton(p: { type: string; answered: boolean; selected: boolean; last: boolean; quizStart?: boolean }): MainButton {
  if (p.type === 'teach') return { kind: p.quizStart ? 'start' : 'got', enabled: true };
  if (p.type === 'reflect') return { kind: p.last ? 'finish' : 'next', enabled: true };
  if (hasOwnCheck(p.type) && !p.answered) return { kind: 'hidden' };
  if ((p.type === 'choice' || p.type === 'fill') && !p.answered) return { kind: 'check', enabled: p.selected };
  return { kind: p.last ? 'finish' : 'next', enabled: p.answered };
}

export const MAIN_TITLE: Record<Exclude<MainButton['kind'], 'hidden'>, string> = { start: 'Старт', got: 'Зрозумів', check: 'Перевірити', next: 'Далі', finish: 'Завершити' };
