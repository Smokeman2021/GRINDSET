// Дані для реальних скріншотів Business Manager з клікабельними зонами (не намальований макет).
// Координати hotspot — у відсотках від зображення (0-100), тому не залежать від розміру екрана.
//
// Два типи hotspot:
// - 'task' (за замовчуванням): частина завдання гравцю — правильний/неправильний вибір, feedback.
// - 'nav': просто фіксує кнопку й куди вона веде (label + leadsTo), для майбутньої карти навігації
//   всього кабінету (субтитри «на що навів курсор → куди веде», довідка, орієнтування по кабінету).
//   Поки не рендериться тренажером — тільки записуємо дані по ходу зйомки, щоб не переробляти.
export type BmHotspot = {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  kind?: 'task' | 'nav'; // не вказано = 'task'
  label?: string; // точний текст кнопки/елемента на екрані — для субтитрів
  leadsTo?: string; // id екрана з BmScreen, куди веде ця кнопка (якщо вже знято) або опис призначення
  correct?: boolean; // обов'язково для kind:'task'
  feedback?: string; // обов'язково для kind:'task'
};

export type BmScreen = {
  id: string;
  section: string; // розділ Business Manager (ads-manager, events-manager, billing, business-settings...) — для навігаційного графа
  title: string;
  talk: string;
  task: string;
  image: number; // require('...png')
  imgW: number; // натуральні пікселі скріншота — для правильного співвідношення сторін
  imgH: number;
  hotspots: BmHotspot[];
};
