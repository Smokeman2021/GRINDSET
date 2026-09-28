// Словник інтерфейсу (не контент уроків — той лишається українською, переклад контенту окремим етапом).
// uk — канонічний текст застосунку, en/ru — переклад лише для елементів інтерфейсу нижче.

export type Lang = 'uk' | 'en' | 'ru';

export const LANG_LABEL: Record<Lang, string> = { uk: 'Українська', en: 'English', ru: 'Русский' };

export type StringKey = keyof typeof STRINGS.uk;

export const STRINGS = {
  uk: {
    tabLessons: 'Уроки',
    tabLibrary: 'Бібліотека',
    tabShop: 'Магазин',
    tabLeague: 'Рейтинг',
    tabProfile: 'Профіль',
    titleHome: 'FB АРБІТРАЖ',
    titleLibrary: 'БІБЛІОТЕКА',
    titleProfile: 'ПРОФІЛЬ',
    titleShop: 'МАГАЗИН',
    titleLeague: 'РЕЙТИНГ',
    language: 'Мова інтерфейсу',
    languageNote: 'Модулі 03-10 перекладено, модулі 01-02 і частина інтерфейсу поки лише українською.',
  },
  en: {
    tabLessons: 'Lessons',
    tabLibrary: 'Library',
    tabShop: 'Shop',
    tabLeague: 'Leaderboard',
    tabProfile: 'Profile',
    titleHome: 'FB ARBITRAGE',
    titleLibrary: 'LIBRARY',
    titleProfile: 'PROFILE',
    titleShop: 'SHOP',
    titleLeague: 'LEADERBOARD',
    language: 'Interface language',
    languageNote: 'Modules 03-10 are translated; modules 01-02 and part of the interface are still Ukrainian-only.',
  },
  ru: {
    tabLessons: 'Уроки',
    tabLibrary: 'Библиотека',
    tabShop: 'Магазин',
    tabLeague: 'Рейтинг',
    tabProfile: 'Профиль',
    titleHome: 'FB АРБИТРАЖ',
    titleLibrary: 'БИБЛИОТЕКА',
    titleProfile: 'ПРОФИЛЬ',
    titleShop: 'МАГАЗИН',
    titleLeague: 'РЕЙТИНГ',
    language: 'Язык интерфейса',
    languageNote: 'Модули 03-10 переведены, модули 01-02 и часть интерфейса пока только на украинском.',
  },
} as const;
