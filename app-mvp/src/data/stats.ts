// Характеристики персонажа: очки видаються за підвищення рівня, гравець сам розподіляє їх.
// Поки що суто прогресія напоказ — вплив на групову міні-гру додамо, коли вона з'явиться.

export type StatId = 'budget' | 'creative' | 'analytics' | 'nerve';

export type StatDef = { id: StatId; icon: string; label: string; desc: string };

export const STAT_DEFS: StatDef[] = [
  { id: 'budget', icon: '💰', label: 'Бюджет', desc: 'Розподіл і масштабування витрат' },
  { id: 'creative', icon: '🎨', label: 'Крео', desc: 'Ідеї, що зупиняють скрол' },
  { id: 'analytics', icon: '📊', label: 'Аналітика', desc: 'Читання метрик і рішення на цифрах' },
  { id: 'nerve', icon: '🧊', label: 'Витримка', desc: 'Холодна голова при бані й холді' },
];

export const STAT_MAX = 20;
export const POINTS_PER_LEVEL = 2;

export type StatAlloc = Record<StatId, number>;

export const FRESH_STATS: StatAlloc = { budget: 0, creative: 0, analytics: 0, nerve: 0 };

export function statTotal(alloc: StatAlloc): number {
  return STAT_DEFS.reduce((sum, d) => sum + (alloc[d.id] ?? 0), 0);
}
