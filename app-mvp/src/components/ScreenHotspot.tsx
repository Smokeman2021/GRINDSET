import React, { useState } from 'react';
import { View, Image, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import type { BmScreen } from '../data/bm/types';

// Рендерить РЕАЛЬНИЙ скріншот кабінету на всю ширину і кладе невидимі клікабельні зони
// поверх нього за відсотковими координатами. picked/onPick керуються ззовні (як у adsim.tsx),
// щоб екран рішень і фідбек лишались тим самим патерном, що в тренажері.
// kind:'nav' хотспоти — це реальні кнопки навігації кабінету (не завдання): onNav веде на
// екран leadsTo замість показу правильно/неправильно, тому завжди активні й позначені
// пунктиром, а не блокуються станом picked.
export function ScreenHotspot({
  screen,
  picked,
  onPick,
  onNav,
}: {
  screen: BmScreen;
  picked: string | null;
  onPick: (hotspotId: string) => void;
  onNav?: (leadsTo: string) => void;
}) {
  const { width: winW } = useWindowDimensions();
  const [boxW, setBoxW] = useState(Math.min(winW - 40, 500));
  const boxH = (boxW * screen.imgH) / screen.imgW;

  return (
    <View style={styles.wrap} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Image source={screen.image} style={{ width: boxW, height: boxH }} resizeMode="contain" />
      {screen.hotspots.map((h) => {
        const rect = {
          position: 'absolute' as const,
          left: (h.xPct / 100) * boxW,
          top: (h.yPct / 100) * boxH,
          width: (h.wPct / 100) * boxW,
          height: (h.hPct / 100) * boxH,
          borderRadius: 6,
        };
        if (h.kind === 'nav') {
          return (
            <Pressable
              key={h.id}
              onPress={() => h.leadsTo && onNav?.(h.leadsTo)}
              style={{
                ...rect,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: 'rgba(90,167,255,0.55)',
              }}
            />
          );
        }
        const isPicked = picked === h.id;
        const showResult = !!picked;
        return (
          <Pressable
            key={h.id}
            disabled={!!picked}
            onPress={() => onPick(h.id)}
            style={{
              ...rect,
              borderWidth: isPicked ? 3 : 0,
              borderColor: h.correct ? '#149a53' : '#d63031',
              backgroundColor: isPicked ? (h.correct ? 'rgba(20,154,83,0.18)' : 'rgba(214,48,49,0.18)') : showResult && h.correct ? 'rgba(20,154,83,0.12)' : 'transparent',
            }}
          />
        );
      })}
    </View>
  );
}

export function hotspotFeedback(screen: BmScreen, picked: string | null): string | null {
  return picked ? screen.hotspots.find((h) => h.id === picked)?.feedback ?? null : null;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignSelf: 'center', position: 'relative' },
});
