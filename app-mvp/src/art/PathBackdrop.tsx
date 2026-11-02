import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { art, FILL_IMG } from './index';

// Підкладка під доріжкою уроків: смуга painterly-світу за вузлами + тепла темна віньєтка (замість чистого чорного).
// Нічна тема: світ ледь проглядає крізь теплий темний градієнт; денна: ще м'якше.
export function PathBackdrop() {
  const C = useTheme();
  const night = C.name === 'night';
  const plate = art('worlds/locations/street_night');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={plate.src} style={[FILL_IMG, { opacity: night ? 0.62 : 0.3 }]} resizeMode="cover" />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="pbg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={night ? '#1b130d' : '#f3ece0'} stopOpacity={night ? 0.3 : 0.35} />
            <Stop offset="0.5" stopColor={night ? '#120e0b' : '#f3ece0'} stopOpacity={night ? 0.5 : 0.5} />
            <Stop offset="1" stopColor={night ? '#0d0f14' : '#f3f6fb'} stopOpacity={night ? 0.78 : 0.8} />
          </LinearGradient>
          <RadialGradient id="pvig" cx="50%" cy="50%" r="75%">
            <Stop offset="0.5" stopColor="#05070a" stopOpacity={0} />
            <Stop offset="1" stopColor="#05070a" stopOpacity={night ? 0.5 : 0.12} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pbg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pvig)" />
      </Svg>
    </View>
  );
}
