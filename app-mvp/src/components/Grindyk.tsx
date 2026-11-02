import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { art, artFace, type ArtKey } from '../art';
import { Theme, useStyles } from '../theme';

export type Mood = 'neutral' | 'happy' | 'fire' | 'think' | 'oops';

// Круглий портрет-емоція Гріндіка (малий аватар у питаннях). Береться з прозорої фігури: кадр вирізається за центром обличчя
// (art/manifest.generated.ts → ART_FACE, рахується автоматично за альфою), тож заміна файлів на LoRA-канон не ламає кадрування.
const MOOD: Record<Mood, ArtKey> = {
  neutral: 'cutout/grindik/grindik_portrait',
  happy: 'cutout/grindik/mood_happy',
  fire: 'cutout/grindik/mood_fire',
  think: 'cutout/grindik/pose_think',
  oops: 'cutout/grindik/mood_oops',
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
  const key = MOOD[mood ?? 'neutral'];
  const a = art(key);
  const f = artFace(key) ?? { x: 0.5, y: 0.2, span: 0.4 };
  const edge = Math.max(3, Math.round(size * 0.06));
  const inner = size - edge * 2.6; // площа всередині рамки
  const h = inner / f.span; // висота зображення так, щоб у колі було span його висоти
  const w = h * a.ratio;
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
      <Image source={a.src} style={{ position: 'absolute', width: w, height: h, left: inner / 2 - f.x * w, top: inner / 2 - f.y * h }} />
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
