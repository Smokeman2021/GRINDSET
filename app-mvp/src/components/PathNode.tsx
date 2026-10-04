import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Theme, rgba, useTheme } from '../theme';

// Вузол шляху уроків у "ігровому" стилі: об'ємний диск з градієнтом, блиском, товстою нижньою гранню,
// м'якою тінню на землі й іконкою замість емодзі. Усе малюється через SVG — виглядає однаково на Android, iOS і вебі.
export type NodeKind = 'done' | 'current' | 'locked' | 'crown' | 'quizOpen' | 'quizDone' | 'quizLocked';

const hex = (h: string) => {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const lighten = (c: string, t: number) => mix(c, '#ffffff', t);
const darken = (c: string, t: number) => mix(c, '#000000', t);

function palette(C: Theme, kind: NodeKind) {
  switch (kind) {
    case 'done':
    case 'quizDone':
    case 'current':
      return { base: C.accent, edge: C.accentEdge, glow: C.accent, icon: '#ffffff' };
    case 'crown':
      return { base: C.gold, edge: C.goldEdge, glow: C.gold, icon: '#ffffff' };
    case 'quizOpen':
      return { base: C.blue, edge: C.blueEdge, glow: C.blue, icon: '#ffffff' };
    default:
      return { base: C.panel2, edge: C.edge, glow: C.muted, icon: C.muted };
  }
}

function Icon({ kind, size, color, shade }: { kind: NodeKind; size: number; color: string; shade: string }) {
  const k = size / 24;
  const sw = 3.2;
  const parts = (c: string, dy: number) => {
    switch (kind) {
      case 'done':
      case 'quizDone':
        return <Path d="M6 12.8l4.2 4.2L18.2 7.6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" transform={`translate(0 ${dy})`} />;
      case 'current':
        return <Path d="M8.6 5.8v12.4a.8.8 0 0 0 1.2.7l9.4-6.2a.8.8 0 0 0 0-1.4L9.8 5.1a.8.8 0 0 0-1.2.7z" fill={c} transform={`translate(0 ${dy})`} />;
      case 'crown':
        return <Path d="M4 17.5l-1-9 5 3.5L12 5.5l4 6.5 5-3.5-1 9z M5 19.5h14" stroke={c} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" fill={c} transform={`translate(0 ${dy})`} />;
      case 'quizOpen':
        return <Path d="M12 3.6l2.4 5.1 5.6.7-4.1 3.9 1 5.5L12 16.1 7.1 18.8l1-5.5L4 9.4l5.6-.7z" fill={c} transform={`translate(0 ${dy})`} />;
      default:
        return (
          <G transform={`translate(0 ${dy})`}>
            <Rect x={6.2} y={10.6} width={11.6} height={9} rx={2.4} fill={c} />
            <Path d="M8.6 10.6V8.2a3.4 3.4 0 0 1 6.8 0v2.4" stroke={c} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </G>
        );
    }
  };
  return (
    <G transform={`scale(${k})`}>
      {parts(shade, 1.1)}
      {parts(color, 0)}
    </G>
  );
}

export function PathNode({
  kind,
  size,
  onPress,
  disabled,
}: {
  kind: NodeKind;
  size: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const C = useTheme();
  const night = C.name === 'night';
  const p = palette(C, kind);
  const depth = Math.round(size * 0.11);
  const [pressed, setPressed] = useState(false);
  const locked = kind === 'locked' || kind === 'quizLocked';
  const lift = pressed && !locked ? depth * 0.7 : 0;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (kind !== 'current' && kind !== 'quizOpen') return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [kind, pulse]);

  const top = locked ? lighten(p.base, 0.1) : lighten(p.base, 0.22);
  const bottom = locked ? p.base : darken(p.base, 0.06);
  const id = `n${kind}${size}`;
  const iconSize = size * 0.46;
  const haloSize = size * 1.9;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ width: size, height: size + depth }}
    >
      {(kind === 'current' || kind === 'quizOpen') && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (size - haloSize) / 2,
            top: (size - haloSize) / 2 + depth / 2,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [night ? 0.9 : 0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }) }],
          }}
        >
          <Svg width={haloSize} height={haloSize}>
            <Defs>
              <RadialGradient id={id + 'h'} cx="50%" cy="50%" r="50%">
                <Stop offset="0.5" stopColor={p.glow} stopOpacity={0.55} />
                <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2} fill={`url(#${id}h)`} />
          </Svg>
        </Animated.View>
      )}
      <Svg width={size} height={size + depth} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id + 'g'} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
          <LinearGradient id={id + 'r'} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={locked ? 0.18 : 0.5} />
            <Stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={id + 's'} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={locked ? 0.16 : 0.42} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id={id + 'd'} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={night ? 0.55 : 0.25} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* тінь на землі */}
        <Ellipse cx={size / 2} cy={size + depth * 0.55} rx={size * 0.5} ry={depth * 1.1} fill={`url(#${id}d)`} />
        {/* нижня грань (товщина кнопки) */}
        <Circle cx={size / 2} cy={size / 2 + depth} r={size / 2} fill={p.edge} />
        <G transform={`translate(0 ${lift})`}>
          <Circle cx={size / 2} cy={size / 2 + depth * 0.45} r={size / 2} fill={darken(p.edge, 0.1)} />
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}g)`} />
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 2.2} fill="none" stroke={`url(#${id}r)`} strokeWidth={2.4} />
          {kind === 'current' && (
            <Circle cx={size / 2} cy={size / 2} r={size / 2 + 3.5} fill="none" stroke={lighten(p.base, 0.55)} strokeWidth={2.2} strokeOpacity={0.9} />
          )}
          <Ellipse cx={size / 2} cy={size * 0.27} rx={size * 0.33} ry={size * 0.17} fill={`url(#${id}s)`} />
          <G transform={`translate(${(size - iconSize) / 2} ${(size - iconSize) / 2})`}>
            <Icon kind={kind} size={iconSize} color={p.icon} shade={locked ? 'rgba(0,0,0,0.35)' : darken(p.edge, 0.15)} />
          </G>
        </G>
        {night && !locked && (
          <Circle cx={size / 2} cy={size / 2} r={size / 2 + 1} fill="none" stroke={rgba(p.glow, 0.35)} strokeWidth={1} />
        )}
      </Svg>
    </Pressable>
  );
}
