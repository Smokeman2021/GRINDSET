// Чисті правила тренажера «Ліди» (ТЗ 004, етап D): стан на пристрої й у клієнтському знімку, критерії розбору, злиття.
// Без імпортів React і стору: перевіряється автотестами.

export type Level = 'campaign' | 'adset' | 'ad';
export const LEVEL_LABEL: Record<Level, string> = { campaign: 'Кампанія', adset: 'Набір реклами', ad: 'Реклама' };

// Стан тренажера. step — індекс поточного кроку; res — останній результат кроку; first — перша спроба (для точності);
// seen — відкриті пояснення цілей; variants — переглянуті варіанти повтору; back — повернутись до розбору після кроку
export type SimLeadsState = {
  step: number;
  res: Record<string, boolean>;
  first: Record<string, boolean>;
  seen: string[];
  variants: string[];
  back?: boolean;
  done?: boolean;
  at: number;
};

export const SIM_FRESH: SimLeadsState = { step: 0, res: {}, first: {}, seen: [], variants: [], at: 0 };

// Результат кроку: перша спроба фіксується один раз, останній результат оновлюється при повторі з розбору
export function recordStep(s: SimLeadsState, id: string, ok: boolean, now: number): { state: SimLeadsState; isFirst: boolean } {
  const isFirst = !(id in s.first);
  return {
    state: { ...s, res: { ...s.res, [id]: ok }, first: isFirst ? { ...s.first, [id]: ok } : s.first, at: now },
    isFirst,
  };
}

// mandatory — обовʼязковий для зарахування (ТЗ 006, APPROVED п. 5: критерії 2, 3, 6, 7 і крок повтору без варіанта В)
export type Criterion = { n: number; text: string; steps: string[]; mandatory?: boolean };

// Критерій виконано, коли всі його кроки зараховані (за останньою спробою)
export function gradeCriteria(criteria: Criterion[], res: Record<string, boolean>): { n: number; ok: boolean; mandatory: boolean; retry?: string }[] {
  return criteria.map((c) => {
    const failed = c.steps.find((id) => res[id] !== true);
    return { n: c.n, ok: failed === undefined, mandatory: !!c.mandatory, retry: failed };
  });
}

// Зарахування тренажера: усі обовʼязкові критерії виконано. Розбір відкривається завжди, незалежно від цього.
export function simPassed(criteria: Criterion[], res: Record<string, boolean>): boolean {
  return gradeCriteria(criteria, res).every((g) => !g.mandatory || g.ok);
}

// Повтор з однією зміною (APPROVED п. 6). Для зарахування: крок виконано, якщо обрано не В.
// Точність: А — вірно; В — помилка; Б сам по собі не помилка — у точність іде відповідь на питання «Що змінює варіант Б?» (check).
// Поки на питання Б не відповіли, у точність нічого не йде.
export type VariantId = 'A' | 'B' | 'C';
export function variantAccuracy(id: VariantId, check?: boolean): boolean | undefined {
  if (id === 'A') return true;
  if (id === 'C') return false;
  return check;
}
export function recordVariant(s: SimLeadsState, stepId: string, id: VariantId, check: boolean | undefined, now: number): { state: SimLeadsState; accuracy?: { ok: boolean; isFirst: boolean } } {
  const res = { ...s.res, [stepId]: id !== 'C' };
  const acc = variantAccuracy(id, check);
  const variants = s.variants.includes(id) ? s.variants : [...s.variants, id];
  if (acc === undefined) return { state: { ...s, res, variants, at: now } };
  const isFirst = !(stepId in s.first);
  return {
    state: { ...s, res, variants, first: isFirst ? { ...s.first, [stepId]: acc } : s.first, at: now },
    accuracy: { ok: acc, isFirst },
  };
}

// Злиття між пристроями: завершений тренажер не відкочується; інакше перемагає новіший запис
export function mergeSimLeads(local: unknown, server: unknown): SimLeadsState {
  const ok = (v: unknown): v is SimLeadsState => !!v && typeof v === 'object' && typeof (v as SimLeadsState).step === 'number';
  const l = ok(local) ? local : undefined;
  const s = ok(server) ? server : undefined;
  if (!l) return s ?? SIM_FRESH;
  if (!s) return l;
  const win = (l.at ?? 0) >= (s.at ?? 0) ? l : s;
  const lose = win === l ? s : l;
  return {
    ...win,
    first: { ...lose.first, ...win.first },
    seen: [...new Set([...(lose.seen ?? []), ...(win.seen ?? [])])],
    variants: [...new Set([...(lose.variants ?? []), ...(win.variants ?? [])])],
    done: !!(l.done || s.done),
  };
}

// Розставлення параметрів по рівнях: правильно, коли кожен параметр на своєму рівні
export function levelsOk(items: { level: Level }[], picked: (Level | undefined)[]): boolean {
  return items.every((it, i) => picked[i] === it.level);
}

// Список заявок: правильно, коли позначено рівно ті, що не дійшли до CRM
export function leadsOk(rows: { extra?: string }[], picked: number[]): boolean {
  const want = rows.map((r, i) => (r.extra ? i : -1)).filter((i) => i >= 0);
  return want.length === picked.length && want.every((i) => picked.includes(i));
}
