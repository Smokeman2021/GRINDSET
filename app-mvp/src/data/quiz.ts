// Опитування перед грою (15 питань): будує особистий лінійний план. Чернетка була в content/adaptive-questionnaire.md.
export type Option = { emoji: string; text: string; soon?: boolean };

export type ChoiceStep = { kind: 'choice'; q: string; key: string; hint?: string; options: Option[] };
export type SkillsStep = { kind: 'skills'; q: string; hint?: string; skills: { key: string; label: string }[] };
export type QuizStep = ChoiceStep | SkillsStep;

export const SKILL_LEVELS = ['Не знаю', 'Чув', 'Вмію', 'Можу навчити'] as const;

export const QUIZ: QuizStep[] = [
  {
    kind: 'choice',
    q: 'Яка твоя головна мета?',
    key: 'goal',
    options: [
      { emoji: '💰', text: 'Заробляти на арбітражі' },
      { emoji: '💼', text: 'Стати найманим баєром' },
      { emoji: '🚀', text: 'Запустити власний бізнес через рекламу' },
      { emoji: '🔍', text: 'Просто розібратись, що це' },
    ],
  },
  {
    kind: 'choice',
    q: 'Який дохід хочеш за рік на місяць?',
    key: 'income',
    hint: 'Для мотивації, не гарантія результату',
    options: [
      { emoji: '🌱', text: 'До $500' },
      { emoji: '💵', text: '$500–2000' },
      { emoji: '💎', text: '$2000–5000' },
      { emoji: '🏔️', text: 'Більше $5000' },
    ],
  },
  {
    kind: 'choice',
    q: 'Твій досвід у рекламі?',
    key: 'exp',
    options: [
      { emoji: '🦴', text: 'Нічого. Перший раз чую' },
      { emoji: '📱', text: 'Чув, читав, але не запускав' },
      { emoji: '🚀', text: 'Запускав, є базовий досвід' },
      { emoji: '⚡', text: 'Вже працюю в темі' },
    ],
  },
  {
    kind: 'choice',
    q: 'А з рекламним кабінетом Facebook?',
    key: 'cabinet',
    options: [
      { emoji: '🙈', text: 'Не бачив' },
      { emoji: '👀', text: 'Бачив, але не запускав' },
      { emoji: '🎯', text: 'Запускав кампанії' },
      { emoji: '🧠', text: 'Керую бюджетами' },
    ],
  },
  {
    kind: 'skills',
    q: 'Що ти вже вмієш?',
    hint: 'Так я запропоную пропустити знайоме',
    skills: [
      { key: 'sk_metrics', label: 'Метрики (CPM, CTR, CPA, ROI)' },
      { key: 'sk_offers', label: 'Офери й партнерки' },
      { key: 'sk_creo', label: 'Креативи й тексти' },
      { key: 'sk_lands', label: 'Ленди й преленди' },
      { key: 'sk_safety', label: 'Акаунти, безпека, платежі' },
      { key: 'sk_analytics', label: 'Аналітика й оптимізація' },
    ],
  },
  {
    kind: 'choice',
    q: 'Бюджет на старт?',
    key: 'budget',
    options: [
      { emoji: '🪙', text: 'Мінімум, до $50' },
      { emoji: '💵', text: 'Стандарт, $100-300' },
      { emoji: '💎', text: 'Серйозно, $300+' },
      { emoji: '🤷', text: 'Поки не знаю' },
    ],
  },
  {
    kind: 'choice',
    q: 'Скільки часу в день?',
    key: 'time',
    options: [
      { emoji: '⚡', text: '5-10 хвилин' },
      { emoji: '📚', text: '15-20 хвилин' },
      { emoji: '🔥', text: '30+ хвилин' },
      { emoji: '💪', text: 'Скільки треба' },
    ],
  },
  {
    kind: 'choice',
    q: 'Як вчимось?',
    key: 'mode',
    options: [
      { emoji: '📖', text: 'Спочатку теорія, потім практика' },
      { emoji: '⚡', text: 'Паралельно теорія + практика' },
      { emoji: '🎮', text: 'Одразу практика, мінімум тексту' },
    ],
  },
  {
    kind: 'choice',
    q: 'Що лякає найбільше?',
    key: 'fear',
    options: [
      { emoji: '🚫', text: 'Бани й блокування' },
      { emoji: '💸', text: 'Злити бюджет' },
      { emoji: '🛠️', text: 'Техніка й налаштування' },
      { emoji: '🈳', text: 'Не розумію термінів' },
      { emoji: '⏳', text: 'Не вистачає часу' },
    ],
  },
  {
    kind: 'choice',
    q: 'Коли хочеш перший запуск?',
    key: 'deadline',
    options: [
      { emoji: '🔥', text: 'За тиждень' },
      { emoji: '📅', text: 'За місяць' },
      { emoji: '🗓️', text: 'За три місяці' },
      { emoji: '🌊', text: 'Без дедлайну' },
    ],
  },
  {
    kind: 'choice',
    q: 'Яка вертикаль цікавить?',
    key: 'vertical',
    hint: 'Інші відкриються після проходження бази',
    options: [
      { emoji: '📦', text: 'Товарка' },
      { emoji: '🧴', text: 'Нутра', soon: true },
      { emoji: '🎰', text: 'Гемблінг', soon: true },
      { emoji: '💳', text: 'Фінанси', soon: true },
      { emoji: '🤷', text: 'Ще не знаю' },
    ],
  },
];

// Майбутні маршрути: показуються затемненими
export const FUTURE_ROUTES = [
  { emoji: '🧴', title: 'Нутра', note: 'Скоро · після проходження бази' },
  { emoji: '🎰', title: 'Гемблінг', note: 'Скоро · після проходження бази' },
  { emoji: '💳', title: 'Фінанси', note: 'Скоро · після проходження бази' },
  { emoji: '📷', title: 'Instagram', note: 'Скоро' },
  { emoji: '🎵', title: 'TikTok', note: 'Скоро' },
  { emoji: '🛒', title: 'E-commerce', note: 'Скоро' },
];
