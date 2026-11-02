import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FILL_IMG } from '../art';
import type { PoseFile } from '../data/poses';
import { Theme, useStyles } from '../theme';

// Зображення пози. Живописний арт (framed) показується в рамці-картині з «3D-кромкою» як решта карток; вирізки (старі пози
// з прозорістю) просто лежать на фоні. Розмір: або width+height, або height (ширина за пропорцією файлу).
// Зміна пози це м'який перехід (cross-fade ~220 мс): попередній кадр лишається під новим, поки той проявляється.
export function PoseImage({ p, height, width, fill, style }: { p: PoseFile; height?: number; width?: number; fill?: boolean; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  const w = width ?? (height ? height * p.ratio : undefined);

  const [prev, setPrev] = useState<number | null>(null);
  const cur = useRef(p.src);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (cur.current === p.src) return;
    setPrev(cur.current);
    cur.current = p.src;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => setPrev(null));
  }, [p.src, fade]);

  if (!p.framed) {
    return <Image source={p.src} style={fill ? { flex: 1, width: '100%' } : { width: w, height }} resizeMode="contain" />;
  }
  const edge = Math.max(2, Math.round((height ?? 60) * 0.025));
  const frame = [
    styles.frame,
    fill ? { flex: 1, width: '100%' as const } : { width: w, height },
    { borderRadius: Math.max(6, Math.round((height ?? 60) * 0.09)), borderWidth: edge, borderBottomWidth: edge * 2 },
    style,
  ];
  return (
    <View style={frame}>
      {prev != null && <Image source={prev} style={FILL_IMG} resizeMode="cover" />}
      <Animated.Image source={p.src} style={[FILL_IMG, { opacity: fade }]} resizeMode="cover" />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    frame: { overflow: 'hidden', backgroundColor: C.panel2, borderColor: C.line },
  });
