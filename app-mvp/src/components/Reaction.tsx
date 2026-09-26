import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image } from 'react-native';
import { pose, PoseName } from '../data/poses';

// Реакція Гріндіка на відповідь: вискакує пружинкою, на помилці ще й хитає головою (різні рухи, без повторів)
export type ReactionKind = 'good' | 'fire' | 'bad' | 'timeout';

const POSES: Record<ReactionKind, PoseName[]> = {
  good: ['cheer', 'point'],
  fire: ['cheer', 'crown'],
  bad: ['shrug', 'think'],
  timeout: ['shrug'],
};

export function Reaction({ kind, size = 64 }: { kind: ReactionKind; size?: number }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const name = useRef(POSES[kind][Math.floor(Math.random() * POSES[kind].length)]).current;
  const p = pose(name);

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
    if (kind === 'bad' || kind === 'timeout') {
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 140, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0.6, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 100, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(wobble, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [scale, wobble, kind]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale },
          { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) },
        ],
      }}
    >
      <Image source={p.src} style={{ width: size * p.ratio, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}
