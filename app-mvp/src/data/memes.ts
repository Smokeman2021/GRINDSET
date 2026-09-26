// Мем-картки: Гріндік у позі + підпис зверху й знизу (малюється кодом, тому текст легко міняти).
// Відкриваються разом із досягненням `unlockedBy`. Гумор арбітражний, самоіронічний.
import type { PoseName } from './poses';

export type Meme = { id: string; pose: PoseName; top: string; bottom: string; bg: string; unlockedBy: string };

export const MEMES: Meme[] = [
  { id: 'm-first', pose: 'shrug', top: 'КОЛИ ЗЛИВ ПЕРШИЙ БЮДЖЕТ', bottom: 'І ОДРАЗУ ЗАПУСТИВ ДРУГИЙ', bg: '#3a1f1f', unlockedBy: 'first' },
  { id: 'm-l5', pose: 'think', top: 'CPA $8, ВИПЛАТА $6', bottom: '«МАЙЖЕ В ПЛЮС»', bg: '#1f2a3a', unlockedBy: 'lessons5' },
  { id: 'm-perfect', pose: 'point', top: 'АПРУВ 40%', bottom: 'А В ЧАТІ КАЖУТЬ, ЩО 90', bg: '#2b3a1f', unlockedBy: 'perfect' },
  { id: 'm-quiz', pose: 'think', top: 'ТРЕКЕР НЕ БАЧИТЬ КОНВЕРСІЙ', bottom: 'ПІКСЕЛЬ: Я ТУТ ВЗАГАЛІ НІ ПРИЧОМУ', bg: '#332a1a', unlockedBy: 'quiz' },
  { id: 'm-streak3', pose: 'point', top: 'ПЕРШИЙ ДЕНЬ БЕЗ ЛІДІВ', bottom: 'Я: ПАНІКА. АЛГОРИТМ: ПРИСТРІЛЮЮСЬ', bg: '#2a1f3a', unlockedBy: 'streak3' },
  { id: 'm-coins', pose: 'cheer', top: 'ЗБІЛЬШИВ БЮДЖЕТ ВДВІЧІ', bottom: 'КАБІНЕТ: ДЯКУЮ ЗА ДОНАТ', bg: '#3a331f', unlockedBy: 'coins500' },
  { id: 'm-fixer', pose: 'shrug', top: 'АКАУНТ У БАНІ', bottom: 'МАМА: СИНУ, ТИ ЗНОВУ РЕКЛАМУ ЗАПУСКАВ?', bg: '#3a1f2a', unlockedBy: 'fixer' },
  { id: 'm-crown', pose: 'crown', top: 'ТІМЛІД: ЩО З ROI?', bottom: 'Я: ВОНО ЕМОЦІЙНО ПЛЮСОВЕ', bg: '#1f3a33', unlockedBy: 'crown' },
  { id: 'm-l20', pose: 'laptop', top: 'ЗАПИСАВ, ЩО ЗМІНИВ?', bottom: 'ТАК. У ГОЛОВІ. НАЗАВЖДИ.', bg: '#1f2f3a', unlockedBy: 'lessons20' },
  { id: 'm-lvl5', pose: 'rest', top: 'КАБІНЕТ КОЖНІ 1–2 ГОДИНИ', bottom: 'Я: ЗАТО КАВА ПО ГРАФІКУ', bg: '#332a24', unlockedBy: 'lvl5' },
  { id: 'm-glasses', pose: 'crown', top: 'ТЕСТ БЕЗ ЖОДНОЇ ПОМИЛКИ', bottom: 'ТРИМАЙ ЗОЛОТІ ОКУЛЯРИ', bg: '#3a3a1f', unlockedBy: 'glasses' },
  { id: 'm-lvl10', pose: 'coin', top: 'JUNIOR. РЕАЛЬНО ВМІЄ', bottom: 'МАМА ПИШАЄТЬСЯ. БАТЬКО ЧЕКАЄ ЗВІТ', bg: '#1f3a2a', unlockedBy: 'lvl10' },
];
