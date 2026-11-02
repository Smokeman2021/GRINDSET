import React from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { art, artName, hasArt, type ArtKey } from './index';
import { useTilt } from './tilt';

// «Світ у щілині»: сцена з шарів глибини (bg / mid / fg). Кожен шар ширший за екран (overscan), щоб зсув не відкривав краї.
// Нахил (гіроскоп / миша) зсуває шари з різною амплітудою: чим ближчий шар, тим більший зсув. Найближчий шар (рама вікна / одвірок)
// кадрує сцену, заголовки рівня «висять» поверх у overlay й можуть виходити за край.

export type ParallaxLayer = {
  src: number;
  ratio: number; // ширина/висота файлу
  depth: number; // 0 далеко … 1 найближче
  overscan?: number; // на скільки шар ширший за екран з кожного боку (частка), за замовчуванням 0.08
  zoom?: number; // базове збільшення
};

// Шари сцени за назвою плити. Коли арт постачатиме окремі шари, достатньо покласти файли
//   worlds/layers/<назва>/bg.png, mid.png, fg.png   (<назва> = ім'я плити, напр. cafe)
// і запустити `npm run art:build`: лоадер сам перейде з плити на три шари, код не змінюється.
export function sceneLayers(plate: ArtKey): ParallaxLayer[] {
  const name = artName(plate);
  const bg = `worlds/layers/${name}/bg`;
  const mid = `worlds/layers/${name}/mid`;
  const fg = `worlds/layers/${name}/fg`;
  if (hasArt(bg) && hasArt(mid) && hasArt(fg)) {
    return [
      { ...art(bg), depth: 0.15, overscan: 0.06 },
      { ...art(mid), depth: 0.5, overscan: 0.1 },
      { ...art(fg), depth: 1, overscan: 0.16 },
    ];
  }
  // Плейсхолдер: цілісна плита з легким zoom-паралаксом
  const p = art(plate);
  return [{ src: p.src, ratio: p.ratio, depth: 0.5, overscan: 0.1, zoom: 1.04 }];
}

export function ParallaxScene({
  layers,
  width,
  height,
  enabled = true,
  anchorLayer = 0,
  renderAnchored,
  children,
  style,
}: {
  layers: ParallaxLayer[];
  width: number;
  height: number;
  enabled?: boolean;
  anchorLayer?: number; // у якому шарі «приклеєні» об'єкти (ореол цілі): вони рухаються разом з ним
  renderAnchored?: (w: number, h: number) => React.ReactNode;
  children?: React.ReactNode; // фіксований overlay (заголовки, погода)
  style?: StyleProp<ViewStyle>;
}) {
  const tilt = useTilt(enabled);
  return (
    <View style={[{ width, height, overflow: 'hidden' }, style]}>
      {layers.map((l, i) => {
        const o = l.overscan ?? 0.08;
        const z = l.zoom ?? 1;
        // розмір «cover» для контейнера, збільшений на overscan і zoom
        const boxW = width * (1 + o * 2) * z;
        const boxH = height * (1 + o * 2) * z;
        const imgH = Math.max(boxH, boxW / l.ratio); // висота при режимі cover (ratio = ширина/висота)
        const imgW = imgH * l.ratio;
        const maxShiftX = Math.max(0, (imgW - width) / 2);
        const maxShiftY = Math.max(0, (imgH - height) / 2);
        const ax = Animated.multiply(tilt.x, maxShiftX * l.depth * -1);
        const ay = Animated.multiply(tilt.y, maxShiftY * l.depth * -0.7);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: imgW,
              height: imgH,
              left: (width - imgW) / 2,
              top: (height - imgH) / 2,
              transform: [{ translateX: ax }, { translateY: ay }],
            }}
          >
            <Animated.Image source={l.src} style={{ width: imgW, height: imgH }} resizeMode="stretch" />
            {i === anchorLayer && renderAnchored ? renderAnchored(imgW, imgH) : null}
          </Animated.View>
        );
      })}
      {children}
    </View>
  );
}
