// Тижнева ліга. Онлайн-суперників ще нема (бекенд поза MVP), тому решту ліги грають боти:
// їхній XP детермінований від тижня й імені, тож рейтинг не стрибає при перезапуску.
export const TIERS = [
  { name: 'Бронза', icon: '🥉', color: '#cd8a4b', base: 70 },
  { name: 'Срібло', icon: '🥈', color: '#b8c2d0', base: 100 },
  { name: 'Золото', icon: '🥇', color: '#ffce4d', base: 140 },
  { name: 'Сапфір', icon: '💠', color: '#5aa7ff', base: 190 },
  { name: 'Рубін', icon: '♦️', color: '#ff5c7a', base: 250 },
  { name: 'Діамант', icon: '💎', color: '#7be8ff', base: 330 },
] as const;

export const LEAGUE_SIZE = 20; // гравець + 19 ботів
export const PROMOTE_TOP = 5;
export const DEMOTE_BOTTOM = 4;

const BOT_NAMES = [
  'Наливатор', 'Апрув99', 'CPA_Мисливець', 'Крео_Кіт', 'ROI_Ромчик', 'Піксель_Паша', 'Білінг_Бро',
  'Тімлід_Олег', 'Лідогон', 'Спай_Сергій', 'Ленд_Льоша', 'Метрика', 'Автоправило', 'Холодний_літ',
  'Look_alike', 'Ретаргет', 'ЦПА_Тарас', 'Хук_Хома', 'Скейл_Сашко', 'Бюджет_Богдан', 'Ад_Сет',
];

export type Rival = { name: string; xp: number; me?: boolean };

const MS_DAY = 86400000;

export function weekStartStr(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // понеділок = 0
  x.setDate(x.getDate() - dow);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// маленький детермінований генератор [0,1)
function rnd(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// скільки тижня минуло (0..1); для завершеного тижня = 1
export function weekFraction(weekId: string, now = new Date()): number {
  const start = new Date(`${weekId}T00:00:00`).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / (7 * MS_DAY)));
}

export function rivalsFor(weekId: string, tier: number, frac: number): Rival[] {
  const base = TIERS[tier].base;
  const start = 3 + Math.floor(rnd(`${weekId}:${tier}:off`) * 3); // зсув у списку імен
  return Array.from({ length: LEAGUE_SIZE - 1 }, (_, k) => {
    const name = BOT_NAMES[(start + k) % BOT_NAMES.length];
    const goal = base * (0.35 + 1.25 * rnd(`${weekId}:${tier}:${name}`));
    const pace = 0.85 + 0.3 * rnd(`${weekId}:${name}:pace`);
    return { name, xp: Math.round(goal * Math.min(1, Math.pow(frac, pace))) };
  });
}

export function standings(weekId: string, tier: number, myName: string, myXp: number, frac: number): Rival[] {
  const all = [...rivalsFor(weekId, tier, frac), { name: myName || 'Гравець', xp: myXp, me: true }];
  // при рівності XP гравець вище
  return all.sort((a, b) => b.xp - a.xp || (a.me ? -1 : b.me ? 1 : 0));
}

export const rankOf = (list: Rival[]) => list.findIndex((r) => r.me) + 1;

export type LeagueOutcome = 'up' | 'down' | 'stay';

export function outcomeFor(rank: number, tier: number): LeagueOutcome {
  if (rank <= PROMOTE_TOP && tier < TIERS.length - 1) return 'up';
  if (rank > LEAGUE_SIZE - DEMOTE_BOTTOM && tier > 0) return 'down';
  return 'stay';
}
