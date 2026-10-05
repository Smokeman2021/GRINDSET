import React from 'react';
import { Image } from 'react-native';

const SOURCES = {
  coin: require('../../assets/icons/coin.png'),
  streak: require('../../assets/icons/streak_on.png'),
  xp: require('../../assets/icons/xp_star.png'),
  energy: require('../../assets/icons/energy.png'),
} as const;

export type IconName = keyof typeof SOURCES;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return <Image source={SOURCES[name]} style={{ width: size, height: size }} resizeMode="contain" />;
}
