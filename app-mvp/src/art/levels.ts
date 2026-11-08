// «Київ, яким піднімається гравець»: дані подорожі. Усе, що стосується мапінгу «модуль → локації → ціль → транспорт», редагується ТУТ.
//
// ПОНЯТТЯ
//  • Локація (LOCS) = одне painterly-середовище (плита) + ОДНА ціль (зелений objective-glow) + точка підлоги, де стоїть Гріндік.
//  • Зупинка = урок (або скриня золота наприкінці модуля), у яку «приїхав» гравець. Урок модуля N під номером k їде в локацію MODULE_ROUTE[N][k]
//    (скриня золота: MODULE_HUB[N]). Одна локація зустрічається в курсі кілька разів: ціль завжди одна, зупинка нова.
//  • Акт (ACTS) = кар'єрний підйом: транспорт, житло й заклади ростуть разом із гравцем (околиця → Печерськ).
//
// КООРДИНАТИ: усе в частках плити (0..1 по ширині й висоті файла). `feet` = де ступні Гріндіка торкаються ПІДЛОГИ (центр ступень), `h` = зріст
// Гріндіка у частках висоти плити на цій глибині (чим далі від вікна, тим менше), `goal` = центр зеленої цілі, `cam` = який x плити ставимо
// в центр екрана. Усе виставлено за контактними аркушами із сіткою; `calibrate` позначає точки «на око», їх можна докручувати тут.
import type { ArtKey } from './index';
import type { PoseName } from '../data/poses';

export type Loc = {
  plate: ArtKey; // worlds/locations/* або worlds/acts/*: повноекранне середовище БЕЗ вбудованих персонажів
  title: string; // назва закладу в заголовку
  goal: { x: number; y: number }; // зелена ціль
  feet: { x: number; y: number }; // ступні Гріндіка на підлозі
  h: number; // зріст Гріндіка (частка висоти плити)
  cam: number; // x плити в центрі екрана
  pose: PoseName; // поза Гріндіка (cutout; дивиться на ціль, дзеркалиться автоматично)
  calibrate?: boolean;
};

