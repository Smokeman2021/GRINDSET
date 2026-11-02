// Арт-система v2: доступ до зображень за КЛЮЧЕМ (шлях без розширення, напр. 'worlds/locations/cafe').
// Маніфест генерується скриптом scripts/optimize-art.mjs (npm run art:build) з папки assets/art-v2.
// Заміна файлів із тими самими іменами (наприклад, pre-LoRA → LoRA-канон Гріндіка) не вимагає змін коду: art:build і готово.
import { ART_MANIFEST, type ArtKey } from './manifest.generated';

export type { ArtKey };

// Зображення на весь контейнер. УВАГА: саме width/height 100%, а не лише StyleSheet.absoluteFill: на вебі Image з absoluteFill
// лишається природного розміру файла (700×1023) і cover не спрацьовує.
export const FILL_IMG = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

export type ArtEntry = { src: number; w: number; h: number; ratio: number };

export function hasArt(key: string): key is ArtKey {
  return key in ART_MANIFEST;
}

export function art(key: ArtKey): ArtEntry {
  const e = ART_MANIFEST[key];
  return { ...e, ratio: e.w / e.h };
}

// Усі ключі з префіксом, напр. artKeys('character/presets/') — для списків у конструкторі й галереях
export function artKeys(prefix: string): ArtKey[] {
  return (Object.keys(ART_MANIFEST) as ArtKey[]).filter((k) => k.startsWith(prefix));
}

// Остання частина ключа: 'worlds/locations/cafe' → 'cafe'
export const artName = (key: string) => key.slice(key.lastIndexOf('/') + 1);
