import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { FILL_IMG, figureShadow } from '../art';
import type { PoseFile } from '../data/poses';

// Прозора фігура (Гріндік, NPC): без рамки, без обрізання, з м'якою тінню. Розмір: width+height, або height (ширина за пропорцією),
// або fill (на весь батьківський блок). Зміна пози це м'який cross-fade (~220 мс).
export function PoseImage({ p, height, width, fill, shadow = 1, style }: { p: PoseFile; height?: number; width?: number; fill?: boolean; shadow?: number; style?: StyleProp<ViewStyle> }) {
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

  const sh = shadow > 0 ? figureShadow(shadow) : undefined;
  // Веб: CSS drop-shadow на самих <img> малює прямокутник навколо фігури (прихований <img> RN-web) → тінь вішаємо на контейнер, вона йде за альфою композиту
  const webSh = Platform.OS === 'web' ? (sh as unknown as ViewStyle) : undefined;
  const imgSh = Platform.OS === 'web' ? undefined : sh;
  return (
    <View style={[fill ? { flex: 1, width: '100%' } : { width: w, height }, webSh, style]}>
      {prev != null && <Image source={prev} style={[FILL_IMG, imgSh]} resizeMode="contain" />}
      <Animated.Image source={p.src} style={[FILL_IMG, imgSh, { opacity: fade }]} resizeMode="contain" />
    </View>
  );
}
