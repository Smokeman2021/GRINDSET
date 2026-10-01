// Щоденні завдання: щодня 3 випадкові (але однакові для всього дня), нагорода в коїнах.
export type Metric = 'xp' | 'lessons' | 'combo' | 'perfect' | 'quiz' | 'fixed';

export type QuestDef = {
  id: string;
  metric: Metric;
  icon: string;
  title: string;
  target: number;
  reward: number;
};

export const QUEST_POOL: QuestDef[] = [
  { id: 'xp30', metric: 'xp', icon: '⭐', title: 'Набери 30 XP', target: 30, reward: 25 },
  { id: 'xp60', metric: 'xp', icon: '🌟', title: 'Набери 60 XP', target: 60, reward: 45 },
  { id: 'lessons2', metric: 'lessons', icon: '📚', title: 'Пройди 2 уроки', target: 2, reward: 35 },
  { id: 'lessons1', metric: 'lessons', icon: '📖', title: 'Пройди 1 урок', target: 1, reward: 20 },
  { id: 'combo5', metric: 'combo', icon: '🔥', title: 'Комбо ×5 в одному уроці', target: 5, reward: 40 },
  { id: 'perfect1', metric: 'perfect', icon: '🎯', title: 'Урок без жодної помилки', target: 1, reward: 50 },
  { id: 'quiz1', metric: 'quiz', icon: '⏱️', title: 'Пройди квіз на час', target: 1, reward: 45 },
  { id: 'fixed3', metric: 'fixed', icon: '🩹', title: 'Надолужи 3 помилки', target: 3, reward: 35 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 3 завдання дня з різними метриками
export function questsForDay(date: string): QuestDef[] {
  const pool = [...QUEST_POOL].sort((a, b) => hash(date + a.id) - hash(date + b.id));
  const picked: QuestDef[] = [];
  for (const q of pool) {
    if (picked.some((p) => p.metric === q.metric)) continue;
    picked.push(q);
    if (picked.length === 3) break;
  }
  return picked;
}
