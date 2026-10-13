import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { avatarFrame, ArchetypeId } from '../data/avatars';

export function CharacterAvatar({ archetype, stage, height = 220 }: { archetype: ArchetypeId; stage: number; height?: number }) {
  const f = avatarFrame(archetype, stage);
  const w = height * f.ratio;
  return (
    <View style={[styles.box, { width: w, height }]}>
      <Image source={f.src} style={{ width: w, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'flex-end' },
});
