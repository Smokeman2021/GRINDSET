// Досягнення рахуються зі статистики гравця; у сторі зберігаються лише відкриті id.
export type Stats = {
  lessons: number;
  streak: number;
  level: number;
  perfectLessons: number;
  totalCoinsEarned: number;
  purchases: number;
  mistakesFixed: number;
  goldenGlasses: boolean;
  crowns: number;
  quizzes: number;
};

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  test: (s: Stats) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🚀', title: 'Перший крок', desc: 'Пройди перший урок', test: (s) => s.lessons >= 1 },
  { id: 'lessons5', icon: '📚', title: 'Розганяюсь', desc: 'Пройди 5 уроків', test: (s) => s.lessons >= 5 },
  { id: 'lessons20', icon: '🎓', title: 'Студент року', desc: 'Пройди 20 уроків', test: (s) => s.lessons >= 20 },
  { id: 'streak3', icon: '🔥', title: 'Звичка пішла', desc: 'Стрік 3 дні', test: (s) => s.streak >= 3 },
  { id: 'streak7', icon: '🌋', title: 'Тиждень без пропусків', desc: 'Стрік 7 днів', test: (s) => s.streak >= 7 },
  { id: 'streak30', icon: '☄️', title: 'Характер', desc: 'Стрік 30 днів', test: (s) => s.streak >= 30 },
  { id: 'perfect', icon: '🎯', title: 'Чистий прохід', desc: 'Урок без жодної помилки', test: (s) => s.perfectLessons >= 1 },
  { id: 'perfect5', icon: '💯', title: 'Перфекціоніст', desc: '5 уроків без помилок', test: (s) => s.perfectLessons >= 5 },
  { id: 'glasses', icon: '😎', title: 'Золоті окуляри', desc: 'Діагностичний тест без помилок з першої спроби', test: (s) => s.goldenGlasses },
  { id: 'crown', icon: '👑', title: 'Корона', desc: 'Закрий модуль тестом на корону', test: (s) => s.crowns >= 1 },
  { id: 'quiz', icon: '⏱️', title: 'Швидкі руки', desc: 'Пройди квіз на час', test: (s) => s.quizzes >= 1 },
  { id: 'coins500', icon: '🪙', title: 'Перші 500', desc: 'Заробити 500 коїнів за весь час', test: (s) => s.totalCoinsEarned >= 500 },
  { id: 'shop', icon: '🛍️', title: 'Перша покупка', desc: 'Купи щось у магазині', test: (s) => s.purchases >= 1 },
  { id: 'fixer', icon: '🩹', title: 'Робота над помилками', desc: 'Надолужи 10 помилок', test: (s) => s.mistakesFixed >= 10 },
  { id: 'lvl5', icon: '⭐', title: 'Рівень 5', desc: 'Досягни 5 рівня', test: (s) => s.level >= 5 },
  { id: 'lvl10', icon: '🏆', title: 'Junior', desc: 'Досягни 10 рівня', test: (s) => s.level >= 10 },
];
