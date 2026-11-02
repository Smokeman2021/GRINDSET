import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export const BRAND_GREEN = '#36e27a';

// Маркер цілі: м'який зелений неон-ореол (soft bloom) на точці цілі. Не ловить дотики.
// x, y: центр у пікселях контейнера; radius: радіус ореолу; intensity 0..1.5: яскравість; pulse: пульсація.
export function ObjectiveGlow({
  x,
  y,
  radius = 64,
  intensity = 1,
  pulse = true,
  color = BRAND_GREEN,
  style,
}: {
  x: number;
  y: number;
  radius?: number;
  intensity?: number;
  pulse?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused(); // під відкритим екраном зверху пульс не крутимо
  useEffect(() => {
    if (!pulse || !focused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, focused, t]);

  const size = radius * 2;
  const a = Math.min(1, 0.85 * intensity);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x - radius, top: y - radius, width: size, height: size },
        pulse && {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
        },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="objglow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={a} />
            <Stop offset="0.3" stopColor={color} stopOpacity={a * 0.55} />
            <Stop offset="0.65" stopColor={color} stopOpacity={a * 0.18} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill="url(#objglow)" />
        <Circle cx={radius} cy={radius} r={Math.max(3, radius * 0.07)} fill="#eafff2" opacity={Math.min(1, 0.9 * intensity)} />
      </Svg>
    </Animated.View>
  );
}
