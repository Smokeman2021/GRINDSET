import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

// Легкі й швидкі мікроанімації (до ~350 мс). Усе на transform/opacity, тому не навантажує відмальовування.

// Поява при монтуванні: "scale" (пружинка з-під 0.85) або "up" (виїзд знизу). delay для каскаду.
export function Pop({ children, delay = 0, from = 'scale', style }: { children: React.ReactNode; delay?: number; from?: 'scale' | 'up'; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [v, delay]);
  const transform = from === 'up' ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] : [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }];
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }), transform }]}>{children}</Animated.View>;
}

export type OptionState = 'idle' | 'picked' | 'correct' | 'wrong';

// Обгортка варіанта відповіді: вибір тихо «клацає» (легкий стиск-відскок), правильна відповідь підстрибує, хибна труситься.
export function OptionFx({ state, children }: { state: OptionState; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state === 'picked') {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
    } else if (state === 'correct') {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.045, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    } else if (state === 'wrong') {
      Animated.sequence([6, -6, 4, -4, 0].map((x) => Animated.timing(shift, { toValue: x, duration: 55, useNativeDriver: true }))).start();
    }
  }, [state, scale, shift]);
  return <Animated.View style={{ transform: [{ translateX: shift }, { scale }] }}>{children}</Animated.View>;
}
