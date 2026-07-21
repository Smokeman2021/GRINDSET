export type QuizStep = {
  q: string;
  key: 'goal' | 'exp' | 'budget' | 'time' | 'mode';
  options: { emoji: string; text: string }[];
};

export const QUIZ: QuizStep[] = [
  {
    q: 'Яка твоя ціль?',
    key: 'goal',
    options: [
      { emoji: '💰', text: 'Хочу заробляти' },
      { emoji: '📈', text: 'Розвиватись як спеціаліст' },
      { emoji: '🔍', text: 'Просто цікаво що це' },
      { emoji: '💼', text: 'Запустити свій бізнес через рекламу' },
    ],
  },
  {
    q: 'Твій досвід?',
    key: 'exp',
    options: [
      { emoji: '🦴', text: 'Нічого. Перший раз чую' },
      { emoji: '📱', text: 'Чув, читав, але не запускав' },
      { emoji: '🚀', text: 'Запускав, є базовий досвід' },
      { emoji: '⚡', text: 'Вже працюю в темі' },
    ],
  },
  {
    q: 'Бюджет на старт?',
    key: 'budget',
    options: [
      { emoji: '🪙', text: 'Мінімум — до $50' },
      { emoji: '💵', text: 'Стандарт — $100-300' },
      { emoji: '💎', text: 'Серйозно — $300+' },
      { emoji: '🤷', text: 'Поки не знаю' },
    ],
  },
  {
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
    q: 'Як вчимось?',
    key: 'mode',
    options: [
      { emoji: '📖', text: 'Спочатку теорія, потім практика' },
      { emoji: '⚡', text: 'Паралельно теорія + практика' },
    ],
  },
];
