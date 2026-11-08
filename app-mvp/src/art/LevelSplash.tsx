import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { PoseImage } from '../components/PoseImage';
import { pose } from '../data/poses';
import { useStore } from '../store';
import { art } from './index';
import type { LevelScene } from './levels';
import { ObjectiveGlow } from './ObjectiveGlow';
import { ParallaxScene, sceneLayers } from './Parallax';
import { requestTilt } from './tilt';
import { WeatherOverlay, useSceneState } from './WeatherOverlay';

// ЕКРАН-СЦЕНА УРОКУ (еталон «Кафе»). Згори вниз:
//  1) фон-світ на весь екран (cover, кадр підібрано так, щоб ціль була праворуч від Гріндіка);
//  2) віньєтка: радіальне затемнення країв + темний градієнт угорі й унизу (світлий арт читається, текст видно);
//  3) Гріндік: прозорий cutout на повний зріст ліворуч із м'якою тінню, виходить за край кадру;
//  4) ціль: зелений неон-bloom + пульсуючий пін на точці цілі в сцені;
//  5) пігулка «Модуль X · урок Y» і заголовок локації «у просторі» з тінню;
//  6) СВІТЛА тепла картка завдання з темним текстом і зеленою кнопкою;
//  7) HUD: пігулки 🔥/⭐/🪙/⚡ на напівпрозорому темному блюрі.
export function LevelSplash({ scene, kicker, title, task, onStart, onExit }: { scene: LevelScene; kicker: string; title: string; task: string; onStart: () => void; onExit?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const weather = useSceneState();
  const layers = React.useMemo(() => sceneLayers(scene.plate), [scene.plate]);
  const p = pose(scene.pose);
  const plate = art(scene.plate);

  // Для ландшафтної плити на портретному екрані ціль ставимо на ~70% ширини екрана (праворуч від Гріндіка); портретна плита лишається по центру
  const landscape = plate.ratio > 1;

  // Гріндік на повний зріст: висота ≈ 60–66% екрана, але не ширше за ~78% ширини екрана; ліва частина виходить за край
  const figH = Math.min(height * 0.66, (width * 0.78) / p.ratio);
  const figW = figH * p.ratio;

  const start = async () => {
    await requestTilt(); // iOS просить дозвіл на гіроскоп саме від жесту
    onStart();
  };

  return (
    <View style={styles.root}>
      <ParallaxScene
        layers={layers}
        width={width}
        height={height}
        focus={landscape ? { x: scene.goal.x, at: 0.7 } : undefined}
        anchorLayer={Math.floor(layers.length / 2)}
        renderAnchored={(w, h) => <ObjectiveGlow x={scene.goal.x * w} y={scene.goal.y * h} radius={Math.max(64, w * 0.085)} intensity={1.4} />}
      >
        {/* віньєтка: радіальне затемнення країв + верх (~16%) і низ */}
        <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="vig" cx="50%" cy="46%" r="75%">
              <Stop offset="0.45" stopColor="#05070a" stopOpacity={0} />
              <Stop offset="1" stopColor="#05070a" stopOpacity={0.55} />
            </RadialGradient>
            <LinearGradient id="vigT" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#05070a" stopOpacity={0.62} />
              <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="vigB" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#05070a" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#vig)" />
          <Rect x={0} y={0} width={width} height={height * 0.22} fill="url(#vigT)" />
          <Rect x={0} y={height * 0.62} width={width} height={height * 0.38} fill="url(#vigB)" />
        </Svg>

        {/* Гріндік-cutout: «стоїть» у сцені збоку, ламає четверту стіну */}
        <View pointerEvents="none" style={{ position: 'absolute', left: -figW * 0.14, bottom: insets.bottom + 128, width: figW, height: figH }}>
          <PoseImage p={p} width={figW} height={figH} />
        </View>

        <WeatherOverlay state={weather} />

        {/* HUD */}
        <View style={[styles.hud, { top: insets.top + 8 }]}>
          {onExit && (
            <Pressable onPress={onExit} style={styles.pill} hitSlop={8} accessibilityLabel="Вийти зі сцени">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Hud />
        </View>

        {/* заголовок «висить у просторі» */}
        <View pointerEvents="none" style={[styles.titleBox, { top: insets.top + 64 }]}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
        </View>

        {/* світла тепла картка завдання */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.card}>
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#f7f1e4" />
                  <Stop offset="1" stopColor="#ece3d0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#warm)" />
            </Svg>
            <Text style={styles.taskLabel}>ЗАВДАННЯ</Text>
            <Text style={styles.taskTxt}>{task}</Text>
            <View style={{ marginTop: 12 }}>
              <Button title="Увійти" onPress={() => void start()} />
            </View>
          </View>
        </View>
      </ParallaxScene>
    </View>
  );
}

// Пігулки показників на напівпрозорому темному блюрі (лише дрібні HUD-елементи темні, картки поверх арту світлі)
export function Hud() {
  const streak = useStore((s) => s.streak);
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const energy = useStore((s) => s.energy);
  const Item = ({ icon, v }: { icon: 'streak' | 'xp' | 'coin' | 'energy'; v: number }) => (
    <View style={styles.pill}>
      <Icon name={icon} size={18} />
      <Text style={styles.pillTxt}>{v}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Item icon="streak" v={streak} />
      <Item icon="xp" v={xp} />
      <Item icon="coin" v={coins} />
      <Item icon="energy" v={energy} />
    </View>
  );
}

const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as object) : {};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0f14' },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 32, borderRadius: 16, backgroundColor: 'rgba(13,15,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', ...blur },
  pillTxt: { color: '#eef2f7', fontWeight: '800', fontSize: 13 },
  close: { color: '#eef2f7', fontWeight: '900', fontSize: 15, paddingHorizontal: 4 },
  titleBox: { position: 'absolute', left: 18, right: 40, transform: [{ rotate: '-2deg' }] },
  kicker: { alignSelf: 'flex-start', backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 12, letterSpacing: 1.5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  title: { marginTop: 8, color: '#ffffff', fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: '#d9ceb4', padding: 16, overflow: 'hidden' },
  taskLabel: { color: '#1c8f4f', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  taskTxt: { color: '#2a2418', fontSize: 18, fontWeight: '800', marginTop: 4 },
});
