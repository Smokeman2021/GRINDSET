import React from 'react';
import { Image, Text } from 'react-native';

// Єдиний компонент іконок. Файли додаємо в SOURCES лише після схвалення автора (див. docs/ICONS_LIST.md);
// поки іконки нема, показується емодзі з `fallback`, тож заміну можна робити поетапно, місце за місцем.
const SOURCES = {
  coin: require('../../assets/icons/coin.png'),
  streak: require('../../assets/icons/streak_on.png'),
  xp: require('../../assets/icons/xp_star.png'),
  energy: require('../../assets/icons/energy.png'),
  nav_home: require('../../assets/icons/nav_home.png'), // дім: варіант C, віддзеркалений (схвалено автором)
} as const;

export type IconName = keyof typeof SOURCES;

// Імена, яких ще нема у SOURCES, теж дозволені: для них обовʼязковий fallback
export function Icon({ name, size = 24, fallback }: { name: IconName | (string & {}); size?: number; fallback?: string }) {
  const src = (SOURCES as Record<string, number>)[name];
  if (src) return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
  if (fallback) return <Text style={{ fontSize: size * 0.9, lineHeight: size * 1.1, textAlign: 'center', width: size * 1.1 }}>{fallback}</Text>;
  return null;
}
