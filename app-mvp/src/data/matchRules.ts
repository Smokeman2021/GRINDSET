// Завдання «пари» у дві колонки (ТЗ 006, 3.4): чисті правила вибору й перевірки — під автотести.
// Ліва колонка — у порядку завдання, права — перемішана. Учень торкається елемента зліва, потім відповідника справа.
// assign: ліва позиція → індекс у правій колонці. Один правий елемент належить лише одній парі.

export type Assign = Record<number, number>;

// Вибір правого елемента для активного лівого: старі звʼязки цього правого й цього лівого знімаються
export function assignPair(a: Assign, left: number, right: number): Assign {
  const next: Assign = {};
  for (const [l, r] of Object.entries(a)) if (r !== right && Number(l) !== left) next[Number(l)] = r;
  next[left] = right;
  return next;
}

// Торкання правого без активного лівого: якщо правий уже в парі — пара знімається (щоб виправити)
export function unpairRight(a: Assign, right: number): Assign {
  const next: Assign = {};
  for (const [l, r] of Object.entries(a)) if (r !== right) next[Number(l)] = r;
  return next;
}

// Номер пари для правого елемента (для однакової позначки в обох колонках)
export function pairNoOfRight(a: Assign, right: number): number | null {
  for (const [l, r] of Object.entries(a)) if (r === right) return Number(l) + 1;
  return null;
}

export const allPaired = (a: Assign, n: number) => Object.keys(a).length === n;
export function matchOk(pairs: [string, string][], rights: string[], a: Assign): boolean {
  return pairs.every((p, li) => a[li] !== undefined && rights[a[li]] === p[1]);
}
