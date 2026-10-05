import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image } from 'react-native';
import { pose, PoseName } from '../data/poses';

// Реакція Гріндіка на відповідь: вискакує пружинкою, на помилці ще й хитає головою.
// Рівень азарту росте з комбо (vision: "рівень позитивності росте при серії правильних відповідей"),
// а пози не повторюються два рази поспіль — стежимо за останньою показаною через модульну змінну.
export type ReactionKind = 'good' | 'fire' | 'mega' | 'bad' | 'timeout';

const POSES: Record<ReactionKind, PoseName[]> = {
  good: ['cheer', 'point', 'wave'],
  fire: ['cheer', 'crown', 'point'],
  mega: ['crown', 'cheer'],
  bad: ['shrug', 'think'],
  timeout: ['shrug', 'think'],
};

let lastPose: PoseName | null = null;

function pickPose(kind: ReactionKind): PoseName {
  const pool = POSES[kind];
  const options = pool.length > 1 ? pool.filter((p) => p !== lastPose) : pool;
  const name = options[Math.floor(Math.random() * options.length)];
  lastPose = name;
  return name;
}

// combo>=3 — вогник, combo>=6 — корона: та сама механіка, що вже рахує комбо в уроці
export function reactionKind(base: 'good' | 'bad' | 'timeout', combo: number): ReactionKind {
  if (base !== 'good') return base;
  if (combo >= 6) return 'mega';
  if (combo >= 3) return 'fire';
  return 'good';
}

export function Reaction({ kind, size = 64 }: { kind: ReactionKind; size?: number }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const name = useRef(pickPose(kind)).current;
  const p = pose(name);
  const bigPop = kind === 'mega';

  useEffect(() => {
    Animated.spring(scale, { toValue: bigPop ? 1.15 : 1, friction: 4, tension: 140, useNativeDriver: true }).start();
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
        Animated.timing(wobble, { toValue: bigPop ? 1 : 0, duration: 200, useNativeDriver: true }),
        ...(bigPop ? [Animated.timing(wobble, { toValue: 0, duration: 160, useNativeDriver: true })] : []),
      ]).start();
    }
  }, [scale, wobble, kind, bigPop]);

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
