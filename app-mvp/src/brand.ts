// Бренд: назва курсу в одному місці. Назви продуктів третіх сторін (Facebook, Meta тощо) у шапці, назвах модулів,
// назві застосунку, іконках і метаданих не вживаємо; описові згадки в тексті уроків лишаються (див. docs/BRAND_MENTIONS.md).
import type { Lang } from './i18n/strings';

export const COURSE_NAME = 'Арбітраж трафіку';

// Назва курсу на інших мовах інтерфейсу. Перевірити автору.
export const COURSE_NAMES: Record<Lang, string> = {
  uk: COURSE_NAME,
  en: 'Traffic Arbitrage',
  ru: 'Арбитраж трафика',
};

// Дисклеймер про відсутність звʼязку з Meta Platforms, Inc.: дрібно на першому екрані онбордингу й у Налаштування → Про застосунок
export const META_DISCLAIMER: Record<Lang, string> = {
  uk: "GRINDSET не пов'язаний з Meta Platforms, Inc. і не схвалений нею.",
  en: 'GRINDSET is not affiliated with or endorsed by Meta Platforms, Inc.',
  ru: 'GRINDSET не связан с Meta Platforms, Inc. и не одобрен ею.',
};
