import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// М'яке радіально-зелене світіння «сцени» під фігурою (аватар у Профілі, конструктор). Без жорстких країв.
export function StageGlow({ size = 340, bottom = 0, intensity = 1 }: { size?: number; bottom?: number; intensity?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end' }]}>
      <Svg width={size} height={size} style={{ marginBottom: bottom }}>
        <Defs>
          <RadialGradient id="stageGlow" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor="#36e27a" stopOpacity={0.4 * intensity} />
            <Stop offset="0.45" stopColor="#36e27a" stopOpacity={0.18 * intensity} />
            <Stop offset="1" stopColor="#36e27a" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#stageGlow)" />
      </Svg>
    </View>
  );
}
