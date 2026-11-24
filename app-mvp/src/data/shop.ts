export type ShopCategory = 'Енергія' | 'Захист' | 'Бустери' | 'Косметика';

export type ShopItem = {
  id: string;
  category: ShopCategory;
  icon: string;
  title: string;
  desc: string;
  cost: number;
};

export const FRAMES: Record<string, { name: string; color: string; edge: string }> = {
  green: { name: 'Класична', color: '#36e27a', edge: '#1e9e55' },
  gold: { name: 'Золота', color: '#ffce4d', edge: '#c9982f' },
  blue: { name: 'Крижана', color: '#5aa7ff', edge: '#3d78c2' },
  fire: { name: 'Вогняна', color: '#ff7a3c', edge: '#c2531f' },
  violet: { name: 'Фіолетова', color: '#b78cff', edge: '#7e57c8' },
};

export const ITEMS: ShopItem[] = [
  { id: 'energy10', category: 'Енергія', icon: '⚡', title: '+10 енергії', desc: 'Один урок зверху', cost: 40 },
  { id: 'energy20', category: 'Енергія', icon: '⚡', title: '+20 енергії', desc: 'Два уроки зверху', cost: 70 },
  { id: 'energyFull', category: 'Енергія', icon: '🔋', title: 'Повна енергія', desc: 'Відновити до максимуму', cost: 110 },
  { id: 'freeze', category: 'Захист', icon: '❄️', title: 'Заморозка стріку', desc: 'Рятує серію, якщо пропустиш день. До 2 штук', cost: 150 },
  { id: 'shield3', category: 'Бустери', icon: '🛡️', title: 'Захист комбо ×3', desc: 'Помилка не обнуляє комбо, 3 рази', cost: 60 },
  { id: 'hint3', category: 'Бустери', icon: '💡', title: 'Підказки ×3', desc: 'Прибирає один хибний варіант у питанні', cost: 45 },
  { id: 'double', category: 'Бустери', icon: '✨', title: 'Подвійні коїни', desc: 'Наступний урок дає ×2 коїнів', cost: 100 },
  { id: 'frame_gold', category: 'Косметика', icon: '🟡', title: 'Золота рамка аватара', desc: 'Для профілю', cost: 200 },
  { id: 'frame_blue', category: 'Косметика', icon: '🔵', title: 'Крижана рамка аватара', desc: 'Для профілю', cost: 120 },
  { id: 'frame_fire', category: 'Косметика', icon: '🟠', title: 'Вогняна рамка аватара', desc: 'Для профілю', cost: 160 },
  { id: 'frame_violet', category: 'Косметика', icon: '🟣', title: 'Фіолетова рамка аватара', desc: 'Для профілю', cost: 240 },
];