export const LOCS: Record<string, Loc> = {
  cafe: { plate: 'worlds/locations/cafe', title: 'Кафе «Своя чашка»', goal: { x: 0.5, y: 0.5 }, feet: { x: 0.33, y: 0.78 }, h: 0.36, cam: 0.42, pose: 'point' },
  yard: { plate: 'worlds/locations/yard', title: 'Двір', goal: { x: 0.38, y: 0.5 }, feet: { x: 0.55, y: 0.8 }, h: 0.32, cam: 0.46, pose: 'wave' },
  metro: { plate: 'worlds/locations/metro', title: 'Метро', goal: { x: 0.72, y: 0.5 }, feet: { x: 0.56, y: 0.8 }, h: 0.32, cam: 0.64, pose: 'point' },
  bank: { plate: 'worlds/locations/bank', title: 'Банк', goal: { x: 0.63, y: 0.55 }, feet: { x: 0.44, y: 0.78 }, h: 0.32, cam: 0.54, pose: 'laptop' },
  act2_coworking: { plate: 'worlds/acts/act2_coworking', title: 'Коворкінг', goal: { x: 0.52, y: 0.6 }, feet: { x: 0.33, y: 0.84 }, h: 0.36, cam: 0.42, pose: 'laptop', calibrate: true },
  street_night: { plate: 'worlds/locations/street_night', title: 'Нічна вулиця', goal: { x: 0.72, y: 0.5 }, feet: { x: 0.5, y: 0.84 }, h: 0.36, cam: 0.6, pose: 'phone', calibrate: true },
  mall: { plate: 'worlds/locations/mall', title: 'Торговий центр', goal: { x: 0.56, y: 0.6 }, feet: { x: 0.38, y: 0.8 }, h: 0.33, cam: 0.47, pose: 'think', calibrate: true },
  rooftop: { plate: 'worlds/locations/rooftop', title: 'Дах', goal: { x: 0.27, y: 0.42 }, feet: { x: 0.43, y: 0.84 }, h: 0.4, cam: 0.35, pose: 'cheer', calibrate: true },
  embankment: { plate: 'worlds/locations/embankment', title: 'Набережна', goal: { x: 0.55, y: 0.6 }, feet: { x: 0.42, y: 0.84 }, h: 0.34, cam: 0.49, pose: 'shrug', calibrate: true },
  act4_lux: { plate: 'worlds/acts/act4_lux', title: 'Пентхаус', goal: { x: 0.45, y: 0.66 }, feet: { x: 0.6, y: 0.86 }, h: 0.42, cam: 0.52, pose: 'cheer', calibrate: true },
  bar: { plate: 'worlds/locations/bar', title: 'Бар', goal: { x: 0.6, y: 0.5 }, feet: { x: 0.38, y: 0.82 }, h: 0.32, cam: 0.5, pose: 'stand', calibrate: true },
  car_dealer: { plate: 'worlds/locations/car_dealer', title: 'Автосалон', goal: { x: 0.72, y: 0.55 }, feet: { x: 0.42, y: 0.8 }, h: 0.32, cam: 0.57, pose: 'point', calibrate: true },
  grocery: { plate: 'worlds/locations/grocery', title: 'Продуктовий', goal: { x: 0.72, y: 0.45 }, feet: { x: 0.5, y: 0.8 }, h: 0.32, cam: 0.6, pose: 'point', calibrate: true },
  gym: { plate: 'worlds/locations/gym', title: 'Спортзал', goal: { x: 0.72, y: 0.72 }, feet: { x: 0.5, y: 0.86 }, h: 0.36, cam: 0.6, pose: 'cheer', calibrate: true },
  kiosk: { plate: 'worlds/locations/kiosk', title: 'Кіоск', goal: { x: 0.56, y: 0.42 }, feet: { x: 0.4, y: 0.84 }, h: 0.34, cam: 0.48, pose: 'wave', calibrate: true },
  lobby: { plate: 'worlds/locations/lobby', title: 'Бізнес-центр', goal: { x: 0.8, y: 0.5 }, feet: { x: 0.58, y: 0.84 }, h: 0.32, cam: 0.68, pose: 'stand', calibrate: true },
  nightclub: { plate: 'worlds/locations/nightclub', title: 'Нічний клуб', goal: { x: 0.55, y: 0.5 }, feet: { x: 0.4, y: 0.84 }, h: 0.32, cam: 0.48, pose: 'phone', calibrate: true },
  pharmacy: { plate: 'worlds/locations/pharmacy', title: 'Аптека', goal: { x: 0.72, y: 0.57 }, feet: { x: 0.52, y: 0.86 }, h: 0.34, cam: 0.62, pose: 'think', calibrate: true },
  restaurant: { plate: 'worlds/locations/restaurant', title: 'Ресторан', goal: { x: 0.62, y: 0.45 }, feet: { x: 0.45, y: 0.86 }, h: 0.34, cam: 0.53, pose: 'point', calibrate: true },
  shelter: { plate: 'worlds/locations/shelter', title: 'Укриття', goal: { x: 0.66, y: 0.6 }, feet: { x: 0.36, y: 0.86 }, h: 0.38, cam: 0.5, pose: 'shrug', calibrate: true },
  tck: { plate: 'worlds/locations/tck', title: 'Вулиця біля ТЦК', goal: { x: 0.78, y: 0.5 }, feet: { x: 0.5, y: 0.86 }, h: 0.36, cam: 0.64, pose: 'shrug', calibrate: true },
  act1_door: { plate: 'worlds/acts/act1_door', title: 'Під\'їзд', goal: { x: 0.74, y: 0.48 }, feet: { x: 0.38, y: 0.86 }, h: 0.45, cam: 0.55, pose: 'wave', calibrate: true },
  act1_room: { plate: 'worlds/acts/act1_room', title: 'Кімната', goal: { x: 0.44, y: 0.58 }, feet: { x: 0.3, y: 0.86 }, h: 0.46, cam: 0.4, pose: 'laptop', calibrate: true },
  act1_room_b: { plate: 'worlds/acts/act1_room_b', title: 'Кімната на околиці', goal: { x: 0.52, y: 0.62 }, feet: { x: 0.33, y: 0.86 }, h: 0.4, cam: 0.42, pose: 'laptop', calibrate: true },
  act3_apartment: { plate: 'worlds/acts/act3_apartment', title: 'Квартира', goal: { x: 0.78, y: 0.62 }, feet: { x: 0.55, y: 0.86 }, h: 0.4, cam: 0.66, pose: 'cheer', calibrate: true },
};

