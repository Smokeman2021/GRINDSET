import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { art, artKeys, type ArtKey } from './index';

// Анімація персонажів. Арт v2 статичний, тому зараз це плейсхолдери, але архітектура готова до майбутнього:
//  • useIdleSway: легке idle-погойдування (дихання) для будь-якого блоку;
//  • Flipbook: покадровий програвач; кадри кладуться як  <префікс>_01.png, <префікс>_02.png …  у art-v2 і підхоплюються самі
//    (npm run art:build), у коді нічого міняти не треба;
//  • перехід між позами: CrossFade (див. components/PoseImage);
//  • Spine/Rive: ріг-рантайм підключимо, коли аніматор віддасть риги; точка входу це та сама заміна компонента в сцені.

// Ключі кадрів за префіксом (відсортовані за іменем): flipbookFrames('character/grindik/anim/wave_')
export function flipbookFrames(prefix: string): ArtKey[] {
  return artKeys(prefix).sort();
}

export function Flipbook({
  frames,
  fps = 8,
  loop = true,
  paused = false,
  style,
  width,
  height,
  onEnd,
}: {
  frames: ArtKey[];
  fps?: number;
  loop?: boolean;
  paused?: boolean;
  style?: StyleProp<ImageStyle>;
  width: number;
  height: number;
  onEnd?: () => void;
}) {
  const [i, setI] = useState(0);
  const focused = useIsFocused();
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (paused || !focused || frames.length < 2) return;
    const t = setInterval(() => {
      setI((cur) => {
        if (cur + 1 < frames.length) return cur + 1;
        if (loop) return 0;
        endRef.current?.();
        return cur;
      });
    }, 1000 / fps);
    return () => clearInterval(t);
  }, [paused, focused, frames.length, fps, loop]);
  if (frames.length === 0) return null;
  return <Image source={art(frames[Math.min(i, frames.length - 1)]).src} style={[{ width, height }, style]} resizeMode="cover" />;
}

// Легке idle-погойдування: повертає стиль-трансформ для Animated.View
export function useIdleSway(amp = 3, period = 2600): StyleProp<ViewStyle> {
  const v = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focused, period, v]);
  return {
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-0.4deg', '0.4deg'] }) }],
  } as unknown as StyleProp<ViewStyle>;
}
