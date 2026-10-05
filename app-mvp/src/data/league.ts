// Тижнева ліга. Онлайн-суперників ще нема (бекенд поза MVP), тому решту ліги грають симульовані суперники:
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

// Ніки схожі на справжні: імена, ініціали, латиниця, цифри, міста
const BOT_NAMES = [
  'Олег К.', 'Марія', 'vlad_88', 'Дмитро Р.', 'Анастасія', 'Богдан', 'andrii.k', 'Софія_UA', 'Макс',
  'Іра Львів', 'ivan_p', 'Оксана', 'Тарас М.', 'Катерина', 'Юрій', 'Настя', 'sasha_dn', 'Влад Одеса',
  'Ліза', 'Роман К.', 'Denys', 'Вікторія', 'Артем_Х', 'Ніка', 'oleksii94', 'Максим Т.', 'Діана', 'Павло',
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

// У кожного бота свій характер (інтенсивність, регулярність) і свої щоденні сплески: XP росте днями,
// а не плавною кривою, і не залежить від XP гравця
export function rivalsFor(weekId: string, tier: number, frac: number): Rival[] {
  const base = TIERS[tier].base;
  const start = 3 + Math.floor(rnd(`${weekId}:${tier}:off`) * 3); // зсув у списку імен
  const days = Math.min(7, Math.max(0, frac * 7));
  const full = Math.floor(days);
  const part = days - full;
  return Array.from({ length: LEAGUE_SIZE - 1 }, (_, k) => {
    const name = BOT_NAMES[(start + k) % BOT_NAMES.length];
    const seed = `${weekId}:${tier}:${name}`;
    const power = 0.25 + 1.9 * Math.pow(rnd(`${seed}:pow`), 1.4); // розкид «сили» від ледачих до запеклих
    const regular = 0.45 + 0.5 * rnd(`${seed}:reg`); // імовірність активного дня
    const dayXp = (d: number) =>
      rnd(`${seed}:on:${d}`) < regular ? (base / 7 / regular) * power * (0.35 + 1.3 * rnd(`${seed}:amt:${d}`)) : 0;
    let xp = 0;
    for (let d = 0; d < full; d++) xp += dayXp(d);
    // поточна доба: бот «встає» не одразу, тож частка зростає нерівно
    xp += dayXp(full) * Math.pow(part, 0.8 + 0.8 * rnd(`${seed}:pace`));
    return { name, xp: Math.round(xp) };
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
