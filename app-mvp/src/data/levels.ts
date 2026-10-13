// Титули рівнів гравця (з візії продукту, розширені до 10).
export const LEVEL_TITLES = [
  'Щойно дізнався що є арбітраж',
  'Вже читав про це в телеграмі',
  'Злив перший бюджет на навчання',
  'Знає різницю між CPM і CPC',
  'Розібрався з пікселем з третього разу',
  'Пише автоправила уві сні',
  'Перший плюс. Мама пишається',
  'Дивиться на дані, а не на відчуття',
  'Кабінет знає краще за власну кухню',
  'Junior. Реально вміє',
];

export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(Math.max(level, 1), LEVEL_TITLES.length) - 1];

// Пороги XP для рівня (кумулятивно). Рівень = найвищий поріг, який досягнуто.
export const LEVEL_THRESHOLDS = [0, 40, 90, 150, 220, 300, 400, 520, 660, 820];

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

// Прогрес усередині рівня; на максимальному рівні need = 0
export function levelProgress(xp: number): { have: number; need: number; pct: number } {
  const lvl = levelForXp(xp);
  if (lvl >= LEVEL_THRESHOLDS.length) return { have: 0, need: 0, pct: 1 };
  const from = LEVEL_THRESHOLDS[lvl - 1];
  const to = LEVEL_THRESHOLDS[lvl];
  return { have: xp - from, need: to - from, pct: (xp - from) / (to - from) };
}
