// Ризикові терміни словника. У збірці з EXPO_PUBLIC_INCLUDE_RESTRICTED=false Metro підміняє цей файл на glossary.restricted.public.ts.
import type { Term } from './glossary';

export const RESTRICTED_TERMS: Term[] = [
  { id: 'cloak', title: 'Клоакінг', match: '[Кк]лоак\\p{L}*', def: 'Показ різного контенту модератору й користувачу. Порушує правила Meta.', risky: true },
  { id: 'antidetect', title: 'Антидетект', match: '[Аа]нтидетект\\p{L}*', def: 'Браузер, що створює окремі «відбитки» для кожного акаунта, щоб профілі не пов’язувались.', risky: true },
  { id: 'dofarm', title: 'Дофарм', match: '[Дд]офарм\\p{L}*', def: 'Підготовка придбаного акаунта до запуску реклами: додати активність, стабілізувати траст.', risky: true },
  { id: 'proxy', title: 'Проксі', match: '[Пп]роксі', def: 'Проміжний сервер, що підміняє IP. Використовується, щоб акаунти мали різні мережеві «адреси».', risky: true },
];
