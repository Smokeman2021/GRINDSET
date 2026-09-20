import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { C } from '../theme';

export type Mood = 'neutral' | 'happy' | 'fire' | 'think' | 'oops';

const MOOD_IMAGES: Record<Mood, number> = {
  neutral: require('../../assets/grindyk-bust.png'),
  happy: require('../../assets/character/grindyk-happy.png'),
  fire: require('../../assets/character/grindyk-fire.png'),
  think: require('../../assets/character/grindyk-think.png'),
  oops: require('../../assets/character/grindyk-oops.png'),
};

export function Grindyk({
  mood,
  size = 80,
}: {
  // start (evolution stage) залишено в API для сумісності викликів, поки є лише stage "sapiens"
  start?: string;
  mood?: Mood;
  size?: number;
}) {
  const face: Mood = mood ?? 'neutral';
  const edge = Math.max(3, Math.round(size * 0.06));
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: edge,
          borderBottomWidth: edge * 1.6,
        },
      ]}
    >
      <Image source={MOOD_IMAGES[face]} style={styles.img} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: C.imgBg,
    borderColor: C.accent,
    borderBottomColor: C.accentEdge,
  },
  img: { width: '100%', height: '100%' },
});
