import type { BmScreen } from './types';

// Знято живцем з adsmanager.facebook.com (акаунт затерто розмиттям, координати кнопок — з реального DOM).
export const BM_ADSMANAGER: BmScreen[] = [
  {
    id: 'campaigns-empty',
    title: 'Кампанії',
    talk: 'Це не малюнок — справжній знімок кабінету. Спробуй знайти елементи так само, як на живому екрані.',
    task: 'Де кнопка створення нової кампанії?',
    image: require('../../../assets/bm/adsmanager/campaigns-empty.png'),
    imgW: 1568,
    imgH: 743,
    hotspots: [
      { id: 'create', xPct: 3.38, yPct: 21.34, wPct: 4.27, hPct: 3.16, correct: true, feedback: 'Так, "+ Создать" — єдина активна кнопка, коли кампаній ще нема.' },
      { id: 'dup', xPct: 8.02, yPct: 21.34, wPct: 6.52, hPct: 3.16, correct: false, feedback: '«Створити дублікат» неактивна — дублювати нема чого, кампаній ще немає.' },
      { id: 'edit', xPct: 14.91, yPct: 21.34, wPct: 5.86, hPct: 3.16, correct: false, feedback: '«Редагувати» неактивна з тієї ж причини — спершу треба щось створити.' },
    ],
  },
];
