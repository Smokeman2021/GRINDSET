import type { BmScreen } from './types';

// Знято живцем з adsmanager.facebook.com (акаунт затерто розмиттям, координати кнопок — з реального DOM).
export const BM_ADSMANAGER: BmScreen[] = [
  {
    id: 'campaigns-empty',
    section: 'ads-manager',
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
  {
    id: 'campaigns-list',
    section: 'ads-manager',
    title: 'Кампанії (заповнений список)',
    talk: 'Ось так виглядає кабінет із реальними кампаніями. Зверни увагу на назви — кожна каже, що за товар, коли запущено і яка версія.',
    task: 'Подивись, як названо кампанії — це приклад порядку, а не хаосу.',
    image: require('../../../assets/bm/adsmanager/campaigns-list.png'),
    imgW: 1249,
    imgH: 655,
    hotspots: [
      { id: 'create', kind: 'nav', xPct: 8.0, yPct: 37.9, wPct: 6.5, hPct: 5.3, label: '+ Create', leadsTo: 'campaign-objective' },
      { id: 'tab-adsets', kind: 'nav', xPct: 24.2, yPct: 29.0, wPct: 6.0, hPct: 5.3, label: 'Ad sets', leadsTo: 'adsets-list' },
      { id: 'tab-ads', kind: 'nav', xPct: 40.2, yPct: 29.0, wPct: 4.0, hPct: 5.3, label: 'Ads', leadsTo: 'ads-list' },
    ],
  },
  {
    id: 'adsets-list',
    section: 'ads-manager',
    title: 'Групи оголошень (заповнений список)',
    talk: 'Кожна група оголошень названа так само послідовно: товар, дата, аудиторія, номер варіанту. Так через тиждень ти й сам зрозумієш, що є що.',
    task: 'Назви адсетів узгоджені з назвами кампаній — той самий товар, той самий принцип.',
    image: require('../../../assets/bm/adsmanager/adsets-list.png'),
    imgW: 1249,
    imgH: 655,
    hotspots: [
      { id: 'create', kind: 'nav', xPct: 8.0, yPct: 37.9, wPct: 6.5, hPct: 5.3, label: '+ Create', leadsTo: 'campaign-objective' },
      { id: 'tab-campaigns', kind: 'nav', xPct: 8.3, yPct: 29.0, wPct: 6.5, hPct: 5.3, label: 'Campaigns', leadsTo: 'campaigns-list' },
      { id: 'tab-ads', kind: 'nav', xPct: 40.2, yPct: 29.0, wPct: 4.0, hPct: 5.3, label: 'Ads', leadsTo: 'ads-list' },
    ],
  },
];
