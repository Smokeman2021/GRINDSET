import React from 'react';
import { Image, View } from 'react-native';
import { art, FILL_IMG, figureShadow } from '../art';
import { resolveCharacter, type CharacterConfig } from '../art/character';

// Малює персонажа ПРОЗОРОЮ фігурою, що «стоїть» на UI з м'якою тінню (без рамки й обрізання).
// Зараз це цілісний образ (лук / пресет / основа); коли прийдуть пошарові асети, база й шари лягають один на одного на спільному канвасі.
export function CharacterView({ config, height = 220, shadow = 1 }: { config: CharacterConfig | null; height?: number; shadow?: number }) {
  const r = resolveCharacter(config);
  const baseEntry = art(r.mode === 'layers' ? r.base : r.key);
  const width = height * baseEntry.ratio;
  const sh = shadow > 0 ? figureShadow(shadow) : undefined;
  return (
    <View style={{ width, height }}>
      <Image source={baseEntry.src} style={[FILL_IMG, sh]} resizeMode="contain" />
      {r.mode === 'layers' && r.layers.map((k) => <Image key={k} source={art(k).src} style={FILL_IMG} resizeMode="contain" />)}
    </View>
  );
}
