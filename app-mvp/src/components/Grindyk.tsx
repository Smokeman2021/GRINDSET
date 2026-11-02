import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { art, type ArtKey } from '../art';
import { Theme, useStyles } from '../theme';

export type Mood = 'neutral' | 'happy' | 'fire' | 'think' | 'oops';

// Круглий портрет-емоція Гріндіка. Арт v2 це повні картини, тож обличчя вирізається кадруванням: fx/fy це центр обличчя
// в частках зображення, zoom це на скільки збільшити. Поки в art-v2 лише neutral має окремий портрет-крупний план (zoom 1).
// Коли прийдуть LoRA-файли з тими ж іменами, достатньо підправити fx/fy тут (або віддати квадратні портрети й поставити zoom 1).
const MOOD: Record<Mood, { key: ArtKey; zoom: number; fx: number; fy: number }> = {
  neutral: { key: 'character/grindik/grindik_portrait', zoom: 1, fx: 0.5, fy: 0.5 },
  happy: { key: 'character/grindik/mood_happy', zoom: 3.6, fx: 0.52, fy: 0.125 },
  fire: { key: 'character/grindik/mood_fire', zoom: 3.6, fx: 0.52, fy: 0.125 },
  think: { key: 'character/grindik/pose_think', zoom: 3.6, fx: 0.52, fy: 0.125 },
  oops: { key: 'character/grindik/mood_oops', zoom: 3.6, fx: 0.52, fy: 0.125 },
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
  const styles = useStyles(makeStyles);
  const m = MOOD[mood ?? 'neutral'];
  const a = art(m.key);
  const edge = Math.max(3, Math.round(size * 0.06));
  const inner = size - edge * 2.6; // площа всередині рамки
  const w = inner * m.zoom;
  const h = w / a.ratio;
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
      <Image source={a.src} style={{ position: 'absolute', width: w, height: h, left: inner / 2 - m.fx * w, top: inner / 2 - m.fy * h }} />
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: C.imgBg,
    borderColor: C.accent,
    borderBottomColor: C.accentEdge,
  },
});
