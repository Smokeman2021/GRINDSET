// Арт-система v2: доступ до зображень за КЛЮЧЕМ (шлях без розширення, напр. 'worlds/locations/cafe').
// Маніфест генерується скриптом scripts/optimize-art.mjs (npm run art:build) з папки assets/art-v2.
// Заміна файлів із тими самими іменами (наприклад, pre-LoRA → LoRA-канон Гріндіка) не вимагає змін коду: art:build і готово.
import { Platform, type ImageStyle } from 'react-native';
import { ART_FACE, ART_MANIFEST, type ArtKey } from './manifest.generated';

export type { ArtKey };

// Зображення на весь контейнер. УВАГА: саме width/height 100%, а не лише StyleSheet.absoluteFill: на вебі Image з absoluteFill
// лишається природного розміру файла (700×1023) і cover не спрацьовує.
export const FILL_IMG = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

// Центр обличчя фігури (частки зображення) для круглих портретів
export const artFace = (key: ArtKey) => ART_FACE[key] ?? null;

// М'яка тінь, що «підвішує» прозору фігуру над UI. Веб: CSS drop-shadow повторює контур (альфу) фігури; iOS: тінь Image теж за альфою;
// Android цього не вміє (там фігура без тіні). strength 0..1: для маленьких фігур тінь легша.
export function figureShadow(strength = 1): ImageStyle {
  if (Platform.OS === 'web') {
    return { filter: `drop-shadow(0px ${Math.round(18 * strength)}px ${Math.round(22 * strength)}px rgba(0,0,0,0.55))` } as unknown as ImageStyle;
  }
  return { shadowColor: '#000', shadowOpacity: 0.5 * strength, shadowRadius: 14 * strength, shadowOffset: { width: 0, height: 12 * strength } };
}

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
