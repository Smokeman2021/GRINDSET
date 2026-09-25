// Репліки Гріндіка. Голос: зухвалий свій хлопець, самоіронія, підтримує і не глузує з помилок.
// Без обіцянок доходу. Додавай нові рядки в потрібний список: движок бере їх сам.
import type { PoseName } from './poses';

export type PhraseKind =
  | 'correct'
  | 'combo3'
  | 'combo5'
  | 'wrong'
  | 'timeout'
  | 'lessonDone'
  | 'lessonPerfect'
  | 'lessonPractice'
  | 'quizDone'
  | 'crownPass'
  | 'crownFail'
  | 'levelUp'
  | 'idle'
  | 'lowEnergy'
  | 'goalDone'
  | 'freezeBought'
  | 'streak3'
  | 'streak7'
  | 'streak30'
  | 'comeback'
  | 'morning'
  | 'day'
  | 'evening'
  | 'night';

const BANK: Record<PhraseKind, string[]> = {
  correct: [
    'Так і треба.',
    'В точку.',
    'Красава.',
    'Цифри не брешуть.',
    'Алгоритм задоволений.',
    'Ростеш на очах.',
    'Чисто. Далі.',
  ],
  combo3: ['Серія пішла. Не зупиняйся.', 'Три підряд. Це вже система.', 'Горить! Тримай темп.'],
  combo5: ['П’ять підряд. Тімлід би вже плакав від щастя.', 'Ти в потоці. Не дихай, щоб не збити.', 'Комбо росте, бонус росте. Красота.'],
  wrong: [
    'Буває. Дивись як треба.',
    'Помилка — це теж дані.',
    'Не страшно. У мене перший бюджет теж злився.',
    'Розберемо і йдемо далі.',
    'Facebook теж не з першого разу пристрілюється.',
    'Ок, запам’ятали. Наступне твоє.',
  ],
  timeout: [
    'Час — гроші. Цей раунд не твій, беремо на олівець.',
    'Не встиг. Наступного разу швидше, я вірю.',
    'Таймер не чекає, як і аукціон. Далі.',
  ],
  lessonDone: ['Урок закрито. Ще один камінчик у фундамент.', 'Готово. Робиш більше, ніж 90% тих, хто “збирається почати”.', 'Є. Заходь ще, не остигай.'],
  lessonPerfect: ['Без жодної помилки. Хочу так само.', 'Ідеально. Гарний прохід.', 'Чистий урок. Золоті окуляри вже ближче.'],
  lessonPractice: ['Повторення — мати вчення. Половина нагороди, повна користь.', 'Закріплюємо. Пам’ять дякує.'],
  quizDone: ['Квіз на час пройдено. Швидкість теж навичка.', 'Бонус твій. Так працює швидке рішення.'],
  crownPass: ['Корона твоя. Тепер офіційно: фундамент є.', 'Вибивайся в люди: модуль закрито на корону.'],
  crownFail: ['Ще не корона. Повтори уроки й повертайся, я нікуди не піду.', 'Не вийшло, буває. Слабкі місця видно: підтягуй.'],
  levelUp: ['Новий рівень! Титул росте.', 'Лвл ап. Мама буде пишатись.', 'Прокачався. Так тримати.'],
  idle: [
    'Перший день без лідів? Норма. Не панікуй.',
    'Правило двох днів: пиши на лобі й дивись у розрізі 2–3 днів.',
    'CPA вищий за виплату — це не “майже плюс”.',
    'Автоправила не сплять. Ти теж не мусиш.',
    'Лід без апруву — це просто ім’я в таблиці.',
    'Запишеш рішення й причину, і через тиждень побачиш, що працювало.',
    'Не чіпай те, що вже працює. Тести в іншому кабінеті.',
    'Один день — шум. Два-три — вже картина.',
    'Кабінет кожні 1–2 години. Не “запустив і забув”.',
    'Збільшив бюджет, щоб відбитись? Класика. Не роби так.',
    'Щоб мати лід, спершу потрібен показ. Ось таке відкриття.',
    'Спершу метрика, потім лендинг. Читай зліва направо.',
  ],
  lowEnergy: ['Енергія на нулі. Відпочинь або повтори пройдене: це теж прогрес.'],
  goalDone: ['Ціль дня закрита. Можна ще, можна відпочити.', 'План виконано. Далі бонусом.'],
  freezeBought: ['Заморозка стріку куплена. Тепер можна хворіти спокійно.'],
  streak3: ['Три дні поспіль. Звичка починається тут.'],
  streak7: ['Тиждень стріку. Ти вже не новачок у дисципліні.'],
  streak30: ['Місяць стріку. Це вже характер.'],
  comeback: ['О, ти повернувся! Не картай себе, просто продовжуємо.', 'Скучив. Чекав, поки прийдеш. Поїхали далі.'],
  morning: ['Ранок. Кава, кабінет, білінг: у такому порядку.', 'Доброго ранку. Перевір білінг і починаємо.'],
  day: ['Денна зміна на місці. Що вчимо?', 'День у розпалі. Час закрити урок-другий.'],
  evening: ['Вечір. Пікові години аналітики, а в тебе — урок.', 'Вечір: найкращий час підсумувати день.'],
  night: ['Пізно вже. Один короткий урок і спати.', 'Нічний баєр — це зазвичай втомлений баєр. Швидко й спати.'],
};

const POSE_FOR: Record<PhraseKind, PoseName[]> = {
  correct: ['cheer'],
  combo3: ['cheer'],
  combo5: ['cheer', 'coin'],
  wrong: ['shrug', 'think'],
  timeout: ['shrug'],
  lessonDone: ['cheer', 'point'],
  lessonPerfect: ['cheer', 'crown'],
  lessonPractice: ['point'],
  quizDone: ['coin', 'cheer'],
  crownPass: ['crown'],
  crownFail: ['shrug'],
  levelUp: ['cheer', 'crown'],
  idle: ['stand', 'laptop', 'rest', 'phone', 'coin', 'point', 'think'],
  lowEnergy: ['rest'],
  goalDone: ['cheer', 'coin'],
  freezeBought: ['rest'],
  streak3: ['cheer'],
  streak7: ['cheer', 'crown'],
  streak30: ['crown'],
  comeback: ['wave'],
  morning: ['rest', 'wave'],
  day: ['laptop', 'point'],
  evening: ['laptop', 'phone'],
  night: ['rest'],
};

function pickFrom<T>(list: T[], key: string, store: Record<string, number>): T {
  if (list.length === 1) return list[0];
  let i = Math.floor(Math.random() * list.length);
  if (i === store[key]) i = (i + 1) % list.length; // не повторюємо одну й ту саму репліку двічі поспіль
  store[key] = i;
  return list[i];
}

const lastText: Record<string, number> = {};
const lastPose: Record<string, number> = {};

export type Say = { text: string; pose: PoseName };

export function say(kind: PhraseKind): Say {
  return {
    text: pickFrom(BANK[kind], kind, lastText),
    pose: pickFrom(POSE_FOR[kind], `pose:${kind}`, lastPose),
  };
}

export function greetingKind(date = new Date()): PhraseKind {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 23) return 'evening';
  return 'night';
}

// Висновок для головної: повернення після паузи > привітання за часом доби > випадкова порада
export function homeSay(opts: { daysAway: number; energy: number; goalDone: boolean; fresh: boolean }): Say {
  if (opts.fresh && opts.daysAway >= 2) return say('comeback');
  if (opts.energy <= 0) return say('lowEnergy');
  if (opts.fresh) return say(greetingKind());
  if (opts.goalDone && Math.random() < 0.3) return say('goalDone');
  return say('idle');
}