export type LocId = keyof typeof LOCS;

// Маршрут модуля (ключ = номер модуля 1..10): локація k-го уроку. Скриня золота завжди в «штабі» модуля (MODULE_HUB).
export const MODULE_ROUTE: Record<number, LocId[]> = {
  1: ['cafe', 'kiosk', 'grocery', 'pharmacy', 'yard', 'act1_door', 'cafe'],
  2: ['yard', 'act1_room', 'act1_room_b', 'kiosk', 'shelter', 'bar', 'grocery', 'yard'],
  3: ['metro', 'shelter', 'kiosk', 'metro', 'tck', 'grocery', 'metro'],
  4: ['bank', 'lobby', 'pharmacy', 'bank', 'mall', 'bank'],
  5: ['act2_coworking', 'lobby', 'act2_coworking', 'gym', 'bar', 'act2_coworking', 'restaurant'],
  6: ['street_night', 'nightclub', 'bar', 'street_night', 'tck', 'nightclub', 'street_night'],
  7: ['mall', 'restaurant', 'car_dealer', 'mall', 'gym', 'mall'],
  8: ['rooftop', 'act3_apartment', 'lobby', 'rooftop', 'restaurant', 'act3_apartment', 'rooftop'],
  9: ['embankment', 'restaurant', 'car_dealer', 'embankment', 'bar', 'embankment'],
  10: ['act4_lux', 'restaurant', 'lobby', 'act4_lux', 'rooftop', 'embankment', 'act4_lux'],
};
export const MODULE_HUB: Record<number, LocId> = { 1: 'cafe', 2: 'yard', 3: 'metro', 4: 'bank', 5: 'act2_coworking', 6: 'street_night', 7: 'mall', 8: 'rooftop', 9: 'embankment', 10: 'act4_lux' };

// ───────── Акти: кар'єрний підйом ─────────
export type TravelMode = 'walk' | 'marshrutka' | 'metro' | 'car_old' | 'car_mid' | 'car_lux';
export type Act = { n: 1 | 2 | 3 | 4; title: string; sub: string; modules: number[]; home: ArtKey; transport: TravelMode[]; troll: string[] };

export const ACTS: Act[] = [
  { n: 1, title: 'Околиця', sub: 'Кімната, двір, маршрутка', modules: [1, 2, 3], home: 'worlds/acts/act1_room_b', transport: ['marshrutka', 'metro', 'walk'], troll: ['Йо. Почнемо з маршрутки, без води. Усі звідси починали, і я теж.', 'Метро, пішки, знову метро. Нічого, друже: цифри важливіші за комфорт.'] },
  { n: 2, title: 'Перші гроші', sub: 'Коворкінг, банк, стара тачка', modules: [4, 5], home: 'worlds/acts/act2_coworking', transport: ['car_old'], troll: ['Тачка стара, зате своя. Мій сенсей казав: «Спершу цифри, потім емоції». Тримайся цього, колего.', 'Маршрутку здав в архів. Бачу, голова працює. Тільки не поспішай: товарка любить тих, хто рахує.'] },
  { n: 3, title: 'Свій рух', sub: 'Квартира, ТЦ, дах, авто', modules: [6, 7, 8], home: 'worlds/acts/act3_apartment', transport: ['car_mid'], troll: ['Квартира з видом, друже. Платформа знову щось «покращила», тож тримай запас у бюджеті.', 'Нове авто. Ну, це сміливий вибір для бюджету. Рахуй, перш ніж хвалитись.'] },
  { n: 4, title: 'Печерськ', sub: 'Пентхаус, люкс', modules: [9, 10], home: 'worlds/acts/act4_lux', transport: ['car_lux'], troll: ['Печерськ. Пам\'ятаєш кімнату на околиці? Я теж. От за це я тебе й поважаю: не вгадав, а подумав.', 'Люкс люксом, а трекер сам себе не налаштує. Без води: дивись цифри.'] },
];

