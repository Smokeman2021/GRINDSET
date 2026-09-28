import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

// М'яке акцентне світіння під верхом екрана (глибина з макету A/C). Не займає дотиків.
export function Glow({ height = 280 }: { height?: number }) {
  const C = useTheme();
  const { width } = useWindowDimensions();
  const peak = C.name === 'night' ? 0.18 : 0.12;
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="55%" cy="0%" r="75%">
          <Stop offset="0" stopColor={C.accent} stopOpacity={peak} />
          <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#glow)" />
    </Svg>
  );
}
