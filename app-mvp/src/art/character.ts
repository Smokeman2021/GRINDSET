// Модульний конструктор персонажа (paper-doll). Персонаж = база-архетип (1 з 6) + шари (волосся, тон шкіри, верх, низ, взуття,
// верхній одяг, аксесуар, у т.ч. круглі окуляри). Шари малюються в ФІКСОВАНОМУ z-порядку й вирівняні по базі (один канвас).
//
// ⚠ Пошарових ассетів поки нема: гардероб це цілісні луки (непрозорі картини). Тому зараз працює FALLBACK: образ = готовий пресет
// або цілісний лук або сама база. Коли арт постачить шари, достатньо покласти файли за конвенцією
//     character/layers/<слот>/<id>.png        (слоти: hair, skin, top, bottom, shoes, outer, accessory; прозорий PNG на тому ж канвасі)
// і запустити `npm run art:build`: конструктор сам покаже їх у відповідному слоті й перейде на шарований рендер. Код не змінюється.
import { artKeys, hasArt, type ArtKey } from './index';

export const BASES = ['m_slim', 'm_avg', 'm_ath', 'm_plump', 'f_reg', 'f_slim'] as const;
export type BaseId = (typeof BASES)[number];

export const BASE_LABEL: Record<BaseId, string> = {
  m_slim: 'Чоловік · худорлявий',
  m_avg: 'Чоловік · середній',
  m_ath: 'Чоловік · атлет',
  m_plump: 'Чоловік · кремезний',
  f_reg: 'Жінка · звичайна',
  f_slim: 'Жінка · струнка',
};

export const SLOTS = ['hair', 'skin', 'top', 'bottom', 'shoes', 'outer', 'accessory'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  hair: 'Волосся',
  skin: 'Тон шкіри',
  top: 'Верх',
  bottom: 'Низ',
  shoes: 'Взуття',
  outer: 'Верхній одяг',
  accessory: 'Аксесуари (окуляри)',
};

// Порядок малювання знизу вгору: тон шкіри → низ → взуття → верх → верхній одяг → волосся → аксесуар
export const Z_ORDER: Slot[] = ['skin', 'bottom', 'shoes', 'top', 'outer', 'hair', 'accessory'];

export type CharacterConfig = {
  base: BaseId;
  look: ArtKey | null; // цілісний лук (пресет або гардероб): fallback, поки нема шарів
  layers: Partial<Record<Slot, ArtKey>>;
};

export const DEFAULT_CHARACTER: CharacterConfig = { base: 'm_avg', look: 'cutout/presets/preset_1', layers: {} };

// Усі фігури беремо з ПРОЗОРИХ cutout (assets/art-v2/cutout): вони «стоять» на UI, а не лежать у рамці
export const baseKey = (b: BaseId): ArtKey => `cutout/archetypes/${b}` as ArtKey;
export const presetKeys = (): ArtKey[] => artKeys('cutout/presets/').sort();
export const lookKeys = (): ArtKey[] => artKeys('cutout/wardrobe/look_').sort();

// Старі збережені конфіги посилались на непрозорі файли character/…: переносимо на прозорі cutout/… (якщо такий є)
const migrateKey = (k: unknown): string | null => {
  if (typeof k !== 'string') return null;
  if (hasArt(k)) return k;
  const m = k.replace(/^character\//, 'cutout/');
  return hasArt(m) ? m : null;
};
export const layerOptions = (slot: Slot): ArtKey[] => artKeys(`character/layers/${slot}/`);

// Скільки слотів уже має пошарові файли (0 = працює лише fallback на цілісні луки)
export const layeredSlots = (): Slot[] => SLOTS.filter((s) => layerOptions(s).length > 0);

export type CharacterRender = { mode: 'layers'; base: ArtKey; layers: ArtKey[] } | { mode: 'look'; key: ArtKey };

// Що малювати для конфігу: шари (якщо обрано хоч один наявний) → цілісний лук → база
export function resolveCharacter(cfg: CharacterConfig | null): CharacterRender {
  const c = sanitizeCharacter(cfg) ?? DEFAULT_CHARACTER; // з сервера може прийти застарілий конфіг: не ламаємо екран
  const chosen = Z_ORDER.map((s) => c.layers[s]).filter((k): k is ArtKey => !!k && hasArt(k));
  if (chosen.length > 0) return { mode: 'layers', base: baseKey(c.base), layers: chosen };
  if (c.look && hasArt(c.look)) return { mode: 'look', key: c.look };
  return { mode: 'look', key: baseKey(c.base) };
}

// Санітизація конфігу з сервера: невідома база чи зниклі файли не повинні ламати екран
export function sanitizeCharacter(v: unknown): CharacterConfig | null {
  const o = v as Partial<CharacterConfig> | null;
  if (!o || typeof o !== 'object') return null;
  const base = (BASES as readonly string[]).includes(o.base as string) ? (o.base as BaseId) : DEFAULT_CHARACTER.base;
  const lk = migrateKey(o.look);
  const look = lk && hasArt(lk) ? lk : null;
  const layers: Partial<Record<Slot, ArtKey>> = {};
  for (const s of SLOTS) {
    const k = migrateKey(o.layers?.[s]);
    if (k && hasArt(k)) layers[s] = k;
  }
  return { base, look, layers };
}