export const actOfModule = (moduleNo: number): Act => ACTS.find((a) => a.modules.includes(moduleNo)) ?? ACTS[0];

export const TRAVEL_LABEL: Record<TravelMode, string> = { walk: 'Пішки', marshrutka: 'Маршрутка', metro: 'Метро', car_old: 'Стара тачка', car_mid: 'Своє авто', car_lux: 'Люкс' };

// Чим їдемо в зупинку: за актом, а в першому акті чергуємо маршрутка/метро/пішки за номером зупинки
export function travelMode(moduleNo: number, k: number): TravelMode {
  const a = actOfModule(moduleNo);
  return a.transport[k % a.transport.length];
}

// ───────── Різні місця Гріндіка в одному закладі ─────────
// Та сама локація зустрічається в курсі кілька разів: ціль (зелений круг) стоїть на місці, а Гріндік щоразу стає в іншу точку підлоги.
// Усі точки лежать на ПІДЛОЗІ (не на столі/стійці/ліжку): звірено за скріншотами сцени (?loc=<id>&alt=<n> у dev-збірці).
export const ALT_STAND: Partial<Record<LocId, { x: number; y: number; h?: number }[]>> = {
  cafe: [{ x: 0.56, y: 0.82 }],
  yard: [{ x: 0.22, y: 0.82 }],
  metro: [{ x: 0.55, y: 0.84 }],
  bank: [{ x: 0.78, y: 0.82 }],
  act2_coworking: [{ x: 0.66, y: 0.86 }],
  street_night: [{ x: 0.84, y: 0.86 }],
  mall: [{ x: 0.72, y: 0.82 }],
  rooftop: [{ x: 0.46, y: 0.86 }],
  embankment: [{ x: 0.72, y: 0.84 }],
  act4_lux: [{ x: 0.3, y: 0.86 }],
  bar: [{ x: 0.78, y: 0.86 }],
  car_dealer: [{ x: 0.56, y: 0.84 }],
  grocery: [{ x: 0.62, y: 0.84 }],
  gym: [{ x: 0.52, y: 0.86 }],
  kiosk: [{ x: 0.68, y: 0.86 }],
  lobby: [{ x: 0.66, y: 0.86 }],
  nightclub: [{ x: 0.65, y: 0.86 }],
  pharmacy: [{ x: 0.6, y: 0.86 }],
  restaurant: [{ x: 0.75, y: 0.86 }],
  tck: [{ x: 0.62, y: 0.86 }],
  act1_door: [{ x: 0.55, y: 0.86 }],
  act1_room: [{ x: 0.58, y: 0.86 }],
  act1_room_b: [{ x: 0.66, y: 0.86 }],
};

// Яка саме точка/поза для цієї зупинки: чергуємо за номером уроку, щоб Гріндік не стояв на одному місці
export function standFor(locId: LocId, moduleNo: number, k: number, forceAlt?: number | null): { feet: { x: number; y: number }; h: number; cam: number; pose: PoseName } {
  const loc = LOCS[locId];
  const alts = ALT_STAND[locId] ?? [];
  const v = forceAlt ?? (moduleNo + k) % (1 + alts.length);
  const a = v > 0 ? alts[v - 1] : undefined;
  const feet = a ? { x: a.x, y: a.y } : loc.feet;
  const cam = a ? Math.min(0.85, Math.max(0.15, (a.x + loc.goal.x) / 2)) : loc.cam;
  const POSES: PoseName[] = [loc.pose, 'stand', 'think', 'point', 'wave'];
  const pose = v === 0 && forceAlt == null && k % 5 === 0 ? loc.pose : POSES[(k + moduleNo) % POSES.length];
  return { feet, h: a?.h ?? loc.h, cam, pose };
}
